# Wheel Desk — Suggested Features & Next Steps

Status snapshot (2026-06-04): the wheel-strategy **analysis API** is live end-to-end.
A .NET 10 backend (`backend/WheelStrategy.Api`) serves
`GET /api/analysis/wheel`, returning safe/regular/risky strike suggestions for
the cash-secured put and covered call, each annotated with an empirical
(historical-percentile) and a Black-Scholes assignment probability, estimated
premium, and annualized yield. It's surfaced in the UI via `WheelAnalysisPanel`
embedded in `WatchlistTickerDetail`.

This doc lists where to take it next, roughly ordered by value-to-effort.

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
- **Tighten strike rounding to real option grids.** `RoundStrike` currently uses
  a flat $1 / $0.50 grid. Pull the actual listed strikes from Alpaca's option
  chain and snap to them.

## Medium-term (deeper analysis)

- **Live option-chain integration.** Replace (or cross-check) the Black-Scholes
  *estimated* premium with the real bid/ask and actual delta from
  `/v1beta1/options/snapshots`. This makes the premium/yield numbers tradeable
  rather than theoretical, and lets "regular ≈ 0.30 delta" use the true delta.
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

- **Convert `EnsureCreated()` to EF migrations.** The whole `WheelStrategyDbContext`
  (including the pre-existing BrokerAccount/Position/OptionLeg entities) has no
  migrations. Before any schema change, run `dotnet ef migrations add InitialCreate`
  — `EnsureCreated` and migrations do not coexist. (`EntityFrameworkCore.Tools`
  is already referenced.)
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
