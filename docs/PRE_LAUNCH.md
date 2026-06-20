# Pre-Launch Setup

One-time setup before running the app locally. When this is done, use [LAUNCH.md](./LAUNCH.md) for day-to-day run commands.

The app has two parts:

| Component | Stack | Default URL | Purpose |
|-----------|-------|-------------|---------|
| **Frontend** | React + Vite | http://localhost:5173 | Dashboard UI, Alpaca market data (browser) |
| **Analysis API** | .NET 10 (`WheelStrategy.Api`) | http://localhost:5099 | Strike suggestions, historical bar cache |

### What to configure

| Goal | Frontend `.env` | Backend user-secrets |
|------|-----------------|----------------------|
| Explore UI with mock positions/quotes | Leave Alpaca keys empty | Not needed |
| Live Alpaca paper positions and prices | Alpaca `VITE_*` keys | Not needed |
| Wheel Analysis strike panel | Alpaca keys recommended for consistent symbols | **Required** (`Alpaca:ApiKeyId`, `Alpaca:ApiSecretKey`) |

---

## Requirements

- **Node.js** 20+ (includes `npm`)
- **.NET SDK 10** — [download](https://dotnet.microsoft.com/download)

Verify:

```bash
node --version
npm --version
dotnet --version   # should report 10.x
```

---

## Clone and install

```bash
git clone <repo-url> wheel-strategy
cd wheel-strategy
npm install
```

---

## Environment configuration

### Frontend (`.env`)

```bash
cp .env.example .env   # Windows (cmd): copy .env.example .env
```

Edit `.env` (see [.env.example](../.env.example) for defaults):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ALPACA_API_KEY_ID` | For live data | Alpaca paper-trading API key |
| `VITE_ALPACA_API_SECRET_KEY` | For live data | Alpaca paper-trading secret |
| `VITE_ALPACA_BASE_URL` | For live data | Default: `https://paper-api.alpaca.markets` |
| `VITE_ALPACA_DATA_URL` | For live data | Default: `https://data.alpaca.markets` |
| `VITE_API_BASE_URL` | Optional | Analysis API URL; default `http://localhost:5099` |
| `VITE_POLYGON_API_KEY` | Optional | Not used by core flows today |

Paper keys: [Alpaca paper dashboard](https://app.alpaca.markets/paper-trading).

**Mock mode:** Leave `VITE_ALPACA_API_KEY_ID` empty to run on mock positions, quotes, and account data (top bar shows **MOCK DATA**). No keys required to explore the UI.

Restart `npm run dev` after any `.env` change — Vite reads env vars at startup.

### Backend (analysis API)

The analysis API uses **separate** server-side credentials (not the `VITE_*` vars):

```bash
cd backend/WheelStrategy.Api
dotnet user-secrets set "Alpaca:ApiKeyId" "<your-key-id>"
dotnet user-secrets set "Alpaca:ApiSecretKey" "<your-secret>"
```

Or set environment variables `Alpaca__ApiKeyId` and `Alpaca__ApiSecretKey`.

Non-secret settings live in `backend/WheelStrategy.Api/appsettings.json` (SQLite path, CORS origin, analysis defaults, Alpaca data feed). If you use `npm run preview` on a port other than 5173, add that origin to `Cors:AllowedOrigins`.

---

## Setup troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Top bar shows **MOCK DATA** | No `VITE_ALPACA_API_KEY_ID` in `.env` | Add Alpaca keys and restart the dev server |
| Alpaca requests fail in browser | Invalid keys or wrong base URLs | Match paper keys to `VITE_ALPACA_*` paper URLs |
| Analysis returns errors / empty bars | Backend secrets not set | Run `dotnet user-secrets set` for both Alpaca keys |
| CORS error from analysis API | Frontend origin not allowed | Default is `http://localhost:5173`; update `Cors:AllowedOrigins` if needed |
| `dotnet run` fails | .NET 10 SDK missing | Install .NET 10 SDK |

Alpaca's market-data API rejects a `Content-Type` header on GET requests. Frontend and backend clients omit it on purpose to avoid CORS preflight failures.

---

## Architecture (quick reference)

- **Live app entry:** `src/WheelDashboard.tsx` (not the root-level `WheelDashboard.tsx` duplicate)
- **Browser → Alpaca:** prices, positions, watchlist snapshots via `src/api/alpacaClient.ts`
- **Browser → Analysis API:** strike suggestions via `src/api/fetchWheelAnalysis.ts`
- **Analysis API → Alpaca:** historical bars cached in SQLite (`HistoricalBar`)

See [CLAUDE.md](../CLAUDE.md) for deeper architecture notes and [NEXT_STEPS.md](./NEXT_STEPS.md) for planned features.
