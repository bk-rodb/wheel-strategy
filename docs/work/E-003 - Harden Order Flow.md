# E-003 — Harden Order Flow

| Field | Value |
|-------|-------|
| **ID** | `E-003` |
| **Type** | Enhancement |
| **Status** | done |
| **Opened** | 2026-08-08 |
| **Closed** | 2026-08-08 |
| **Owner** | — |
| **Related** | [ADR-001](../adr/ADR-001%20-%20Order%20journal%20durable%20intent.md) · [NEXT_STEPS.md](../NEXT_STEPS.md) · E-002 is Multi-Source Decision Engine (unrelated) |

---

## Prompt

> create a new work plan for hardening the order flow process. explore all considerations for transaction completion guarantee and contingency plans problem situations
>
> Continue with #2 (durable server-side order journal + Alpaca recon; desk + bot + backend)

---

## Context

Desk OMS already used `client_order_id`, never auto-retried POST, orphan-reconciled, and waited for venue cancel confirm. Persistence was only `localStorage` blotter; `trade_updates` is inert; bot had a separate file run-log. Completion was not durable across browser clear, new device, or mid-flight crash.

**ID note:** Plan drafts briefly labeled this E-002; E-002 is already Multi-Source Decision Engine — this work is **E-003**.

---

## Requirements

1. Durable SQLite order journal keyed by `client_order_id`, updated on proxy place/cancel.
2. Failed/ambiguous POST must reconcile via `GET …:by_client_order_id` before returning failure.
3. Reject a second non-terminal place for the same underlying (server lock).
4. Desk resume: journal-first, then blotter, then Alpaca open list; keep SELL locked while non-terminal.
5. Contingency UX: unacked/orphan, partial fill, multi-open, placement blocked.
6. Bot consults journal open intents before place; keep `BOT_DRY_RUN` and file run-log.
7. Document broker SoT + journal = durable intent (ADR).

---

## Acceptance criteria

- [x] Every live place (desk or bot, non-dry-run) has a journal row keyed by `client_order_id` before or atomically with Alpaca acceptance path
- [x] Failed/ambiguous POST always attempts by-client-id reconcile; duplicate place with same id does not create a second broker order
- [x] After refresh / new session, desk resumes any non-terminal journal+broker order for the underlying and keeps SELL locked
- [x] Cancel-with-partial-fill surfaces filled qty; unlock only after terminal ack
- [x] Second place for same underlying while non-terminal exists is rejected (client and/or server)
- [x] `AllowOrderPlacement=false` yields clear blocked state and no Alpaca mutation
- [x] Tests cover orphan reconcile + remount resume; `dotnet test` + relevant `npm test` / `bot:test` green
- [x] E-003 work item completed section filled on ship

---

## Out of scope

- SSE / websocket `trade_updates` relay (follow-up)
- Order replace/modify, brackets, cancel-all desk kill UI beyond surfacing `AllowOrderPlacement`
- Institutional EOD compliance export
- Moving pre-trade checks server-side (proxy caps stay)

---

## Design notes

- Proxy mutation hooks write the journal so desk/bot keep `/api/alpaca/trading/v2/orders` paths.
- Explicit `GET /api/orders/journal` + `POST …/reconcile` for resume UI.
- Local blotter demoted to optimistic UI cache.
- Bot sends `X-Wheel-Order-Source: bot` on place/cancel.

---

## Completed

### Summary

Added a SQLite **order journal** updated by the Alpaca proxy on place/cancel, with by-client-id recovery after lost POSTs and a per-underlying open-intent lock. Desk resume is journal-first; UI surfaces unacked/multi-open contingencies. Bot skips when journal or Alpaca shows an open order.

### Commits

| Hash | Message |
|------|---------|
| `428cbe7` | Add durable order journal for place/cancel intent (E-003). |

PR: —

### Key changes

- `backend/.../Orders/OrderJournalService.cs` — durable intent + underlying lock
- `backend/.../Endpoints/AlpacaProxyEndpoints.cs` — journal hooks + orphan recover
- `backend/.../Endpoints/OrderJournalEndpoints.cs` — list + reconcile APIs
- `src/hooks/usePendingOptionOrder.ts` — journal-first resume, focus refresh, multi-open lock
- `src/api/fetchOrderJournal.ts` — desk client
- `bot/src/cycle.ts` + `bot/src/orderJournal.ts` — journal gate + source header
- `docs/adr/ADR-001 - Order journal durable intent.md`

### Verification

```bash
dotnet test backend/WheelStrategy.Api.Tests --filter "FullyQualifiedName~OrderJournal"
npx vitest run src/hooks/usePendingOptionOrder.test.ts src/api/fetchOrderJournal.test.ts src/components/OpenOptionsSection.test.ts src/api/optionOrders.test.ts
npm --prefix bot test
npm run check:api
```

Manual (paper): place → kill network mid-POST → confirm reconcile; refresh mid-working; two-tab / second place → 409.

### Follow-ups

- SSE `trade_updates` relay (latency only; journal covers durability)
- Optional desk UI for `AllowOrderPlacement` kill-switch status
- Export / EOD recon against journal
- **Integrity (from pre-commit review):** terminalize journal on Alpaca place 4xx/5xx (today only orphan-recover on transport timeout); keep `orphan_check` open when by-client-id reconcile itself times out (do not `submit_failed`)
- **Integrity:** `ListAsync(openOnly)` must query open desk states in SQL — current “take newest N×4 then filter” can miss an older open row and drop the per-underlying lock
- **Integrity:** make `TryBeginPlaceAsync` atomic (transaction / lock) so concurrent places cannot double-submit
- **Integrity:** GET order poll must not overwrite `cancel_requested` / `cancel_pending` back to `working`
- Desk resume: after journal-first resume, still run multi-open Alpaca scan for the banner/lock
- If API is ever LAN/cloud-exposed: auth (or localhost bind) for proxy + journal — same threat model as today’s unauthenticated proxy
