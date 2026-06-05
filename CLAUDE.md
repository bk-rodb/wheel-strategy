# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (hot reload)
npm run build      # Type-check (tsc -b) then build for production
npm run preview    # Serve the production build locally
```

No test runner is configured.

## Architecture

This is a single-page React + TypeScript app built with Vite. It's a **Wheel Strategy options trading dashboard** — a UI for tracking the three phases of the wheel: Cash-Secured Put → Stock Holding → Covered Call.

### Key files

- **[WheelDashboard.tsx](WheelDashboard.tsx)** — monolithic root file containing all types, mock data, sub-components, the API hook, and the root `WheelDashboard` component. The `src/components/` files appear to be extracted duplicates of some of these components but are not currently imported anywhere.
- **[src/data/mockPositions.ts](src/data/mockPositions.ts)** — mock `WheelPosition[]` data (mirrored in the root file).
- **[src/utils/formatters.ts](src/utils/formatters.ts)** — currency/compact/percent formatters (mirrored as `fmt` in the root file).

### Data flow

`useWheelPositions` hook → `WheelDashboard` (root) → tab selection → either `SummaryDashboard` (portfolio overview) or `TickerDetail` (per-ticker drill-down).

The hook is wired for real API integration. Comments in `useWheelPositions` document the intended backend endpoints:
- E\*TRADE `/v1/accounts/{id}/portfolio` for positions/shares/cost basis
- Alpaca `/v2/stocks/{symbol}/quotes/latest` for real-time prices
- Polygon `/v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}` for 30-day history
- E\*TRADE `/v1/market/optionchains` for the active option leg
- yFinance (via a .NET proxy) as a price history fallback

The refresh interval is 5 minutes. Until real endpoints exist, `MOCK_POSITIONS` is returned after a simulated 600 ms delay.

### Phase color coding

| Phase | Label | Color |
|---|---|---|
| cash-secured-put | CSP | amber `#f59e0b` |
| stock-holding | STOCK | blue `#60a5fa` |
| covered-call | CC | green `#34d399` |

DTE urgency: ≤7 days = red, ≤14 days = amber, otherwise green.
