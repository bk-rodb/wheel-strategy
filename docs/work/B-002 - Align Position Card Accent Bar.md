# B-002 — Align Position Card Accent Bar

| Field | Value |
|-------|-------|
| **ID** | `B-002` |
| **Type** | Bug |
| **Status** | in-progress |
| **Opened** | 2026-09-14 |
| **Closed** | — |
| **Owner** | — |
| **Related** | `src/components/PositionCard.tsx` · `src/components/SummaryDashboard.tsx` |

---

## Prompt

> SPCX doesn't match RKLB in size and format. the highlight line at the top is not in the right place

---

## Context

Dashboard position cards are `<button>` grid items. `button { all: unset }` resets `box-sizing` to `content-box`, and the card does not fill as a flex column, so leftover height from CSS Grid stretch is absorbed as mysterious vertical offset.

SPCX's company name (`Space Exploration Technologies Corp. Class A Common Stock`) wraps to two lines; RKLB's fits on one. The extra line eats the leftover stretch, so SPCX's 2px phase accent sits on the clipped rounded top while RKLB's sits ~6px lower as a full-width stripe. Cards look different in size, format, and accent placement even though they share one renderer.

---

## Requirements

1. Every position card uses the same chrome: accent stripe flush with the top interior, then header / phase / sparkline / metrics.
2. Company names truncate to one line (ellipsis) so a long legal name cannot change card geometry.
3. Card buttons fill the grid cell with a column flex layout and `border-box` sizing so content height cannot shift the accent.
4. NVDA / RKLB / SPCX (and any other book name) are **one** `PositionCard` instance per row — no per-ticker markup in `SummaryDashboard`.

---

## Acceptance criteria

- [x] SPCX, RKLB, and NVDA cards are the same height and share the same internal stacking.
- [x] The phase-color highlight is a full-width 2px bar at the top of every card (same offset).
- [x] Long company names do not wrap; they ellipsize.
- [x] Dashboard tiles are one `PositionCard` mapped over `positions` (no per-ticker branches).
- [x] Tests / checks: visual on Dashboard (paper book with NVDA / RKLB / SPCX); `npm test -- src/components/PositionCard.test.tsx src/components/SummaryDashboard.test.tsx`.

---

## Out of scope

- Changing how company names are fetched from Alpaca.
- Redesigning the card (new metrics, sparkline behavior).

---

## Design notes

Keep the accent as an in-flow first flex child (`flexShrink: 0`) rather than relying on Grid leftover space. Absolute positioning would overlay the ticker; a `border-top` fights the existing hover `borderColor` swap.

`PositionCard` is the single tile renderer. `SummaryDashboard` only maps `positions` into it — NVDA / RKLB / SPCX are data, not separate controls. Watchlist rows (`WatchlistItem`) and option-leg cards (`OptionCard`) are different surfaces.
