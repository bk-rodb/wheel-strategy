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
5. Backend health: `curl http://localhost:5099/health`

If the Wheel Analysis panel errors, confirm the API terminal is running and `VITE_API_BASE_URL` matches (default `http://localhost:5099`).

Example analysis request:

```text
GET http://localhost:5099/api/analysis/wheel?symbol=NVDA&dte=35&lookbackDays=730&granularity=weekly
```

---

## Other commands

```bash
npm run build          # type-check + production build
npm run preview        # serve dist/ (default http://localhost:4173)
npm test               # vitest run
npm run test:watch

cd backend/WheelStrategy.Api && dotnet build
```

Setup issues (keys, CORS, mock mode): see [PRE_LAUNCH.md](./PRE_LAUNCH.md).
