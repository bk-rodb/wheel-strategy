# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local setup and launch

- **First-time setup:** [docs/PRE_LAUNCH.md](docs/PRE_LAUNCH.md) — requirements, `npm install`, `.env`, backend user-secrets
- **Run the app:** [docs/LAUNCH.md](docs/LAUNCH.md) — `npm run dev` + `dotnet run`

## Commands

```bash
# Frontend (repo root)
npm run dev        # Start Vite dev server (hot reload) on http://localhost:5173
npm run build      # Type-check (tsc -b) then build for production
npm run preview    # Serve the production build locally
npm test           # vitest run
npm run test:watch
npm run gen:api    # Regenerate src/api/generated/analysis.ts from the backend OpenAPI doc
npm run check:api  # Regenerate + fail if the committed generated types/openapi are stale

# Backend analysis API (backend/WheelStrategy.Api)
dotnet run         # Serves http://localhost:5099 (launchSettings sets Development env)
dotnet build       # Compile only
```

## Mission

This application is a **trading desk**. The long-term goal is a single cockpit for running trades end to end — research, analysis, execution, and position management. It is **currently focused on options trading, and specifically the wheel strategy** (Cash-Secured Put → Stock Holding → Covered Call). Treat "wheel dashboard" as today's scope, not the ceiling: features should be built so the desk can grow to other options strategies and, eventually, other asset classes.

Concretely, the app already does more than *track* the wheel — it **executes** it. It fetches live Alpaca option chains, snaps the analysis backend's strike suggestions to listed contracts, and places / cancels real sell-to-open orders (paper or live, per the Alpaca key in use). See **Order execution layer** below.

## Architecture

A React + TypeScript SPA (Vite) — the **Wheel Strategy trading desk**: it tracks the three phases of the wheel, surfaces data-driven strike suggestions, and places option orders — plus a **.NET 10 analysis backend** (`backend/WheelStrategy.Api`) that computes those strike suggestions.

> The **live app entry is [src/WheelDashboard.tsx](src/WheelDashboard.tsx)** (rendered by `src/main.tsx`), composing the `src/components/` and `src/hooks/` files.

### Key files (frontend)

