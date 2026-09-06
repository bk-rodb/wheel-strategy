# Wheel Desk — Roadmap

Forward-looking backlog for the wheel strategy trading desk, the NVDA bot, and the analysis backend.

**Related:**
[CLAUDE.md](../CLAUDE.md) |
[BOT.md](./BOT.md) |
[BOT_AUTOMATION.md](./BOT_AUTOMATION.md) |
[NEXT_STEPS.md](./NEXT_STEPS.md) (historical remediation record) |
[trading-desk-gaps.md](./trading-desk-gaps.md) (institutional gap matrix)

---

## How to read this document

**Swim lanes** group items by type:

| Lane | Contains |
|------|----------|
| **Features** | New capabilities not yet in the app |
| **Enhancements** | Improvements to existing capabilities |
| **Risk / Fixes** | Open defects, safety gaps, operational risks |
| **Future / Exploratory** | Ideas not yet committed |

**Priority:**

| Tag | Meaning |
|-----|---------|
| **P0** | Do next — blocks current workflow or has safety implications |
| **P1** | High value, planned for near-term |
| **P2** | Medium value, committed direction |
| **P3** | Future / exploratory, not committed |

**Status:**

| Tag | Meaning |
|-----|---------|
| **Done** | Shipped (commit ref where applicable) |
| **In progress** | Actively being built |
| **Planned** | Committed, has a plan or spec |
| **Proposed** | Direction agreed, no spec yet |
| **Idea** | Not committed |

---

## Features

New capabilities not yet in the app.

### Bot

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| F-1 | Bot HTTP trigger (`--serve` mode) | P0 | Planned | `POST /trigger` + `GET /health` for N8N scheduling. Spec: [BOT_AUTOMATION.md](./BOT_AUTOMATION.md) |
| F-2 | Bot Slack notifications | P0 | Planned | Webhook POST on every cycle outcome. Spec: [BOT_AUTOMATION.md](./BOT_AUTOMATION.md) |
| F-3 | Bot email notifications via N8N | P1 | Planned | N8N workflow parses bot response, sends SMTP email. Spec: [BOT_AUTOMATION.md](./BOT_AUTOMATION.md) |
| F-4 | Bot early close (CC only) | P2 | Proposed | BTC a profitable short covered call and reopen next week. Scaffold in `bot/src/earlyClose.ts`; not wired into loop |
| F-5 | Multi-ticker bot universe | P2 | Done | `BOT_SYMBOLS` config-driven list (default NVDA, SPCX, RKLB); each symbol runs its own independent sell-to-open cycle |
| F-6 | Bot assignment / roll handling | P3 | Idea | Detect assignment, transition to next wheel phase, auto-open next leg |
| F-7 | Docker deployment (bot + API + N8N) | P2 | Proposed | `docker-compose.yml` when dedicated host is ready. Migration path in [BOT_AUTOMATION.md](./BOT_AUTOMATION.md) |

### Desk UI

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| F-8 | Distribution visualization | P1 | Proposed | Histogram / density of forward-return distribution with safe/regular/risky strikes marked |
| F-9 | Daily-granularity toggle | P1 | Proposed | Backend already accepts `granularity=daily` (~480 samples vs ~99 weekly). Add weekly/daily switch to analysis panel. Surface `sampleCount` |
| F-10 | Persist analysis preferences | P2 | Proposed | Remember DTE / lookback / granularity per session. Reuse hardened watchlist store |
| F-11 | Dedicated blotter page | P2 | Proposed | Full order history view; currently only pending strip on Summary |
| F-12 | Realized P&L tracking | P2 | Proposed | Premium collected is tracked; full realized/assignment P&L is not |
| F-13 | Multi-symbol portfolio ranking | P2 | Proposed | Run analysis across watchlist, rank by annualized yield at a chosen assignment-probability level |

