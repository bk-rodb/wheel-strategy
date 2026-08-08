# ADR-002 — Experience head priors

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-08-08 |
| **Related** | [F-001](../work/F-001%20-%20Trade%20Retrospective%20Learning.md) · [E-002](../work/E-002%20-%20Multi-Source%20Decision%20Engine.md) · [ADR-001](./ADR-001%20-%20Order%20journal%20durable%20intent.md) |

## Context

The multi-source decision engine (E-002) synthesizes Greeks, ATR, HMM, and SMA heads. Without a closed-loop store of what was decided and what happened, the desk cannot learn from profitable vs unprofitable legs. ML reweighting was considered but paper fill volume is sparse and explainability matters for a trading desk.

ADR-001’s order journal is durable **intent** for OMS resume — it must not become a bloated P&L/analytics table.

## Decision

1. **Separate `TradeOutcome` ledger** from the order journal: fill economics, terminal outcome labels, immutable decision snapshot, optional `WheelCycleId`.
2. **Experience head** computes explainable **statistical priors** from resolved fills grouped into cohorts (`side`, `level`, `hmmRegime`, `dteBucket`, `earningsInWindow`, optionally underlying).
3. Emit `ExperienceSignal { biasDelta, weightHint, confidence, reasons[], sampleSize, cohortKey }` on the analysis contract.
4. Apply Δ bias only when `sampleSize ≥ MinSamples` (default 20) and confidence clears a threshold; **one-off anomalies never move weights** — they surface in the retrospective UI only.
5. **Defer ML** (gradient reweighting of heads). HMM remains the weight master in E-002 Phase D; Experience may supply a gated `weightHint` later.
6. Learning corpus for v1 is **desk + bot executed fills** only — not offline suggestion backtests.

## Consequences

- Place path must attach a decision snapshot (API) before or with the order.
- Brokers remain SoT for fills/activities; outcomes reconcile from Alpaca order JSON + account activities.
- Retrospective UI and CSV export read TradeOutcome, not the journal.
- E-002 synthesis should treat Experience as an additional head when Phase D lands; until then interim sequential Δ bias mirrors the HMM nudge pattern.
