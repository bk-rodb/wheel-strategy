# Weekly NVDA wheel bot

Paper sell-to-open worker for NVDA (covered call or CSP) at the analysis **`regular`** strike, via WheelStrategy.Api.

**Full documentation:** [docs/BOT.md](../docs/BOT.md)

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
| `BOT_DRY_RUN` | `true` | No orders until you set `false` |
| `BOT_SYMBOL` | `NVDA` | |
| `BOT_LEVEL` | `regular` | MED / ~30% assign |

**Entry window (ET):** Mon–Tue → this Friday; Wed–Fri → wait until next Monday. Details, cycle steps, troubleshooting, and safety checklist are in [docs/BOT.md](../docs/BOT.md).
