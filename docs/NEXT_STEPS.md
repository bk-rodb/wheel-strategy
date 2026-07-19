# Wheel Desk — Suggested Features & Next Steps

Setup and run: [PRE_LAUNCH.md](./PRE_LAUNCH.md) · [LAUNCH.md](./LAUNCH.md)

**Mission:** this is a **trading desk**, currently focused on the wheel strategy —
research, analysis, execution, and position management in one cockpit. The items
below are roughly ordered by value-to-effort; keep building so the desk can grow
to other options strategies and asset classes.

Status snapshot (2026-06-04): the wheel-strategy **analysis API** is live end-to-end.
A .NET 10 backend (`backend/WheelStrategy.Api`) serves
`GET /api/analysis/wheel`, returning safe/regular/risky strike suggestions for
the cash-secured put and covered call, each annotated with an empirical
(historical-percentile) and a Black-Scholes assignment probability, estimated
premium, and annualized yield. It's surfaced in the UI via `WheelAnalysisPanel`
embedded in `WatchlistTickerDetail`.

Status snapshot (2026-07-18): **order execution shipped.** The desk now fetches the
next-Friday option chain from Alpaca, snaps the safe/regular/risky strikes to
listed contracts, prices them from live snapshots, and **sells-to-open** with a
single-working-order lifecycle (place → accept → cancel-with-confirm), plus a full
mock path. See `fetchFridayOptions.ts`, `optionOrders.ts`, `usePendingOptionOrder.ts`,
and `OpenOptionsSection.tsx`. This delivered two items previously listed below —
**live option-chain integration** and **snapping strikes to real option grids**.

## Near-term (high value, low effort)

- **Daily-granularity toggle in the UI.** The backend already accepts
  `granularity=daily` (~480 overlapping samples vs ~99 weekly), which tightens
  the percentile tails. Add a weekly/daily switch next to the DTE selector and
  pass it through `useWheelAnalysis`. Surface `sampleCount` prominently so the
  user sees the tradeoff.
- **Distribution visualization.** Render a small histogram / density of the
  forward-return distribution with the three put and three call strikes marked.
  Makes "safe/regular/risky" intuitive at a glance.
- **Persist DTE / lookback / granularity preferences** (localStorage, like the
  watchlist store) so the panel remembers the user's settings per session.
- ~~**Tighten strike rounding to real option grids.**~~ ✅ **Done** —
  `fetchFridayOptions` snaps each suggested strike to the nearest listed Alpaca
  contract. (The backend's `RoundStrike` flat grid is still used for the *analysis*
  numbers; the execution layer overrides it with the real chain.)

## Medium-term (deeper analysis)

- ~~**Live option-chain integration.**~~ ✅ **Done for bid/ask** — the execution
  layer prices the Friday ladder from real `/v1beta1/options/snapshots` quotes.
  *Still open:* surface the true **delta** (so "regular ≈ 0.30 delta" uses the
  option's own delta rather than the model's assignment probability).
- **Implied vs realized volatility.** Show option-implied vol alongside the
  realized vol the model uses; a large gap is itself a signal (rich/cheap premium).
- **Backtest the suggestions.** For each historical date, compute what the
  "regular" strike would have been and whether it expired OTM, to validate that
  the empirical percentiles actually deliver the targeted assignment rates.
- **Dividend & earnings awareness.** Skip/flag expirations spanning an earnings
  date (vol crush / gap risk) and incorporate dividend yield into Black-Scholes.
- **Multi-symbol / portfolio view.** Run the analysis across the whole watchlist
  and rank by annualized yield at a chosen assignment-probability level.

## Backend hardening

- **Convert `EnsureCreated()` to EF migrations.** The context now builds only the
  `HistoricalBar` cache table (the dead BrokerAccount/Position/OptionLeg models were
  removed), but it still has no migrations. Before any schema change, run
  `dotnet ef migrations add InitialCreate` — `EnsureCreated` and migrations do not
  coexist. (`EntityFrameworkCore.Tools` is already referenced.)
- **Background bar refresh.** A hosted `BackgroundService` could pre-warm/refresh
  the `HistoricalBar` cache for watchlisted symbols off the request path.
- **Unit tests for `StatMath`.** Quantile (type-7), `NormCdf` (erf approximation),
  and Black-Scholes prices/probabilities are pure and easily testable — lock them
  down with known-value tests. (No test project exists yet.)
- **Resilience:** retry/backoff on Alpaca, handle SIP-vs-IEX feed differences,
  and detect missing-week gaps in the bar sequence (currently only warned about).

## Known modeling caveats (document for users, not bugs)

- **Empirical vs Black-Scholes gap is expected.** A trending stock (e.g. NVDA's
  uptrend) makes historical downside rarer than a zero-drift lognormal model
  predicts, so the empirical put-assignment prob can sit well below the BS prob.
  Both are shown on purpose; treat BS as the harder estimate.
- **Risky strikes can land near/through the money** when the forward-return
  distribution is strongly skewed by trend (the 45th-percentile move is positive).
  `pctFromSpot` keeps this transparent; consider clamping to OTM if a strictly-OTM
  convention is preferred.
- **Overlapping windows** mean the empirical percentile confidence intervals are
  wider than the raw sample count implies — another reason to prefer daily
  granularity and to lean on the BS probability.
