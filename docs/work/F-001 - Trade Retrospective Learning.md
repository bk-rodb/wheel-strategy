# F-001 — Trade Retrospective Learning

| Field | Value |
|-------|-------|
| **ID** | `F-001` |
| **Type** | Feature |
| **Status** | done |
| **Opened** | 2026-08-08 |
| **Closed** | 2026-08-08 |
| **Owner** | — |
| **Related** | [ADR-002](../adr/ADR-002%20-%20Experience%20head%20priors.md) · [ADR-001](../adr/ADR-001%20-%20Order%20journal%20durable%20intent.md) · [E-002](./E-002%20-%20Multi-Source%20Decision%20Engine.md) · [E-003](./E-003%20-%20Harden%20Order%20Flow.md) · [trading-desk-gaps.md](../trading-desk-gaps.md) · NEXT_STEPS backtest (follow-up) |

---

## Prompt

> create feature plan centered around a historical performance tracking and learning module. the goal is to create a retrospective process that can learn from successful and unsuccessful, profitable and non profitable trades. will want to understand conditions or recurring or anomaly situations that caused a particular result. will want implement this as another voice for the decision engine
>
> Learning: explainable statistical priors (1A). Corpus: desk + bot executed fills only (2A).

---

## Context

Order journal (E-003 / ADR-001) stores durable OMS **intent**, not fill economics, assignment/expiry labels, or the decision context that produced a strike. E-002’s multi-head synthesis has no experience loop. The desk needs a closed-trade ledger, retrospective analytics, and an **Experience head** that emits explainable bias/weight hints from past fills.

---

## Requirements

### Phase A — Closed-trade outcome ledger

1. `TradeOutcome` EF entity separate from `OrderJournalEntry`.
2. Immutable decision snapshot at place (desk/bot).
3. Upsert fill economics when broker reports fill.
4. Resolve terminal labels: `expired_otm` | `assigned` | `bought_to_close` | `canceled_before_fill` | `unknown` (+ working states).
5. APIs to list, attach snapshot, reconcile fill, resolve from activities.

### Phase B — Retrospective process + UI

1. Cohort aggregations (assignment rate, premium capture vs model, anomalies).
2. Summary Dashboard retrospective section.
3. CSV export of closed outcomes.

### Phase C — Experience head

1. `ExperiencePriorService` → `ExperienceSignal` on analysis result.
2. Interim Δ bias when `n ≥ MinSamples` and confidence high.
3. ADR-002 documents priors vs ML deferral.

### Phase D — Wheel-cycle attribution

1. `WheelCycleId` linking CSP → assignment → CC.
2. Cycle-level P&L when closable.

---

## Acceptance criteria

- [x] F-001 work file + Index; ADR-002 accepted
- [x] Desk/bot fill produces durable outcome with immutable snapshot + fill economics
- [x] Terminal labels via reconcile / activities resolve
- [x] Retrospective API + UI: cohorts, model-vs-actual, anomalies
- [x] Experience head on analysis contract; bias only when `n ≥ MinSamples`
- [x] WheelCycleId attribution for CSP→CC paths
- [x] Tests: `dotnet test`, `npm test`, `npm run check:api` as applicable

---

## Out of scope

- ML / gradient reweighting of heads
- Offline suggestion backtest corpus (NEXT_STEPS follow-up)
- Programmatic early buyback
- Replacing order journal with the outcome store

---

## Design notes

| Topic | Decision |
|-------|----------|
| Journal vs outcome | Journal = OMS intent; TradeOutcome = economics + labels + snapshot |
| Learning | Explainable cohort priors; not ML in v1 |
| Corpus | Desk + bot fills only |
| Snapshot transport | `PUT /api/trades/outcomes/{clientOrderId}/snapshot` (+ place-time sync) |
| Experience plug-in | `EffectiveDelta` interim; E-002 synthesis consumes signal later |

---

## Completed

### Summary

Shipped a closed-trade `TradeOutcome` ledger separate from the order journal, retrospective aggregations + Summary Dashboard panel, and an Experience decision head that emits explainable bias/weight hints from resolved fills (desk + bot). Wheel cycles link assigned CSP legs to subsequent CC snapshots.

### Commits

| Hash | Message |
|------|---------|
| — | — |

PR: —

### Key changes

- `TradeOutcome` model + migration + `TradeOutcomeService` / endpoints
- `ExperiencePriorService` wired into `WheelAnalysisService` + analysis DTO
- Desk: snapshot on place, `RetrospectivePanel`, Experience chip in analysis UI
- Bot: snapshot attach before sell-to-open
- ADR-002 + F-001 docs

### Verification

```bash
dotnet test
npx vitest run src/api/fetchTradeOutcomes.test.ts
npm run check:api
```

### Follow-ups

- Offline suggestion backtest as separate work item
- E-002 Phase D weight integration for Experience `weightHint`
- Commit hash when this ships