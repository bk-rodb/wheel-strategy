# Pre-Launch Setup

One-time setup before running the app locally. When this is done, use [LAUNCH.md](./LAUNCH.md) for day-to-day run commands.

The app has two parts:

| Component | Stack | Default URL | Purpose |
|-----------|-------|-------------|---------|
| **Frontend** | React + Vite | http://localhost:5173 | Dashboard UI — holds no credentials |
| **Backend API** | .NET 10 (`WheelStrategy.Api`) | http://localhost:5099 | Strike suggestions, bar cache, **and the Alpaca proxy** |

**All Alpaca credentials live on the backend.** Vite inlines every `VITE_`-prefixed
variable into the production bundle as a literal string, so the browser is given no key
at all: it calls `/api/alpaca/...` on the backend, which attaches the `APCA-*` headers
from user-secrets. There is nothing to configure on the frontend but a mock toggle and
the backend URL.

### What to configure

| Goal | Frontend `.env` | Backend user-secrets |
|------|-----------------|----------------------|
| Explore UI with mock positions/quotes/orders | `VITE_USE_MOCK=true` (the default) | Not needed |
| Live Alpaca paper positions, prices, and order entry | `VITE_USE_MOCK=false` | **Required** (`Alpaca:ApiKeyId`, `Alpaca:ApiSecretKey`) |
| Wheel Analysis strike panel | — | **Required** (same two keys) |
| Earnings / dividend catalysts | — | Optional (`Finnhub:ApiKey`) |

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

Edit `.env` (see [.env.example](../.env.example) for defaults). **No secrets belong in
this file** — every variable here is inlined into the production bundle:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_USE_MOCK` | Optional | `false` opts into live data through the backend proxy. Anything else (or unset) is mock mode. |
| `VITE_API_BASE_URL` | Optional | Backend URL; default `http://localhost:5099` |
| `VITE_ALPACA_DATA_FEED` | Optional | `iex` (free, default) or `sip` (paid). Non-secret; forwarded to the proxy. |

**Mock mode (the default):** runs on mock positions, quotes, account data, and
**simulated option orders** (top bar shows **MOCK DATA**). Sell-to-open uses an
in-browser order store — place → accept → cancel works with no Alpaca keys anywhere.
Strike suggestions still come from the backend when it is running, provided the backend
has its own keys.

Restart `npm run dev` after any `.env` change — Vite reads env vars at startup.

### Backend (API + Alpaca proxy)

The backend holds **the only** Alpaca credentials in the system. They are used both by
the analysis services and by the proxy that serves the browser:

```bash
cd backend/WheelStrategy.Api
dotnet user-secrets set "Alpaca:ApiKeyId" "<your-key-id>"
dotnet user-secrets set "Alpaca:ApiSecretKey" "<your-secret>"

# Optional — earnings/dividend catalysts. Without it the catalysts panel
# degrades to macro-only events.
dotnet user-secrets set "Finnhub:ApiKey" "<your-token>"
```

Or set environment variables `Alpaca__ApiKeyId` and `Alpaca__ApiSecretKey`.

Paper keys: [Alpaca paper dashboard](https://app.alpaca.markets/paper-trading).
Finnhub tokens: [finnhub.io](https://finnhub.io).

User-secrets are stored outside the repo (on Windows,
`%APPDATA%\Microsoft\UserSecrets\wheel-strategy-api\secrets.json`), so they cannot be
committed by accident.

Non-secret settings live in `backend/WheelStrategy.Api/appsettings.json` (SQLite path,
CORS origins, analysis defaults, Alpaca base URLs and feed, proxy order caps). If you use
`npm run preview` on a port other than 5173, add that origin to `Cors:AllowedOrigins`.

#### Proxy guardrails (`AlpacaProxy` in appsettings)

The proxy holds credentials that can place and cancel real orders, so it allowlists
routes and validates order bodies rather than forwarding blind:

| Setting | Default | Effect |
|---|---|---|
| `AllowOrderPlacement` | `true` | Set `false` for a read-only desk: order place/cancel returns 403 |
| `MaxOrderQty` | `50` | Largest contract quantity in one order |
| `MaxLimitPrice` | `1000` | Per-contract fat-finger cap |
| `MaxOrderNotional` | `250000` | Cap on `qty × limit × 100` |
| `TimeoutSeconds` | `15` | Upstream timeout; exceeded requests return 504 |

#### Going live (real money)

`Alpaca:TradingBaseUrl` defaults to `https://paper-api.alpaca.markets`. Pointing it at
`https://api.alpaca.markets` with live keys is the **only** change required to trade real
money — there is no second confirmation. Re-read the proxy guardrails above before doing
so.

---

## Setup troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Top bar shows **MOCK DATA** | `VITE_USE_MOCK` is not `false` | Set `VITE_USE_MOCK=false` and restart the dev server |
| `503 Alpaca credentials not configured` | Backend has no keys | Run `dotnet user-secrets set` for both Alpaca keys |
| Every Alpaca call fails with a connection error | Backend not running | Start it: `cd backend/WheelStrategy.Api && dotnet run` |
| `404 Route not proxied` | Path is not on the proxy allowlist | Add it to `AlpacaProxyPolicy`, or check for a typo in the path |
| `400 Order rejected by proxy policy` | Order breached a validation rule or cap | The response `detail` names the rule; raise the cap in `AlpacaProxy` if intended |
| `403 Order entry disabled` | `AlpacaProxy:AllowOrderPlacement` is `false` | Set it back to `true` |
| Analysis returns errors / empty bars | Backend secrets not set | Run `dotnet user-secrets set` for both Alpaca keys |
| CORS error from the backend | Frontend origin not allowed | Default is `http://localhost:5173`; update `Cors:AllowedOrigins` if needed |
| `dotnet run` fails | .NET 10 SDK missing | Install .NET 10 SDK |
| Build fails: file locked by `WheelStrategy.Api` | The API is still running | Stop it before `dotnet build` |

Alpaca's market-data API rejects a `Content-Type` header on GET requests. The backend clients omit it on purpose to avoid CORS preflight failures.

---

## Architecture (quick reference)

- **Live app entry:** `src/WheelDashboard.tsx` (rendered by `src/main.tsx`)
- **Browser → Backend:** everything. Alpaca via the proxy (`src/api/alpacaClient.ts` → `/api/alpaca/...`), strike suggestions via `src/api/fetchWheelAnalysis.ts`. The browser holds no credentials.
- **Backend → Alpaca:** proxied prices/positions/orders, plus historical bars cached in SQLite (`HistoricalBar`)

See [CLAUDE.md](../CLAUDE.md) for deeper architecture notes and [NEXT_STEPS.md](./NEXT_STEPS.md) for planned features.
