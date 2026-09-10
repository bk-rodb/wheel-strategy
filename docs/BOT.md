# Weekly wheel bot

Headless paper-trading worker under [`bot/`](../bot/). It weekly **sell-to-opens** covered calls or cash-secured puts, one independent cycle per configured symbol, at the analysis **`regular`** (MED / ~30% assignment) strike, using the same WheelStrategy.Api analysis + Alpaca proxy as the desk UI.

**Canonical package docs:** this file. Quick start also lives in [`bot/CLAUDE.md`](../bot/CLAUDE.md).

The bot holds **no Alpaca keys**. Credentials stay in Windows user environment variables on the backend (`ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY`); the bot is an HTTP client to `http://localhost:5099`.

---

## What it does (v1)

| Decision | Behavior |
|----------|----------|
| Account | Alpaca **paper** only (`Alpaca:TradingBaseUrl` = paper) |
| Universe | `BOT_SYMBOLS`, default **NVDA, SPCX, RKLB** — each symbol runs its own independent cycle **concurrently** (own shares/side/qty, own open-order gate, own dedupe state) |
| Action | **Sell-to-open** only (no buy-to-close, no rolls) |
| Strike | Analysis level `regular` (override via `BOT_LEVEL`, shared across all symbols) |
| Side | Shares ≥ 100 → covered **call**, qty = `floor(shares/100)`; else cash-secured **put**, qty = 1 |
| Limit | Live mid → bid → Black-Scholes est premium (desk parity) |

**Not in v1:** live money, rolls, BTC, NYSE holiday calendar, SSE fill relay. Covered-call early close is **scaffolded** in [`bot/src/earlyClose.ts`](../bot/src/earlyClose.ts) but not wired into the loop. A failed cycle for one symbol is logged and does not block the others.

---

## Prerequisites

Same backend setup as live desk trading — see [PRE_LAUNCH.md](./PRE_LAUNCH.md).

1. Backend running: `cd backend/WheelStrategy.Api && dotnet run` → http://localhost:5099
2. Paper Alpaca keys as Windows user env vars (`ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`)
3. `Alpaca:TradingBaseUrl` = `https://paper-api.alpaca.markets`
4. `AlpacaProxy:AllowOrderPlacement` = `true` when you want real paper orders (not only dry-run)
5. Paper account holds NVDA shares if you want the covered-call path (≥100)

Health check: `curl http://localhost:5099/health` → `{"status":"ok"}`

---

## Setup

```bash
cd bot
cp .env.example .env
npm install
```

### Environment (`bot/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_API_BASE` | `http://localhost:5099` | Analysis + Alpaca proxy base URL |
| `BOT_SYMBOLS` | `NVDA,SPCX,RKLB` | Universe — comma-separated |
| `BOT_LEVEL` | `regular` | `safe` \| `regular` \| `risky` |
| `BOT_DRY_RUN` | `true` | **Do not** POST `/v2/orders` when true |
| `BOT_PAUSED` | `false` | When true, every symbol is skipped each window |
| `BOT_POLL_MS` | `5000` | Poll interval while a working order is open |
| `BOT_REPRICE_ENABLED` | `false` | When true, cancel+reprice+resubmit unfilled live orders instead of waiting until session close |
| `BOT_REPRICE_TIMEOUT_MS` | `30000` | How long to wait for a fill before repricing (only when `BOT_REPRICE_ENABLED=true`) |
| `BOT_REPRICE_MAX_ATTEMPTS` | `3` | Max reprice/resubmit attempts before giving up and recording `canceled` |

Symbols run **fully concurrently** (not sequentially) — each with its own independent open-order
gate, journal gate, and reprice loop, so a slow-filling order on one symbol never blocks another
from being tried in the same run. Concurrent cycles do not serialize their pre-trade
buying-power/collateral checks against each other (each reads the account snapshot independently);
this is an accepted low-stakes race on a paper account, not something the bot guards against.

**Source of truth** for symbols / level / dry-run / paused is `bot/.env` — the bot never reads governance settings from the API. On every cycle it self-reports its env-sourced settings via `POST /api/bot/config`, so the desk **BOT** tab (`GET /api/bot/config`) mirrors what the bot is actually doing; the tab is read-only and cannot override `.env`. `BOT_API_BASE` and `BOT_POLL_MS` stay file-only always.

**Always keep dry-run ON** (`BOT_DRY_RUN=true`) until a ticket looks correct, then set `BOT_DRY_RUN=false` and restart the worker.

---

## How to run

```bash
# From bot/
npm start          # Long-running worker
npm run once       # One-shot: place only if Mon/Tue entry window is open, else exit
npm test           # Calendar window unit tests

# From repo root (after npm install in bot/)
npm run bot
npm run bot:once
npm run bot:test
```

### Process modes

| Mode | Command | Behavior |
|------|---------|----------|
| **Worker** | `npm start` | Waits for the Mon/Tue window, runs one sell-to-open cycle, sleeps until the next Monday open, repeats |
| **Once** | `npm run once` | Evaluates the window once: runs the cycle if Mon/Tue; if Wed–Sun / Mon pre-open, logs and **exits** (no sleep). Useful for Task Scheduler or manual paper checks |

Both modes refuse to start if the API is unreachable.

**Unattended on this Windows PC:** keep the API up at logon and schedule `--once` for Mon/Tue 9:35 ET. Step-by-step: [runbooks/unattended-nvda-bot.md](./runbooks/unattended-nvda-bot.md).

---

## Entry window (America/New_York)

