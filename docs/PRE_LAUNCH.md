# Pre-Launch Setup

One-time setup before running the app locally. When this is done, use [LAUNCH.md](./LAUNCH.md) for day-to-day run commands.

The app has three parts:

| Component | Stack | Default URL | Purpose |
|-----------|-------|-------------|---------|
| **Frontend** | React + Vite | http://localhost:5173 | Dashboard UI — holds no credentials |
| **Backend API** | .NET 10 (`WheelStrategy.Api`) | http://localhost:5099 | Strike suggestions, bar cache, **and the Alpaca proxy** |
| **Weekly bot** (optional) | Node / TypeScript (`bot/`) | talks to `:5099` | Headless NVDA paper sell-to-open — see [BOT.md](./BOT.md) |

**All Alpaca credentials live on the backend.** Vite inlines every `VITE_`-prefixed
variable into the production bundle as a literal string, so the browser is given no key
at all: it calls `/api/alpaca/...` on the backend, which attaches the `APCA-*` headers
from Windows user environment variables. There is nothing to configure on the frontend
but a mock toggle and the backend URL.

### What to configure

| Goal | Frontend `.env` | Backend Windows user env |
|------|-----------------|--------------------------|
| Explore UI with mock positions/quotes/orders | `VITE_USE_MOCK=true` (the default) | Not needed |
| Live Alpaca paper positions, prices, and order entry | `VITE_USE_MOCK=false` | **Required** (`ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`) |
| Wheel Analysis strike panel | — | **Required** (same two keys) |
| Earnings / dividend catalysts | — | Optional (`FINNHUB_API_KEY`) |

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
the analysis services and by the proxy that serves the browser. Set them as **Windows
user** environment variables (PowerShell). Restart Cursor / terminals / `dotnet run`
afterward so new processes see the values:

```powershell
[Environment]::SetEnvironmentVariable("ALPACA_API_KEY_ID", "<your-key-id>", "User")
[Environment]::SetEnvironmentVariable("ALPACA_API_SECRET_KEY", "<your-secret>", "User")

# Optional — earnings/dividend catalysts. Without it the catalysts panel
# degrades to macro-only events.
[Environment]::SetEnvironmentVariable("FINNHUB_API_KEY", "<your-token>", "User")
```

Confirm names only (do not print values):

```powershell
@("ALPACA_API_KEY_ID","ALPACA_API_SECRET_KEY","FINNHUB_API_KEY") | ForEach-Object {
  $v = [Environment]::GetEnvironmentVariable($_, "User")
  "{0} {1}" -f $_, $(if ([string]::IsNullOrWhiteSpace($v)) { "MISSING" } else { "set" })
}
```

Any of these pairs work; the first non-empty wins (`Alpaca__*` / user-secrets
override the flat names):

| Options key | Hierarchical env | Flat alias (also accepted) |
|-------------|------------------|----------------------------|
| `Alpaca:ApiKeyId` | `Alpaca__ApiKeyId` | `ALPACA_API_KEY_ID` |
| `Alpaca:ApiSecretKey` | `Alpaca__ApiSecretKey` | `ALPACA_API_SECRET_KEY` |

Paper keys: [Alpaca paper dashboard](https://app.alpaca.markets/paper-trading).
Finnhub tokens: [finnhub.io](https://finnhub.io).

`.NET` user-secrets remain a silent fallback if an env var is unset. Do not put keys
in `.env` — Vite loads that file into the Node process even for unprefixed names.

To port keys to another Windows PC, copy the gitignored
`scripts/install-user-env.local.ps1` (not in git) and run it as that user, then
restart terminals / Cursor / `dotnet run`.

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
| `503 Alpaca credentials not configured` | Backend has no keys (or only `ALPACA_API_*` was set on an older build) | Set `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` as Windows user env vars; restart the API |
| Every Alpaca call fails with a connection error | Backend not running | Start it: `cd backend/WheelStrategy.Api && dotnet run` |
| `404 Route not proxied` | Path is not on the proxy allowlist | Add it to `AlpacaProxyPolicy`, or check for a typo in the path |
| `400 Order rejected by proxy policy` | Order breached a validation rule or cap | The response `detail` names the rule; raise the cap in `AlpacaProxy` if intended |
| `403 Order entry disabled` | `AlpacaProxy:AllowOrderPlacement` is `false` | Set it back to `true` |
| Analysis returns errors / empty bars | Backend secrets not set | Set both `ALPACA_*` user env vars; restart the API |
| CORS error from the backend | Frontend origin not allowed | Default is `http://localhost:5173`; update `Cors:AllowedOrigins` if needed |
| `dotnet run` fails | .NET 10 SDK missing | Install .NET 10 SDK |
| Build fails: file locked by `WheelStrategy.Api` | The API is still running | Stop it before `dotnet build` |
| Startup recreates `wheel.db` / bar cache empty | Pre-migration `EnsureCreated` DB has no `__EFMigrationsHistory` | Expected once — the disposable bar cache is wiped and rebuilt from EF migrations |
| Analysis `400` validation problem on `symbol` | Symbol failed the ticker pattern | Use a normal equity root (`AAPL`, `BRK.B`); max 10 chars |

Alpaca's market-data API rejects a `Content-Type` header on GET requests. The backend clients omit it on purpose to avoid CORS preflight failures.

---

## Architecture (quick reference)

- **Live app entry:** `src/WheelDashboard.tsx` (rendered by `src/main.tsx`)
- **Browser → Backend:** everything. Alpaca via the proxy (`src/api/alpacaClient.ts` → `/api/alpaca/...`), strike suggestions via `src/api/fetchWheelAnalysis.ts`. The browser holds no credentials.
- **Backend → Alpaca:** proxied prices/positions/orders, plus historical bars cached in SQLite (`HistoricalBar`)

See [CLAUDE.md](../CLAUDE.md) for deeper architecture notes, [BOT.md](./BOT.md) for the weekly paper bot, and [NEXT_STEPS.md](./NEXT_STEPS.md) for planned features.
