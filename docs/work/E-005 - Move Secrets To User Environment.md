# E-005 — Move Secrets To User Environment

| Field | Value |
|-------|-------|
| **ID** | `E-005` |
| **Type** | Enhancement |
| **Status** | done |
| **Opened** | 2026-09-06 |
| **Closed** | 2026-09-06 |
| **Owner** | — |
| **Related** | [PRE_LAUNCH.md](../PRE_LAUNCH.md), [CODE_REVIEW.md](../CODE_REVIEW.md) H-01 (browser-held keys) |

---

## Prompt

> Environment Variable migration. Review the code. Determine if any environment variables are read from the .env file. if so, migrate the variable to local user environment variables. Update code to read from local user environment variables. goal is remove the dependencies of important keys away from .env files. only application specific or app system config values in the .env

---

## Context

Application code does not read secrets from `.env`. The backend already loads Alpaca/Finnhub from .NET user-secrets (Development) or `Alpaca__ApiKeyId`-style env. The gitignored root `.env` still held leftover broker/API keys in a “reference only” block — unused by TS/C#, but present in the Vite Node process. Goal: persist important keys as Windows user environment variables named `ALL_CAPS_UNDERSCORE`, teach the API to overlay `ALPACA_*` / `FINNHUB_*` onto options, and leave only `VITE_*` / `BOT_*` in `.env` files.

---

## Requirements

1. Backend reads `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, and `FINNHUB_API_KEY` from the process environment and overlays them onto `AlpacaOptions` / `FinnhubOptions` (prefer env over user-secrets).
2. Keep `UserSecretsId` as a silent fallback so an existing machine does not 503 mid-migration.
3. Strip leftover secrets from the local root `.env`; persist them (plus unused leftovers) as Windows user env vars. Do not commit `.env` or print secret values.
4. Keep `VITE_*` and `BOT_*` in `.env` / `bot/.env` (app config only).
5. Update docs and the proxy 503 detail to name the `ALL_CAPS_UNDERSCORE` Windows user env vars.

---

## Acceptance criteria

- [x] `UserEnvironmentSecrets` overlays Alpaca/Finnhub from `ALL_CAPS` process env; unit test covers set / blank / leave-existing
- [x] 503 copy names `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY` as Windows user environment variables
- [x] Local root `.env` contains only `VITE_*` app config
- [x] Leftover keys (Alpaca, Polygon, E*TRADE, Anthropic, Brave, IBKR) exist as Windows user env vars. Finnhub was not present in `.env` or user-secrets, so `FINNHUB_API_KEY` was not set.
- [x] Docs (`.env.example`, PRE_LAUNCH, BOT, unattended runbook, CLAUDE.md) no longer treat user-secrets as the source of truth
- [x] Tests / checks: `dotnet test` in `backend/WheelStrategy.Api.Tests`

---

## Out of scope

- Wiring Polygon / E*TRADE / Anthropic / Brave / IBKR into the desk
- Changing Vite mock/API-base behavior
- Rotating keys
- Removing `UserSecretsId` in this pass

---

## Design notes

Overlay via `PostConfigure<T>` after the standard options bind so OS user env wins. Names are flat `ALL_CAPS_UNDERSCORE`, not `Alpaca__ApiKeyId`. Unused leftovers are persisted for later use with no app wiring. `SANDBOX_BASE_URL` / `PROD_BASE_URL` become `ETRADE_SANDBOX_BASE_URL` / `ETRADE_PROD_BASE_URL`.

---

## Completed

### Summary

Secrets no longer live in `.env`. The API overlays `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, and `FINNHUB_API_KEY` from the process environment onto options. Leftover unused keys were written to this machine’s Windows user environment. `.env` keeps only `VITE_*` app config.

### Commits

| Hash | Message |
|------|---------|
| `40e8449` | Read Alpaca and Finnhub keys from Windows user environment variables. |

PR: —

### Key changes

- `backend/WheelStrategy.Api/Options/UserEnvironmentSecrets.cs` — overlay helper
- `backend/WheelStrategy.Api.Tests/UserEnvironmentSecretsTests.cs` — unit tests
- `backend/WheelStrategy.Api/Program.cs` — `AddUserEnvironmentSecrets()`
- `backend/WheelStrategy.Api/Endpoints/AlpacaProxyEndpoints.cs` — 503 copy
- `.env.example`, `docs/PRE_LAUNCH.md`, `docs/BOT.md`, `docs/runbooks/unattended-nvda-bot.md`, `CLAUDE.md`

### Verification

```bash
dotnet test --nologo --filter "FullyQualifiedName~UserEnvironmentSecretsTests"
```

### Follow-ups

- Set `FINNHUB_API_KEY` when a Finnhub token is available (not present on this machine).
- Restart Cursor / terminals / `dotnet run` so new user env is visible to child processes.
- Rotate leftover keys if desired (they once sat in a tracked file).
- Remove `UserSecretsId` after confirming env-only startup.
- Copy gitignored `scripts/install-user-env.local.ps1` when porting to a new PC.
