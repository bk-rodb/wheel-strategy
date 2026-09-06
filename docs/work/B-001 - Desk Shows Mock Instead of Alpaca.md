# B-001 — Desk Shows Mock Instead of Alpaca

| Field | Value |
|-------|-------|
| **ID** | `B-001` |
| **Type** | Bug |
| **Status** | in-progress |
| **Opened** | 2026-09-06 |
| **Closed** | — |
| **Owner** | — |
| **Related** | [E-005](./E-005%20-%20Move%20Secrets%20To%20User%20Environment.md) · [PRE_LAUNCH.md](../PRE_LAUNCH.md) · [LAUNCH.md](../LAUNCH.md) · `src/config.ts` |

---

## Prompt

> wheel desk doesn't appear to displaying actual data from Alpaca

---

## Context

The desk was rendering the canned TSLA / NVDA / AMZN / SPY book with a **MOCK DATA** badge. That is `IS_MOCK` in `src/config.ts`: mock stays on unless `VITE_USE_MOCK` is exactly `"false"`. There was no repo-root `.env`, so Vite never opted into the Alpaca proxy.

A second, stacked failure: the API process that was already running predated [E-005](./E-005%20-%20Move%20Secrets%20To%20User%20Environment.md) and had no user-secrets, so `/api/alpaca/trading/v2/account` and `/v2/positions` returned 503 even though `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY` existed as Windows user env vars.

---

## Requirements

1. Local frontend `.env` sets `VITE_USE_MOCK=false` (gitignored; workstation only).
2. Restart the API so E-005 `UserEnvironmentSecrets` can overlay the `ALPACA_*` user env vars (user-secrets remain a fallback).
3. Confirm the desk shows paper account / activity / quotes, not the mock book.

---

## Acceptance criteria

- [x] Desk top bar does **not** show **MOCK DATA**.
- [x] Account strip and activity come from Alpaca paper (not mock `PA00000000` / fake dividends).
- [x] Positions list reflects the paper book (empty is valid when no positions are open).
- [x] Watchlist search/quotes hit the proxy (NVDA live price, not the mock $118).

---

## Out of scope

- Changing the mock-on-by-default product choice for a fresh clone.
- Duplicate `ALPACA_*` mapping (already shipped in E-005).

---

## Design notes

`.env` is gitignored and holds only `VITE_*` app config. Credentials stay in Windows user env / user-secrets.

---

## Completed

*Local workstation fix; commit the work-item + Index row when asked.*

### Summary

Mock mode was on because `.env` was missing. The running API was also an older process that did not overlay `ALPACA_*`. After `VITE_USE_MOCK=false` and an API restart, the desk shows paper data.

### Verification

Browser at http://localhost:5173: no MOCK DATA badge; paper account ~$100k cash; activity includes real CAT/ORF fees and a closed NVDA put; wheel list empty (paper book has zero open positions); watchlist NVDA ~$230 from Alpaca.