### Analysis backend

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| F-14 | Implied vs realized vol disclosure | P1 | Proposed | Show option-implied vol alongside realized vol the model uses; a large gap is itself a signal. Upgraded from feature to disclosure by M-28 |
| F-15 | Backtest strike suggestions | P2 | Proposed | For each historical date, compute what the regular strike would have been and whether it expired OTM |
| F-16 | Dividend and earnings awareness | P2 | Proposed | Skip/flag expirations spanning an earnings date; incorporate div yield into BS. Note L-13: catalysts service cannot distinguish "no earnings" from "provider down" |

---

## Enhancements

Improvements to existing capabilities.

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| E-1 | Surface true option delta | P1 | Proposed | Show delta alongside assignment probability so "regular ~ 0.30 delta" uses the option's own delta |
| E-2 | Background bar refresh | P2 | Proposed | `BackgroundService` pre-warms + refreshes `HistoricalBar` cache for watchlisted symbols off the request path |
| E-3 | SSE fill relay | P1 | Proposed | Replace inert `tradeUpdatesStream.ts` websocket. Server-side SSE so browser gets push fills without shipping Alpaca WS credentials |
| E-4 | EOD reconciliation workflow | P3 | Idea | Position/trade recon between desk blotter and Alpaca |
| E-5 | Execution analytics (TCA, slippage) | P3 | Idea | Useful once fill history is durable |
| E-6 | Quick-modify orders | P2 | Proposed | Replace order in place via Alpaca `PATCH /v2/orders/{id}` |
| E-7 | Position / max-loss limits UI | P2 | Proposed | Configurable hard/soft limits; currently no exposure controls |
| E-8 | Effective sample size disclosure | P1 | Proposed | M-29: overlapping windows mean confidence intervals are wider than raw `sampleCount` implies. Show effective N |
| E-9 | Recompute assignment probs after snap | P1 | Proposed | M-13: assignment probabilities still use the un-snapped analysis strike. Recompute or warn when snap distance is large |

---

## Risk / Fixes

Open defects, safety gaps, and operational risks.

| # | Item | Priority | Status | Ref | Notes |
|---|------|----------|--------|-----|-------|
| R-1 | Alpaca key rotation | P0 | Open | Phase 0 | Manual: rotate key + secret exposed in historical `dist/` bundles. Finnhub token too (H-20) |
| R-2 | Lane 3.2 partial fixes | P1 | Open | M-11, M-13, L-11, L-14, L-17, L-18, L-19 | Deferred from Phase 3 remediation |
| R-3 | NYSE holiday calendar | P1 | Proposed | — | Bot has no holiday awareness; may place on market holidays. N8N cron also fires blindly |
| R-4 | Server-side audit trail | P2 | Proposed | trading-desk-gaps 3.4 | Blotter is localStorage only; no durable server record |
| R-5 | Desk UI kill switch | P2 | Proposed | trading-desk-gaps 3.3 | Backend has `AllowOrderPlacement` but no desk UI toggle. The bot respects it; the desk should surface it |
| R-6 | Server-side pre-trade checks | P2 | Proposed | trading-desk-gaps 3.3 | Pre-trade gates are client-only; bot has its own port. A server-side layer would be safer for unattended trading |
| R-7 | EST/EDT cron shift | P1 | Planned | BOT_AUTOMATION.md | N8N Schedule Trigger supports IANA TZ; raw cron needs manual seasonal flip |

---

## Future / Exploratory

Ideas not yet committed. Tracked here for visibility; no spec or timeline.

| # | Item | Priority | Notes |
|---|------|----------|-------|
| X-1 | Local LLM integration (Ollama) | P3 | Early-close judgment calls, multi-ticker selection, anomaly/catalyst skip. No LLM needed for v1 deterministic cycle |
| X-2 | Broader options strategies | P3 | Beyond the wheel: spreads, strangles, iron condors on the same OMS/analysis spine |
| X-3 | Multi-asset expansion | P3 | Futures, crypto (Alpaca already supports crypto) |
| X-4 | Workstation polish | P3 | Multi-monitor, hotkeys, drag-and-drop layout, dark/light theme |
| X-5 | Claude CoWork / agent-assisted review | P3 | Weekly agent reviews `runs.jsonl`, suggests parameter changes, flags underperformance |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-06 | Initial roadmap created. Bot v1 shipped (`b13e1eb`). Bot automation planned. |
