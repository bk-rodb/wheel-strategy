# Launch Instructions

Run the Wheel Strategy dashboard locally. Assumes [PRE_LAUNCH.md](./PRE_LAUNCH.md) setup is complete.

**Mock UI only:** one terminal — start the frontend below; skip the analysis API.

**Live data or Wheel Analysis:** two terminals — start the analysis API first, then the frontend.

---

## Analysis API

```bash
cd backend/WheelStrategy.Api
dotnet run
```

- http://localhost:5099
- Health: http://localhost:5099/health → `{"status":"ok"}`
- Creates `wheel.db` on first run

Optional for UI layout exploration (mock mode); required for the **Wheel Analysis** strike panel.

---

## Frontend

From the repo root:

```bash
npm run dev
```

- http://localhost:5173 (Vite hot reload)

---

## Verify

1. Open http://localhost:5173
2. **Mock mode:** top bar shows **MOCK DATA**; sample positions and watchlist quotes load
3. **Live mode:** top bar does **not** say MOCK DATA; positions/prices from Alpaca paper
4. **Wheel Analysis:** open a watchlist ticker tab — strike panel loads (backend must be running)
5. **Mock orders (H-11):** in mock mode, open a watchlist ticker → **OPEN OPTIONS** ladder → **SELL** on a row → check the acknowledgment box → **SIMULATE ORDER** → **CANCEL ORDER** on the working banner (no Alpaca keys required; analysis API must be running for the ladder)
6. Backend health: `curl http://localhost:5099/health`

If the Wheel Analysis panel errors, confirm the API terminal is running and `VITE_API_BASE_URL` matches (default `http://localhost:5099`).

Example analysis request:

```text
GET http://localhost:5099/api/analysis/wheel?symbol=NVDA&dte=35&lookbackDays=730&granularity=weekly
```

---

## Shutdown

From the repo root (Git Bash / macOS / Linux):

```bash
./scripts/shutdown.sh
```

Stops Vite (`:5173`), the analysis API (`:5099`), and `npm run preview` (`:4173`) if they are running. Safe when nothing is up.

---

## Weekly NVDA bot (optional)

Paper sell-to-open worker (NVDA, mid-tier strike). Requires the analysis API above with paper keys. Full docs: [BOT.md](./BOT.md).

```bash
cd bot && cp .env.example .env && npm install
npm start              # long-running (or: npm run once)
# from repo root: npm run bot / npm run bot:once
```

Leave `BOT_DRY_RUN=true` until a dry-run ticket looks correct.

---

## Other commands

```bash
npm run build          # type-check + production build
npm run preview        # serve dist/ (default http://localhost:4173)
npm test               # vitest run
npm run lint           # ESLint
npm run test:watch
npm run bot            # weekly NVDA bot worker (see BOT.md)
npm run bot:once
npm run bot:test

cd backend/WheelStrategy.Api && dotnet build
```

Setup issues (keys, CORS, mock mode): see [PRE_LAUNCH.md](./PRE_LAUNCH.md).
