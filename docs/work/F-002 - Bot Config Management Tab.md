# F-002 — Bot Config Management Tab

| Field | Value |
|-------|-------|
| **ID** | `F-002` |
| **Type** | Feature |
| **Status** | done |
| **Opened** | 2026-09-06 |
| **Closed** | 2026-09-06 |
| **Owner** | — |
| **Related** | [BOT.md](../BOT.md) · [ROADMAP.md](../ROADMAP.md) F-5 (multi-ticker, done) · [unattended runbook](../runbooks/unattended-nvda-bot.md) |

---

## Prompt

> determine if we can add a bot configuration and management tab or section can be added to the UI
> review plan as bot has changed
> build the bot tab

---

## Context

The weekly bot is a separate Node worker (`bot/`) that reads `BOT_SYMBOLS` / `BOT_LEVEL` / `BOT_DRY_RUN` from `bot/.env` and writes per-symbol last-cycle files plus `runs.jsonl`. The desk SPA cannot see those files. Bot-sourced order-journal rows only cover placed/canceled paper orders — skips, dry-runs, and blocks never reach the API.

v1 persists shared settings (symbol list, level, dry-run, paused) and per-symbol last-cycle + run history in WheelStrategy.Api. The worker still starts via Task Scheduler / `npm start`; it reads API config once per `runOnce` and dual-writes runs.

---

## Requirements

1. Dedicated BOT tab on the desk (not a dashboard section).
2. API is source of truth for symbols / level / dry-run / paused; env is fallback if config GET fails.
3. Per-symbol last-cycle and run history in SQLite; desk can re-arm one symbol or all.
4. Shared pause skips the whole window without stopping the process.
5. Dry-run off and re-arm require an inline confirm.

---

## Acceptance criteria

- [x] `GET /api/bot/config` seeds defaults (`NVDA,SPCX,RKLB` / `regular` / dry-run true / not paused) and never 404s
- [x] `POST /api/bot/config` validates ticker list (1–20 unique) and level
- [x] Bot uses API symbols/level/dry-run when GET succeeds; honors pause; dual-writes runs/last-cycle
- [x] Desk BOT tab edits config, shows per-symbol status, filters history, re-arms with confirm
- [x] `IS_MOCK` shows in-memory config/history so the tab renders without the API
- [ ] Tests / checks: `dotnet test` (BotConfigServiceTests 6/6), `npm run bot:test` (18/18), `npm run gen:api`; browser pass on the BOT tab. Full `npm test` currently fails in this workspace with a vitest `describe.config` error on pre-existing suites (not unique to this tab).

---

## Out of scope

- Start/stop/spawn the Node process
- HTTP `--serve` / desk “Run now”
- Per-symbol level, dry-run, or pause
- Writing `bot/.env` from the API
- Desk-wide `AllowOrderPlacement` kill switch

---

## Design notes

CORS allows GET/POST/DELETE only — config writes are POST. Last-cycle is one row per symbol. Removing a ticker from the list is how you stop trading it.

---

## Completed

### Summary

Desk BOT tab plus API persistence for shared bot knobs (symbols, level, dry-run, paused) and per-symbol last-cycle / run history. The Node worker still starts via Task Scheduler / npm; it reads API config once per `runOnce` and dual-writes runs. Env is fallback if config GET fails.

### Commits

| Hash | Message |
|------|---------|
| *(filled after commit)* | |

PR: —

### Key changes

- `backend/WheelStrategy.Api` — BotSettings / BotRun / BotLastCycle, `/api/bot/*` endpoints, EF migration
- `bot/src` — load API config per window, pause skip, dual-write runs/last-cycle
- `src/components/BotPanel.tsx` + `src/WheelDashboard.tsx` — BOT tab
- `src/api/fetchBot.ts` — desk client (`IS_MOCK` in-memory path)

### Verification

```bash
dotnet test backend/WheelStrategy.Api.Tests --filter BotConfigServiceTests
npm run bot:test
npm run gen:api
# Browser: BOT tab — edit level, add symbol, pause confirm; DASHBOARD still loads
```

### Follow-ups

- Turn dry-run off on the BOT tab when paper orders should resume (API seed is dry-run on; `bot/.env` no longer wins while the API is up)
- `--serve` / desk “Run now” remains roadmap F-1
- Full `npm test` was failing in this workspace with a vitest `describe.config` error on existing suites; vitest now excludes `bot/**`
