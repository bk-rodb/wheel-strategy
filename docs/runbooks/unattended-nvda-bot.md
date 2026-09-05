# Playbook: unattended NVDA paper bot (Windows)

Run the weekly NVDA sell-to-open bot without sitting at the keyboard. This is the path that **works today** on a local Windows PC: keep the analysis API up, schedule `npm run once` for Monday and Tuesday after the 9:30 ET open.

N8N, Slack, email, and `--serve` are **not built yet** — see [BOT_AUTOMATION.md](../BOT_AUTOMATION.md). Do not wait on those.

**Repo root assumed:** `C:\repos\wheel-strategy`. If yours differs, substitute every path below.

**You do not need the Vite frontend.** The bot talks only to the API at `http://localhost:5099`.

---

## What you are turning on

| Piece | Role | Must stay up? |
|-------|------|----------------|
| **WheelStrategy.Api** (`:5099`) | Holds Alpaca paper keys; analysis + order proxy | Yes, whenever the bot might fire |
| **Bot `--once`** | One cycle: skip if not Mon/Tue, else sell-to-open NVDA at `regular` | No — Task Scheduler starts it, it exits |
| Desk UI (`npm run dev`) | Optional. Useful to inspect the first paper fill | No |

Default behavior: **NVDA only**, paper account, **sell-to-open** only, strike level `regular` (~30% assignment). Shares ≥ 100 → covered call (qty = floor(shares/100)); otherwise one cash-secured put.

There is **no NYSE holiday calendar**. On a Monday holiday the bot may still attempt a day order.

---

## Phase 0 — Decide before you automate

Do this once, on paper, before touching Task Scheduler.

- [ ] You accept **paper money only**. Live (`https://api.alpaca.markets`) is a one-line config change with no extra confirmation — do not point TradingBaseUrl there.
- [ ] This PC will be **powered on, logged in (lock screen is fine), and not asleep** through Monday and Tuesday mornings Eastern.
- [ ] You will dry-run **inside a Mon/Tue window** before enabling real paper orders. Outside that window `--once` exits without a ticket — that is expected, not a failure.
- [ ] You will watch the **first** live-paper fill yourself (Alpaca paper dashboard or the desk blotter). Automate only after that fill looks right.

If the PC sleeps Sunday night and nobody is logged on Monday, the API is down and the 9:35 task will fail. Sleep/hibernate is the usual way this “unattended” setup misses a week.

---

## Phase 1 — One-time software and paper keys

Skip any step you already completed from [PRE_LAUNCH.md](../PRE_LAUNCH.md).

### 1.1 Tools

In Git Bash or PowerShell:

```bash
node --version     # 20+
npm --version
dotnet --version   # 10.x
```

