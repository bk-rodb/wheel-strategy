# E-002 — Multi-Source Decision Engine

| Field | Value |
|-------|-------|
| **ID** | `E-002` |
| **Type** | Enhancement |
| **Status** | planned |
| **Opened** | 2026-08-08 |
| **Closed** | — |
| **Owner** | — |
| **Related** | [E-001](./E-001%20-%20Update%20strike%20decision%20engine.md) · [F-001](./F-001%20-%20Trade%20Retrospective%20Learning.md) Experience head · [docs/test.md](../test.md) · [NEXT_STEPS.md](../NEXT_STEPS.md) (liquidity L-18, earnings awareness) · Analysis API · `fetchFridayOptions` |

---

## Prompt

> if i wanted a multi-source decision engine with Greeks being 1 head, ATR being another, HMM being another...what other factors should be part of the decision making engine? SMA?
>
> (Research reply in [docs/test.md](../test.md): structural SMA/VWAP anchors, liquidity/OI microstructure, earnings/event gates, and HMM-weighted synthesis / gatekeeper before execute.)

---

## Context

E-001 shipped **delta-primary** strike selection (0.20 / 0.30 / 0.40) with **ATR14 floors** and **HMM delta nudges**. Empirical assignment remains a cross-check. The pipeline is sequential overlays, not weighted heads.

Gaps vs the multi-source design in `docs/test.md`:

| Factor | Today |
|--------|--------|
| SMA 50/200 | UI trend chips only (`trendMetrics.ts`); not in strike engine |
| VWAP | Stored on `HistoricalBar`; unused for strikes |
| Bid-ask spread gate | Quotes used for mid/limit; no max-spread abort |
| OI / round-number walls | OI displayed; snap is nearest strike only |
| Earnings in DTE | Finnhub catalysts + pre-trade warnings; no strike reshape / halt |
| HMM as weight master | Flat Δ nudge only |

```text
Decision heads → Macro synthesis (HMM sets weights) → Liquidity & event gate → Execute / abort
```

---

## Requirements

### Phase A — Structural / SMA head

1. Compute 50-day and 200-day SMA from cached daily bars.
2. Macro bias: if spot is below the 200 SMA, force the put-selling profile toward ultra-safe (configurable target \|Δ\|, default `0.15`) or an equivalent safe clamp.
3. Use SMA for **direction / barrier bias only** — delta (+ ATR) remains the primary strike proposer.
4. Expose SMA levels and bias flag on the analysis contract and wheel analysis UI.

### Phase B — Liquidity & microstructure gate

1. Compute spread width `(ask − bid) / mid`; abort or soft-block SELL when width exceeds a threshold (default `5%`, configurable).
2. Prefer snap toward round-number / high open-interest “walls” when the nearest listed strike is thin (replace pure nearest-strike in `fetchFridayOptions`).
3. Surface the gate reason in the Friday ladder / pre-trade UX.

### Phase C — Event gate

1. If an earnings date (existing Finnhub catalysts) falls inside the target contract DTE: apply a **volatility halt** or **widen ATR multiples** (e.g. 3σ-style, configurable) — promote from warning-only to engine action.
2. Dividends: soft warning unless reliable ex-div data is already available; document chosen behavior.

### Phase D — HMM-weighted synthesis

1. Replace the flat sequential HMM Δ nudge with regime-conditioned weights (defaults from research):
   - Low-vol / steady bull → trust Greeks (~70%).
   - High-vol / shock → trust ATR + SMA (~70%).
2. Keep the liquidity & event gatekeeper **after** synthesis (gates can still abort).
3. All knobs in `AnalysisOptions` / `appsettings.json`. Add a short ADR if the weight scheme is non-obvious.

---

## Acceptance criteria

### Planning (this status)

- [x] E-002 work file + Index row exist; status `planned`.
- [x] Phase A–D requirements, implementation ACs, out of scope, and design notes recorded.
- [x] Links to E-001, `docs/test.md`, and NEXT_STEPS liquidity/earnings gaps.

### Phase A — implementation (when coding)

- [ ] 50/200 SMA computed from daily bars and returned on the analysis result.
- [ ] Spot below 200 SMA applies configurable ultra-safe put Δ bias (default 0.15).
- [ ] SMA does not replace delta/ATR as the strike solver.
- [ ] UI shows SMA levels + macro bias; DTO + OpenAPI + `npm run gen:api` updated.
- [ ] Tests: SMA helpers / bias path in `StatMathTests` (or service tests).

### Phase B — implementation

- [ ] Spread-width gate blocks or soft-blocks SELL above threshold (default 5%).
- [ ] Contract snap prefers high-OI / round-number wall within a band of the model strike.
- [ ] Gate reason visible in ladder / pre-trade path.
- [ ] Frontend tests for snap preference and spread reject.

### Phase C — implementation

- [ ] Earnings inside DTE triggers configured halt **or** ATR widen (config enum).
- [ ] Behavior documented for dividends (warn vs ignore).
- [ ] Analysis/pre-trade tests cover event-in-window path.

### Phase D — implementation

- [ ] HMM regime selects weight set for Greeks vs ATR/SMA (defaults above).
- [ ] Gatekeeper still runs after synthesis.
- [ ] Config knobs + unit tests for weight application; ADR if needed.
- [ ] Suite checks: `dotnet test`, `npm test`, `npm run check:api` as applicable.

---

## Out of scope

- Programmatic early buyback / close (manage winners/losers) — separate work item.
- Order-flow / aggressive bid-ask (delta volume) imbalance — no data path today.
- Live IV surface or chain greeks as primary solver (remains an E-001 follow-up).
- Replacing the Research HMM UI.
- Anchored VWAP as a hard CSP ceiling in v1 (optional later; daily VWAP on bars may inform Phase A notes only).

---

## Design notes

| Topic | Decision |
|-------|----------|
| SMA role | Bias / macro support only; not exact strike |
| Liquidity | Prefer **abort/block** over silent wide-spread fills |
| OI snap | Among candidates near model strike, prefer put lower / call nearer to OI wall & round numbers |
| Earnings | Config: `Halt` \| `WidenAtr`; default widen ATR multiple, still warn if event remains in window |
| HMM weights | Fixed defaults by regime, not ML-learned; replaces flat Δ nudge when Phase D ships |
| Phasing | Ship A→D in separate commits; close AC groups incrementally |

**Key touchpoints (implement later):**

- `backend/WheelStrategy.Api/Services/WheelAnalysisService.cs`
- `backend/WheelStrategy.Api/Stats/StatMath.cs`
- `backend/WheelStrategy.Api/Options/AnalysisOptions.cs` + `appsettings.json`
- `backend/WheelStrategy.Api/Contracts/WheelAnalysisDtos.cs`
- `src/api/fetchFridayOptions.ts` (snap + spread)
- `src/components/WheelAnalysisPanel.tsx` / OpenOptions pre-trade
- Finnhub `CatalystsService` + `catalystWarningsForExpiry`

---

## Completed

*Fill when status → done.*

### Summary

—

### Commits

| Hash | Message |
|------|---------|
| — | — |

PR: —

### Key changes

—

### Verification

```bash
# after implementation
```

### Follow-ups

- Early close / buyback rule engine (posed at end of `docs/test.md`).
- Order-flow imbalance head if a data source is added.
- Optional ADR under `docs/adr/` for Phase D weight scheme.
- Anchored / weekly VWAP as CSP strike ceiling.
- Integrate [F-001](./F-001%20-%20Trade%20Retrospective%20Learning.md) Experience `weightHint` into Phase D synthesis ([ADR-002](../adr/ADR-002%20-%20Experience%20head%20priors.md)).
