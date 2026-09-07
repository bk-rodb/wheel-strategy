# CLAUDE.md (bot/)

Guidance for Claude Code when working in this directory. See the [repo-root CLAUDE.md](../CLAUDE.md) for overall project context.

Paper sell-to-open worker (covered call or CSP) at the analysis **`regular`** strike, via WheelStrategy.Api. Trades NVDA, SPCX, and RKLB by default, one independent cycle per symbol.

**Full documentation:** [docs/BOT.md](../docs/BOT.md) · **Unattended (Windows):** [docs/runbooks/unattended-nvda-bot.md](../docs/runbooks/unattended-nvda-bot.md)

## Quick start

```bash
# Terminal 1 — API (paper keys required)
cd backend/WheelStrategy.Api && dotnet run

# Terminal 2 — bot
cd bot
cp .env.example .env   # leave BOT_DRY_RUN=true until a ticket looks right
npm install
npm start              # long-running
# or: npm run once     # Mon/Tue window only; else exits
```

From repo root: `npm run bot` / `npm run bot:once` / `npm run bot:test`.

| Variable | Default | Notes |
|---|---|---|
| `BOT_DRY_RUN` | `true` | Fallback if `GET /api/bot/config` fails |
| `BOT_SYMBOLS` | `NVDA,SPCX,RKLB` | Fallback universe; live list is the desk BOT tab |
| `BOT_LEVEL` | `regular` | Fallback; live level is the desk BOT tab |

**Entry window (ET):** Mon–Tue → this Friday; Wed–Fri → wait until next Monday. Details, cycle steps, troubleshooting, and safety checklist are in [docs/BOT.md](../docs/BOT.md).
