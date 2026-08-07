# Weekly NVDA wheel bot

Headless paper-trading worker under [`bot/`](../bot/). It weekly **sell-to-opens** NVDA covered calls or cash-secured puts at the analysis **`regular`** (MED / ~30% assignment) strike, using the same WheelStrategy.Api analysis + Alpaca proxy as the desk UI.

**Canonical package docs:** this file. Quick start also lives in [`bot/README.md`](../bot/README.md).

The bot holds **no Alpaca keys**. Credentials stay in backend user-secrets; the bot is an HTTP client to `http://localhost:5099`.

---

## What it does (v1)

| Decision | Behavior |
|----------|----------|
| Account | Alpaca **paper** only (`Alpaca:TradingBaseUrl` = paper) |
| Universe | **NVDA** only |
| Action | **Sell-to-open** only (no buy-to-close, no rolls) |
| Strike | Analysis level `regular` (override via `BOT_LEVEL`) |
| Side | Shares ≥ 100 → covered **call**, qty = `floor(shares/100)`; else cash-secured **put**, qty = 1 |
| Limit | Live mid → bid → Black-Scholes est premium (desk parity) |

**Not in v1:** live money, multi-ticker, rolls, BTC, NYSE holiday calendar, SSE fill relay. Covered-call early close is **scaffolded** in [`bot/src/earlyClose.ts`](../bot/src/earlyClose.ts) but not wired into the loop.

---

## Prerequisites

Same backend setup as live desk trading — see [PRE_LAUNCH.md](./PRE_LAUNCH.md).

1. Backend running: `cd backend/WheelStrategy.Api && dotnet run` → http://localhost:5099
2. Paper Alpaca keys in user-secrets (`Alpaca:ApiKeyId`, `Alpaca:ApiSecretKey`)
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
| `BOT_SYMBOL` | `NVDA` | Underlying (v1 is single-ticker) |
| `BOT_LEVEL` | `regular` | `safe` \| `regular` \| `risky` |
| `BOT_DRY_RUN` | `true` | Log the ticket; **do not** POST `/v2/orders` |
| `BOT_POLL_MS` | `5000` | Poll interval while a working order is open |

**Always keep `BOT_DRY_RUN=true` until a dry-run ticket looks correct**, then set `false` for paper fills.

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
positions(NVDA) → side/qty → analysis(regular) → snap listed contract
  → pre-trade gates → dry-run log  OR  day limit sell_to_open → poll → cancel at session end
```

1. Skip if `bot/data/last-cycle.json` already records a successful dry-run / place / fill for this Friday.
2. Skip if an open option order already exists for NVDA.
3. `GET /api/analysis/wheel?symbol=NVDA&dte=…&granularity=daily` → pick `level === BOT_LEVEL`.
4. Snap nearest standard 100-multiplier listed contract for the target Friday.
5. Pre-trade blockers: coverage (calls), collateral / options buying power (puts), fat-finger vs mid, tradable flag.
6. Dry-run: print ticket JSON and append `bot/data/runs.jsonl`.
7. Live paper: `POST /api/alpaca/trading/v2/orders` with stable `client_order_id` (`bot-nvda-{expiry}-{side}-{date}`); poll until filled / canceled / rejected; cancel unfilled near ET session close.

### Idempotency

- Stable `client_order_id` so a retried POST reconciles instead of double-submitting.
- `bot/data/last-cycle.json` + `runs.jsonl` remember the week. To re-fire the same Friday after a dry-run, delete or edit `bot/data/last-cycle.json` (or wait for the next target Friday).

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
| Dry-run looks good but no order | `BOT_DRY_RUN=true` | Set `BOT_DRY_RUN=false` in `bot/.env` |
| `403 Order entry disabled` | Proxy kill switch | Set `AlpacaProxy:AllowOrderPlacement` true |
| `503` from Alpaca proxy | Missing backend secrets | `dotnet user-secrets set` for both Alpaca keys |
| Skipped: already completed | Idempotency for this Friday | Clear `bot/data/last-cycle.json` only if you intend to re-run |
| Skipped: open option order | Working order on NVDA | Cancel in the desk UI or Alpaca paper dashboard |
| Blocked: need 100 shares | Flat or under 100 NVDA | Put path needs cash; call path needs ≥100 shares |

---

## Safety checklist (paper)

1. Confirm paper TradingBaseUrl (not `api.alpaca.markets`).
2. Dry-run once on a Monday or Tuesday: `BOT_DRY_RUN=true` → `npm run once` → inspect console + `bot/data/runs.jsonl`.
3. Flip `BOT_DRY_RUN=false`, clear `last-cycle.json` if that Friday was already recorded as dry-run, run again.
4. Watch the order in the Alpaca paper dashboard or desk blotter; cancel if unwanted.

---

## Future (not implemented)

- **Early close (CC only):** if a short covered call is profitable to BTC and next week's regular CC still looks good, close and reopen — stub in `evaluateEarlyCloseCoveredCall`.
- Multi-ticker universe, rolls, holiday calendar, server-side SSE fill relay.