- **[src/WheelDashboard.tsx](src/WheelDashboard.tsx)** — root component: broker/account state, tab system (Dashboard + per-position tabs + closeable opened-watchlist-ticker tabs).
- **[src/data/mockPositions.ts](src/data/mockPositions.ts)** — mock `WheelPosition[]`. **[src/utils/formatters.ts](src/utils/formatters.ts)** — `fmt` currency/compact/percent helpers.
- The browser calls Alpaca directly via [src/api/alpacaClient.ts](src/api/alpacaClient.ts) for prices/positions/**option chains and orders**; it calls the .NET backend via [src/api/fetchWheelAnalysis.ts](src/api/fetchWheelAnalysis.ts) for analysis. `API_BASE` comes from `VITE_API_BASE_URL` (default `http://localhost:5099`).
- **`alpacaClient` exposes two clients:** `trading` (base `VITE_ALPACA_BASE_URL`, e.g. `paper-api.alpaca.markets` — accounts, positions, **option contracts, orders**) and `marketData` (base `VITE_ALPACA_DATA_URL`, e.g. `data.alpaca.markets` — quotes, bars, **option snapshots**). `trading.post`/`delete` send `Content-Type: application/json`; every GET omits it (see the CORS note under the analysis backend).

### Order execution layer

The desk can sell-to-open the next-Friday put/call and manage that order — end to end, with a mock path so it works without live keys.

- **[src/api/fetchFridayOptions.ts](src/api/fetchFridayOptions.ts)** — builds a `FridayOptionsBundle`: calls `fetchWheelAnalysis` for the next Friday's DTE, takes the safe/regular/risky (LOW/MED/HIGH) strikes, snaps each to the **nearest listed contract** from Alpaca's option-contracts endpoint, and enriches with live **bid/ask/mid** from `/v1beta1/options/snapshots`. `sellLimit` = mid → bid → estimated premium. Side is `call` when ≥100 shares are held (covered call), else `put` (cash-secured). In `IS_MOCK` mode (or when no contracts list), premiums fall back to the backend's Black-Scholes estimate, contract symbols use `buildOsiSymbol`, `tradable` is true, and orders are simulated in-browser.
- **[src/api/optionOrders.ts](src/api/optionOrders.ts)** — the Alpaca Orders wrapper: `placeOptionOrder` (sell-to-open, limit or market), `getOrder`, `cancelOrder`, and `waitForOrderAcceptance` / `waitForOrderCanceled` pollers, plus status predicates (`isOrderOpen`/`Cancelable`/`Filled`/…) and `listOpenOptionOrdersForUnderlying` (OSI-symbol → underlying matching). Mock mode keeps an in-session order store so place → poll → cancel behaves realistically. **Acceptance ≠ fill:** an `accepted`/`new` order is working and still cancelable; only `filled` is terminal.
- **[src/hooks/usePendingOptionOrder.ts](src/hooks/usePendingOptionOrder.ts)** — enforces **at most one live option order per underlying** through a phase machine (`idle → submitting → awaiting_acceptance → open → canceling → awaiting_cancel → filled/canceled`). Resumes an already-open order on mount, `locked` gates other SELLs, and a cancel must be **confirmed** by the venue before SELL re-enables.
- **[src/components/OpenOptionsSection.tsx](src/components/OpenOptionsSection.tsx)** — the UI: renders the LOW/MED/HIGH Friday ladder (strike, % OTM, empirical/BS assignment, live bid/ask, suggested limit), an inline SELL confirm with quantity, and the working-order / cancel banner. Embedded in **[TickerDetail](src/components/TickerDetail.tsx)** (held position; shows the existing `activeOption` when present) and **[WatchlistTickerDetail](src/components/WatchlistTickerDetail.tsx)** (research view, `shares=0` → cash-secured puts). **[src/utils/nextFriday.ts](src/utils/nextFriday.ts)** computes the expiration/DTE.

### Analysis backend

`GET /api/analysis/wheel?symbol=NVDA&dte=35&lookbackDays=730&granularity=weekly` returns safe/regular/risky strike suggestions for both the cash-secured put and covered call. Each suggestion carries an **empirical** assignment probability (percentile of the stock's own historical forward returns over a DTE-matched horizon) **and** a **Black-Scholes** assignment probability (from realized volatility), plus estimated premium and annualized yield. 2yr weekly bars are fetched from Alpaca (adjusted), cached in SQLite (`HistoricalBar`), and refreshed incrementally. Layers: `Endpoints/` → `Services/WheelAnalysisService` → `Services/BarCacheService` + `Alpaca/AlpacaMarketDataClient`, with pure-`double` math in `Stats/StatMath`. Surfaced in the UI inside [src/components/WheelAnalysisPanel.tsx](src/components/WheelAnalysisPanel.tsx), embedded in [src/components/WatchlistTickerDetail.tsx](src/components/WatchlistTickerDetail.tsx).

**Analysis contract is single-sourced from the backend.** The wire shape lives in `Contracts/WheelAnalysisDtos.cs` (`WheelAnalysisResult`/`StrikeSuggestion`). On `dotnet build` the API emits `backend/WheelStrategy.Api/WheelStrategy.Api.json` (OpenAPI); `npm run gen:api` turns that into `src/api/generated/analysis.ts`, which `src/types.ts` re-exports as `WheelAnalysis`/`StrikeSuggestion` (narrowing `level` to the `"safe"|"regular"|"risky"` union). **Do not hand-edit the analysis types in `src/types.ts` or the generated file** — change the C# DTO, rebuild, and run `npm run gen:api`. `npm run check:api` fails the build if either committed artifact is stale. A schema transformer in `Program.cs` collapses .NET 10's `number|string` numeric unions so generated fields stay `number`. Note: `EnsureCreated` builds only the `HistoricalBar` cache table — the backend has no other persistence layer.

⚠️ Alpaca's market-data API rejects a `Content-Type` header on GET requests (CORS preflight fails). Both the browser and backend clients deliberately omit it.

### Data flow

`useWheelPositions` hook → `src/WheelDashboard.tsx` → tab selection → `SummaryDashboard`, `TickerDetail` (held position), or `WatchlistTickerDetail` (opened-from-watchlist research view, which embeds the analysis panel).

The hook is wired for real API integration. Comments in `useWheelPositions` document the intended backend endpoints:
- E\*TRADE `/v1/accounts/{id}/portfolio` for positions/shares/cost basis
- Alpaca `/v2/stocks/{symbol}/quotes/latest` for real-time prices
- Polygon `/v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}` for 30-day history
- E\*TRADE `/v1/market/optionchains` for the active option leg
- yFinance (via a .NET proxy) as a price history fallback

The refresh interval is 5 minutes. When `VITE_ALPACA_API_KEY_ID` is unset (`IS_MOCK`), mock positions are returned after a simulated 600 ms delay; otherwise positions load from Alpaca via `fetchWheelPositions`.

### Phase color coding

| Phase | Label | Color |
|---|---|---|
| cash-secured-put | CSP | amber `#f59e0b` |
| stock-holding | STOCK | blue `#60a5fa` |
| covered-call | CC | green `#34d399` |

DTE urgency: ≤7 days = red, ≤14 days = amber, otherwise green.