Install [Node.js 20+](https://nodejs.org/) and [.NET 10 SDK](https://dotnet.microsoft.com/download) if either is missing.

Note where `npm` lives (Task Scheduler often has a thinner PATH):

```bash
where npm
where node
where dotnet
```

Typical: `C:\Program Files\nodejs\npm.cmd` and `C:\Program Files\dotnet\dotnet.exe`. The helper scripts below add the Node path if it is in Program Files.

### 1.2 Repo install

```bash
cd /c/repos/wheel-strategy
npm install
cd bot && npm install && cd ..
```

### 1.3 Alpaca **paper** keys on the backend (not in the bot)

The bot has **no** Alpaca credentials. Keys live in backend user-secrets for **your Windows user**.

```bash
cd /c/repos/wheel-strategy/backend/WheelStrategy.Api
dotnet user-secrets set "Alpaca:ApiKeyId" "<paper-key-id>"
dotnet user-secrets set "Alpaca:ApiSecretKey" "<paper-secret>"
```

Get paper keys from the [Alpaca paper dashboard](https://app.alpaca.markets/paper-trading).

Confirm (no secrets printed if you only list keys):

```bash
dotnet user-secrets list
```

You should see `Alpaca:ApiKeyId` and `Alpaca:ApiSecretKey`.

**Gotcha:** Task Scheduler must run as **this same Windows user**. User-secrets live under `%APPDATA%\Microsoft\UserSecrets\wheel-strategy-api\` and will not load for another account.

### 1.4 Confirm paper URL and order kill switch

Open `backend/WheelStrategy.Api/appsettings.json` and verify:

| Setting | Required value |
|---------|----------------|
| `Alpaca:TradingBaseUrl` | `https://paper-api.alpaca.markets` (**not** `https://api.alpaca.markets`) |
| `AlpacaProxy:AllowOrderPlacement` | `true` when you want paper orders (keep `true` even during dry-run; dry-run never POSTs `/v2/orders`) |

Repo defaults already match that. Change them only if you previously pointed at live or disabled placement.

### 1.5 Smoke-test the API

```bash
cd /c/repos/wheel-strategy/backend/WheelStrategy.Api
dotnet run
```

Leave that terminal open. In a second terminal:

```bash
curl http://localhost:5099/health
```

Expect `{"status":"ok"}`. If you get `503` on Alpaca routes later, secrets did not load — you are not in Development, or you ran as a different user.

---

## Phase 2 — Bot env and a dry-run ticket (must be Mon or Tue ET)

The entry window is **America/New_York**: Monday at/after 9:30, or any time Tuesday. Weekend / Monday pre-open / Wed–Sun: `--once` logs `Not in entry window` and exits 0.

### 2.1 Create `bot/.env`

```bash
cd /c/repos/wheel-strategy/bot
cp .env.example .env
```

Leave these unless you have a reason to change them:

```text
BOT_API_BASE=http://localhost:5099
BOT_SYMBOL=NVDA
BOT_LEVEL=regular
BOT_DRY_RUN=true
```

**Do not** set `BOT_DRY_RUN=false` yet.

### 2.2 Manual dry-run (API still running)

```bash
cd /c/repos/wheel-strategy/bot
npm run once
```

**If it is not Mon/Tue after 9:30 ET:** you will see `Not in entry window` / `--once exiting without placing`. Wait until the window; do not flip dry-run or schedule live paper yet.

**If you are in the window:** console prints a ticket JSON. Also check:

- `bot/data/runs.jsonl` — last line `status` should be `dry_run` (or `skipped` / `blocked` with a reason)
- `bot/data/last-cycle.json` — records this Friday so a second run will not double-fire

Read the ticket: side (put vs call), qty, strike, limit, blockers. For a covered call you need ≥100 NVDA in the **paper** account. For a put you need options buying power / cash for collateral.

If status is `blocked`, fix the account (shares or buying power) and delete `bot/data/last-cycle.json` only if you intend to retry the **same** Friday.

### 2.3 Optional: confirm the helper script logs the same way

```bash
cd /c/repos/wheel-strategy/bot
./run-once.cmd
# Git Bash: cmd.exe //c run-once.cmd
```

Then open `bot/data/scheduler.log`. Task Scheduler will use this file; you will not have a console.

---

## Phase 3 — First real paper order (still attended)

Do this **once**, still sitting at the machine, still inside a Mon/Tue window.

1. Inspect the dry-run ticket. If it is wrong, stop.
2. In `bot/.env` set `BOT_DRY_RUN=false`.
3. Delete `bot/data/last-cycle.json` if that Friday was already recorded as `dry_run` (otherwise the bot skips).
4. API still running: `npm run once` from `bot/`.
5. Watch the order in the [Alpaca paper dashboard](https://app.alpaca.markets/paper-trading) or the desk blotter. Cancel if it is wrong.
6. Confirm `runs.jsonl` shows `placed` or `filled` (or `canceled` / `blocked` / `error` — do not automate those away).

Only continue to Phase 4–5 after a ticket you would have been willing to leave working.

---

## Phase 4 — Keep the API running at logon

The bot refuses to start if `:5099` is down. Schedule the API to start when **you** log on.

Helper already in the repo: [`scripts/start-api.cmd`](../../scripts/start-api.cmd). It skips if `:5099` is already listening, forces `ASPNETCORE_ENVIRONMENT=Development` (required for user-secrets), and appends stdout to `backend/WheelStrategy.Api/logs/api.log`.

### 4.1 Power so Monday morning exists

- [ ] PC plugged in
- [ ] Settings → System → Power: **sleep = Never** when plugged in (or at least never overnight Sun→Tue)
- [ ] Stay logged in overnight (Windows lock is OK). “Run whether user is logged on or not” for the **API** is optional later; start with “only when logged on” so a console/log is easy to check.

### 4.2 Task Scheduler — API

1. Start **Task Scheduler** (`taskschd.msc`).
2. **Create Task** (not “Create Basic Task” — you need the Settings tab).
3. **General**
   - Name: `Wheel Strategy API`
   - Description: Starts analysis + Alpaca proxy on :5099
   - Run only when user is logged on
   - Run with highest privileges: **off** (not required)
   - Configure for: Windows 10
4. **Triggers** → New
   - Begin the task: **At log on**
   - Specific user: **you**
   - Enabled
5. **Actions** → New
   - Action: Start a program
   - Program/script: `C:\repos\wheel-strategy\scripts\start-api.cmd`
   - Start in (optional but recommended): `C:\repos\wheel-strategy\backend\WheelStrategy.Api`
6. **Conditions**
   - Uncheck “Start only if the computer is on AC power” if you might be on battery
   - Check **Wake the computer to run this task** if you cannot fully disable sleep
7. **Settings**
   - Allow task to be run on demand
   - If the task fails, restart every 1 minute, up to 3 times
   - If the running task does not end when requested, force it to stop
   - **Do not** stop the task after 3 days — this process should live all week
8. OK → enter your Windows password if prompted.

### 4.3 Verify the API task

- Run the task now (right-click → Run).
- `curl http://localhost:5099/health` → `{"status":"ok"}`
- If it failed: `backend/WheelStrategy.Api/logs/api.log` and Task Scheduler → History (enable “All Tasks History” in the right pane if History is disabled).

Sign out and back in once to confirm the logon trigger.

---

## Phase 5 — Schedule the bot Mon/Tue 9:35 ET

Helper: [`bot/run-once.cmd`](../../bot/run-once.cmd). It calls `npm run once` and appends to `bot/data/scheduler.log`.

Idempotency: a second fire the same Friday is a no-op if `last-cycle.json` already has `dry_run` / `placed` / `filled` for that expiry.

### 5.1 Task Scheduler — bot

1. **Create Task** → Name: `Wheel NVDA bot once`
2. **General**
   - Run only when user is logged on (same user as the API / user-secrets)
   - Configure for: Windows 10
3. **Triggers** → New
   - Begin the task: **On a schedule**
   - Weekly
   - Days: **Monday**, **Tuesday**
   - Start: **9:35:00 AM**
   - Time zone: **(UTC-05:00) Eastern Time (US & Canada)**  
     Windows applies DST; do not use a UTC cron and guess 13:35 vs 14:35.
   - Enabled
4. **Actions** → New
   - Program/script: `C:\repos\wheel-strategy\bot\run-once.cmd`
   - Start in: `C:\repos\wheel-strategy\bot`
5. **Conditions**
   - Wake the computer to run this task
   - Uncheck AC-power-only if needed
6. **Settings**
   - Allow run on demand
   - If the task fails, restart every **5 minutes**, up to **3 times** (covers API still starting)
   - Run task as soon as possible after a scheduled start is missed
   - Stop the task if it runs longer than **2 hours** (a stuck poller should not last all day)
7. OK.

You do **not** need a daily trigger. `--once` on Wednesday would just exit; Mon/Tue is enough.

### 5.2 Verify the bot task (safe while dry-run is true)

If `BOT_DRY_RUN` is still `true` in `bot/.env`:

1. Right-click the bot task → **Run**.
2. Open `bot/data/scheduler.log`.
3. In window: a `dry_run` (or skip) line. Out of window: `Not in entry window` then `--once exiting`.

If `BOT_DRY_RUN` is already `false`, **do not** on-demand Run unless you intend a paper order and `last-cycle.json` is not blocking the current Friday.

---

## Phase 6 — Weekly operating rhythm

You are unattended when both tasks exist, API comes up at logon, `BOT_DRY_RUN=false`, and the PC stays awake.

**Monday or Tuesday morning (optional 2-minute check):**

- [ ] `curl http://localhost:5099/health`
- [ ] Tail `bot/data/scheduler.log` and the last line of `bot/data/runs.jsonl`
- [ ] If `filled` / `placed`: glance at Alpaca paper positions/orders
- [ ] If `error` / `blocked` / missing log after 9:35: see [Troubleshooting](#troubleshooting)

**Do not** delete `last-cycle.json` every week. It is what prevents a double sell-to-open for the same Friday.

**Frontend** is optional. Start it only when you want the blotter: from repo root, `npm run dev` (with `VITE_USE_MOCK=false` if you want live paper positions).

---

## Phase 7 — Pause, disable, or shut down

| Intent | What to do |
|--------|------------|
| Skip this week only | Task Scheduler → bot task → **Disable**. Re-enable after Friday. Or set `BOT_DRY_RUN=true` (still “runs,” but will not POST an order). |
| Stop placing until further notice | Disable the bot task **and** set `AlpacaProxy:AllowOrderPlacement` to `false` (desk + bot both 403 on place/cancel). Restart the API after changing appsettings. |
| Stop everything | Disable both tasks. Run `./scripts/shutdown.sh` from the repo root (stops `:5099` / Vite). |
| Re-fire the **same** Friday after a dry-run | Set `BOT_DRY_RUN=false`, delete `bot/data/last-cycle.json`, run `npm run once` inside the window. |

---

## Troubleshooting

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| `Cannot reach WheelStrategy.Api` | API down or wrong `BOT_API_BASE` | Run API task; `curl :5099/health`; confirm `bot/.env` |
| `--once` exits with no ticket | Outside Mon/Tue 9:30 ET window | Expected. Wait, or inspect log for `Not in entry window` |
| Dry-run looks good, no Alpaca order | `BOT_DRY_RUN=true` | Set `false` in `bot/.env`; clear `last-cycle.json` if that Friday was a dry-run |
| `Skipped: already completed` | Idempotency for this Friday | Leave it. Clear `last-cycle.json` only to intentionally retry |
| `403 Order entry disabled` | Proxy kill switch | `AlpacaProxy:AllowOrderPlacement` true; restart API |
| `503` from Alpaca proxy | Secrets missing for this user/env | Same Windows user; `ASPNETCORE_ENVIRONMENT=Development`; `dotnet user-secrets list` |
| Task runs, `scheduler.log` empty / `npm` not found | PATH in Task Scheduler | Confirm `where npm`; `run-once.cmd` prepends `Program Files\nodejs` |
| API task exits immediately | Port in use, or `dotnet run` failed | `logs/api.log`; `netstat` for `:5099` |
| Missed Monday | PC slept or nobody logged on | Phase 4.1 power; stay logged in; wake-to-run is not enough if the API never started |
| Blocked: need 100 shares | Flat / under 100 NVDA on paper | Call path needs ≥100 shares; put path needs cash/OBP |
| Open option order skip | Working NVDA option order | Cancel in desk or Alpaca paper UI |
| Monday holiday fill attempt | No holiday calendar in v1 | Disable the bot task that week |

Full table: [BOT.md](../BOT.md) troubleshooting.

---

## Checklist (print this)

One-time:

- [ ] Node 20+, .NET 10, `npm install` at repo root and in `bot/`
- [ ] Paper keys in user-secrets; `TradingBaseUrl` is paper
- [ ] `bot/.env` exists with `BOT_DRY_RUN=true`
- [ ] Mon/Tue dry-run ticket inspected in `runs.jsonl`
- [ ] One attended paper order with `BOT_DRY_RUN=false`
- [ ] PC: plugged in, sleep off overnight Sun–Tue, stay logged in
- [ ] Task `Wheel Strategy API` at logon → health ok
- [ ] Task `Wheel NVDA bot once` Mon+Tue 9:35 Eastern → `scheduler.log` updates

Every week (optional glance):

- [ ] Health endpoint
- [ ] Last `runs.jsonl` line is `placed` / `filled` / intentional `skipped`

---

## Related

- [BOT.md](../BOT.md) — behavior, cycle steps, env vars
- [PRE_LAUNCH.md](../PRE_LAUNCH.md) — keys and proxy caps
- [LAUNCH.md](../LAUNCH.md) — day-to-day `dotnet run` / `npm run dev`
- [BOT_AUTOMATION.md](../BOT_AUTOMATION.md) — planned N8N / Slack / `--serve` (not implemented)
