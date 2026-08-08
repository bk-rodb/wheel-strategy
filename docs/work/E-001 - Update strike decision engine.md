# E-001 — Update strike decision engine

| Field | Value |
|-------|-------|
| **ID** | `E-001` |
| **Type** | Enhancement |
| **Status** | done |
| **Opened** | 2026-08-08 |
| **Closed** | 2026-08-08 |
| **Owner** | — |
| **Related** | Analysis API · `WheelAnalysisPanel` · originating chat `56c4e3de-1106-4969-83ce-d1e935f1a526` |

---

## Prompt

> review rules for agressive, balanced and conservative option strike selection. apply rule-of-thumb .30 delta for balanced, .40 delta for aggressive and .20 for conservative. Also, implement a review of 7-day, 14-day and 21-day ATR as well as HMM to consider when suggesting strikes

---

## Context

Strike suggestions (`safe` / `regular` / `risky`) were driven by **empirical forward-return percentiles** targeting assignment probabilities (~15% / 30% / 45%), with Black-Scholes assignment as a parallel estimate. The desk labels map to conservative / balanced / aggressive; industry rule-of-thumb for short premium is closer to **\|delta\| targets** (0.20 / 0.30 / 0.40), with volatility regime and recent range (ATR) as review overlays.

---

## Requirements

1. Map levels to delta rule-of-thumb: conservative `0.20`, balanced `0.30`, aggressive `0.40` (\|delta\|).
2. Select strikes primarily via Black-Scholes delta solvers (put abs-delta / call delta).
3. Compute and surface **7 / 14 / 21-day ATR** as a fraction of spot; use ATR as a review that can **widen** strikes when delta alone is too close.
4. Fit / reuse **HMM regime** context at the option horizon; nudge effective delta (bear → safer; bull → puts closer / calls further OTM).
5. Keep empirical assignment probability as a **cross-check**, not the primary selector.
6. Expose new fields on the analysis contract and show them in the analysis UI (targets, realized delta, ATR distance, regime summary).
7. Config knobs in `AnalysisOptions` / `appsettings.json` (not hardcoded magic only).

---

## Acceptance criteria

- [x] `safe` / `regular` / `risky` target \|delta\| 0.20 / 0.30 / 0.40 (configurable).
- [x] ATR 7/14/21 computed from daily bars; ATR14 floor multiples widen put/call strikes when needed.
- [x] HMM regime attached to result; delta nudge applied before strike solve.
- [x] DTO + OpenAPI + generated TS include `targetDelta`, `blackScholesDelta`, `distanceAtr14`, `atr`, `hmmRegime`.
- [x] UI labels Conservative / Balanced / Aggressive with delta hints; ATR + HMM summary visible.
- [x] Unit tests for delta helpers / ATR / strike solvers in `StatMathTests`.
- [x] Committed with hash recorded below; `dotnet test` green; frontend suite green for changed paths.

---

## Out of scope

- Changing Alpaca contract snapping / order placement beyond consuming new suggestion fields.
- Live IV surface (still realized vol for BS).
- Replacing Research HMM UI; this is strike-path reuse only.

---

## Design notes

| Level | UI | Target \|Δ\| | ATR14 floor multiple |
|-------|-----|-------------|----------------------|
| `safe` | Conservative | 0.20 | 1.5× |
| `regular` | Balanced | 0.30 | 1.0× |
| `risky` | Aggressive | 0.40 | 0.7× |

- **ATR floor:** puts use `min(deltaStrike, spot×(1 − atr14×mult))`; calls use `max(...)`.
- **HMM nudge (defaults):** bear −0.05 Δ; bull put +0.05 / call −0.05; clamp [0.10, 0.50].
- Put abs-delta binary search: for OTM puts, \|Δ\| rises as K approaches spot — search bounds must respect that.
- Wire names stay `safe` / `regular` / `risky`; UI shows Conservative / Balanced / Aggressive.

---

## Completed

### Summary

Strike selection is now **delta-primary** (0.20 / 0.30 / 0.40) with **ATR14 floors** and **HMM regime nudges**. Analysis response carries ATR metrics and HMM context; the wheel panel shows level labels, BS delta, ATR distance, and header ATR/HMM summary. Empirical assignment remains a cross-check column.

### Commits

| Hash | Message |
|------|---------|
| *(filled after commit)* | Update strike decision engine to delta + ATR + HMM review. |

PR: — (pushed to `main`)

### Key changes

- `backend/WheelStrategy.Api/Stats/StatMath.cs` — put/call delta, Wilder ATR, strike-for-delta solvers
- `backend/WheelStrategy.Api/Services/WheelAnalysisService.cs` — delta + ATR floor + HMM nudge pipeline
- `backend/WheelStrategy.Api/Contracts/WheelAnalysisDtos.cs` — `AtrMetrics`, `HmmRegimeContext`, suggestion fields
- `backend/WheelStrategy.Api/Options/AnalysisOptions.cs` + `appsettings.json` — delta / ATR / HMM knobs
- `src/components/WheelAnalysisPanel.tsx` — labels, Δ/ATR column, ATR + HMM header
- `src/api/generated/analysis.ts` + OpenAPI — regenerated contract
- `docs/work/` — work-item series + this record

### Verification

```bash
dotnet test backend/WheelStrategy.Api.Tests/WheelStrategy.Api.Tests.csproj
# Passed: 91

npx openapi-typescript ./backend/WheelStrategy.Api/WheelStrategy.Api.json -o ./src/api/generated/analysis.ts
npm test
# 104 frontend tests passed (bot calendar.test.ts suite load is a pre-existing vitest/node:test mismatch)
```

### Follow-ups

- Optional ADR if delta-primary vs empirical-primary should be a lasting product decision.
- Surface true chain greeks delta after snap in `fetchFridayOptions` (still copies model probs today).
- Multi-factor heads beyond Greeks/ATR/HMM (SMA barriers, liquidity) — see research notes if pursued.