| When | Behavior |
|------|----------|
| **Monday** at/after 9:30 ET | Place for **this** Friday expiry |
| **Tuesday** | Same — place for **this** Friday |
| **Wed–Fri** | Do **not** place; worker sleeps until **next Monday** (then targets that week's Friday) |
| Weekend / Monday pre-open | Wait until Monday 9:30 ET |

There is no NYSE holiday calendar yet — on a Monday holiday the bot may still attempt a day order.

---

## Cycle (one week)

```text
self-report config → for each symbol (concurrently):
  positions → side/qty → analysis(level) → snap listed contract
  → pre-trade gates → dry-run log  OR  day limit sell_to_open → poll → (reprice?) → cancel at session end
```

1. Self-report env config to the API once per window. If `paused`, write one skipped run and stop.
2. For each symbol — run concurrently, not sequentially — skip if last-cycle (API, else `bot/data/last-cycle-{symbol}.json`) already records a successful dry-run / place / fill for this Friday.
3. Skip if an open option order already exists for that symbol.
4. `GET /api/analysis/wheel?symbol=…&dte=…&granularity=daily` → pick the configured level.
5. Snap nearest standard 100-multiplier listed contract for the target Friday.
6. Pre-trade blockers: coverage (calls), collateral / options buying power (puts), fat-finger vs mid, tradable flag.
7. Dual-write the run to `bot/data/runs.jsonl` and `POST /api/bot/runs`.
8. Live paper: `POST /api/alpaca/trading/v2/orders` with stable `client_order_id`; poll until filled / canceled / rejected; cancel unfilled near ET session close.
9. **If `BOT_REPRICE_ENABLED=true`**: instead of polling until session close, poll only up to `BOT_REPRICE_TIMEOUT_MS`. If still unfilled, cancel, recompute the ladder from scratch (fresh analysis + spot — the original strike may no longer be right), re-check pre-trade, and resubmit — up to `BOT_REPRICE_MAX_ATTEMPTS` times. A pre-trade block on a recomputed ladder stops repricing immediately (`status=blocked`); exhausting all attempts while still unfilled cancels and records `status=canceled`.

### Idempotency

- Stable `client_order_id` so a retried POST reconciles instead of double-submitting.
- Per-symbol last-cycle in the API (and local `last-cycle-{symbol}.json`) remember the week. Re-arm from the desk BOT tab instead of editing files.

---

## Layout

```text
bot/
  package.json
  .env.example
  README.md                 # short pointer + quick start
  src/
    index.ts                # worker loop + --once
    config.ts               # env
    calendar.ts             # Mon/Tue window, target Friday, sleep-until
    cycle.ts                # one sell-to-open cycle
    http.ts                 # API client (no secrets)
    positions.ts            # shares + account
    fridayLadder.ts         # analysis + snap + quotes
    orders.ts               # place / poll / cancel
    preTrade.ts             # risk gates
    state.ts                # runs.jsonl + last-cycle.json
    earlyClose.ts           # CC early-close scaffold (unused)
    calendar.test.ts
  data/                     # gitignored — runtime logs
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot reach WheelStrategy.Api` | Backend down | `dotnet run` in `backend/WheelStrategy.Api` |
| `--once` exits without ticket | Outside Mon/Tue window | Expected mid-week; use `npm start` or wait until Monday |
| Dry-run looks good but no order | `BOT_DRY_RUN=true` in `bot/.env` | Set `BOT_DRY_RUN=false` in `bot/.env` and restart the worker — the desk BOT tab cannot turn this off, it only mirrors what the bot last reported |
| `403 Order entry disabled` | Proxy kill switch | Set `AlpacaProxy:AllowOrderPlacement` true |
| `503` from Alpaca proxy | Missing backend secrets | Set `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` as Windows user env vars; restart the API |
| Skipped: already completed | Idempotency for this Friday | Re-arm that symbol on the desk BOT tab |
| Skipped: open option order | Working order on that symbol | Cancel in the desk UI or Alpaca paper dashboard |
| Blocked: need 100 shares | Flat or under 100 shares | Put path needs cash; call path needs ≥100 shares |

---

## Safety checklist (paper)

1. Confirm paper TradingBaseUrl (not `api.alpaca.markets`).
2. Dry-run once on a Monday or Tuesday (`BOT_DRY_RUN=true` in `bot/.env`) → `npm run once` → inspect the BOT tab history (and `bot/data/runs.jsonl`).
3. Set `BOT_DRY_RUN=false` in `bot/.env`, re-arm any symbol already recorded as dry-run for this Friday on the desk BOT tab, run again.
4. Watch the order in the Alpaca paper dashboard or desk blotter; cancel if unwanted.

---

## Automation

**Today (local Windows PC):** Task Scheduler + `--once`. Playbook: [runbooks/unattended-nvda-bot.md](./runbooks/unattended-nvda-bot.md).

**Planned (not implemented):** N8N scheduling, HTTP trigger mode (`--serve`), Slack + email notifications. Spec: [BOT_AUTOMATION.md](./BOT_AUTOMATION.md). Backlog: [ROADMAP.md](./ROADMAP.md).

---

## Future (not implemented)

- **Early close (CC only):** if a short covered call is profitable to BTC and next week's regular CC still looks good, close and reopen — stub in `evaluateEarlyCloseCoveredCall`.
- Multi-ticker universe, rolls, holiday calendar, server-side SSE fill relay.

See [ROADMAP.md](./ROADMAP.md) for the full backlog.
