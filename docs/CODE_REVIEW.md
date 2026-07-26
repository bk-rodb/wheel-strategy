# Code Review — Wheel Strategy Desk

Full-repository review of the React/TypeScript trading desk and the .NET analysis backend, dated **2026-07-25** against commit `f52f980`.

**Related:** [CLAUDE.md](../CLAUDE.md) · [PRE_LAUNCH.md](./PRE_LAUNCH.md) · [LAUNCH.md](./LAUNCH.md) · [trading-desk-gaps.md](./trading-desk-gaps.md) · [NEXT_STEPS.md](./NEXT_STEPS.md)

> This document reviews **code quality and correctness**. It is not a feature gap analysis — for that see [trading-desk-gaps.md](./trading-desk-gaps.md).

---

## 1. Scope and method

| Area | Lines | Covered |
|---|---|---|
| Frontend (`src/`) | ~10,900 | All `.ts` / `.tsx` / `.css` |
| Backend (`backend/WheelStrategy.Api/`) | ~1,500 | All `.cs`, `appsettings*.json`, `.csproj`, `launchSettings.json` |
| Build / test / config | — | `package.json`, `vite.config.ts`, `tsconfig*`, `.gitignore`, `.env.example` |

Findings were **verified by running the code, the toolchain, or against vendor documentation** — not inferred from reading alone. Reproduction commands are in [§7](#7-reproducing-the-findings).

Baseline state at review time (commit `f52f980`):

| Check | Result |
|---|---|
| `npm run build` | Passes (with a CSS warning — see [C-4](#c-4-tickertabcss-is-dropped-from-the-production-bundle-breaking-every-detail-page-header)) |
| `npm test` | 14 files / 61 tests pass ([environment caveat](#8-developer-environment-caveat-vitest-and-the-lowercase-drive-letter)) |
| `tsc -b` | Clean, `strict: true` |
| `dotnet build` | Compiles clean, zero compiler warnings |
| `npm run check:api` | **Fails** — generated types are stale ([H-19](#h-19--generated-api-types-are-stale-and-the-contract-rule-is-being-bypassed)) |
| `npm audit` | 4 advisories (1 moderate, 3 high) — dev-only |
| `dotnet list package --vulnerable` | 1 high-severity advisory ([H-18](#h-18--microsoftopenapi-200-carries-a-known-high-severity-advisory)) |
| Linter | **ESLint** — `npm run lint` (Lane 1.3); warnings tolerated, `exhaustive-deps` enabled |
| CI | **GitHub Actions** — `.github/workflows/ci.yml` (Lane 1.3) |

### Remediation progress (updates after `f52f980`)

Tracked in [NEXT_STEPS.md](./NEXT_STEPS.md). As of Phase 3 (see commit after this doc update):

| ID | Status | Commit | Notes |
|---|---|---|---|
| C-2 | **fixed** | Phase 3 | Client order ID in ref; split resume/trade effects; no abort from effect cleanup |
| C-3 | **fixed** | `5ca1bcd`, Phase 3 | `key` on detail views + hook clears state on `underlying` change |
| C-4 | **fixed** | `5ca1bcd` | `@import` moved to top of `index.css`; ticker-tab rules in production CSS |
| C-5 | **fixed** | `928c673` | Bar cache backfill (Lane 2.2) |
| H-1 | **fixed** | `928c673` | Per-symbol pagination (Lane 2.1) |
| H-2 | **fixed** | `928c673` | `adjustment=all` on bar fetch |
| H-3 | **fixed** | `928c673` | Multi-leg P&L + `optionLegCount` |
| H-4 | **fixed** | `928c673` | Snapshot optional chaining |
| H-7 | **fixed** | Phase 3 | `isOrderFilled` uses qty for `done_for_day` |
| H-8 | **fixed** | Phase 3 | Close/roll use `fetchContractSnapshot` |
| H-9 | **fixed** | Phase 3 | `reset()` refuses open orders |
| H-10 | **fixed** | Phase 3 | Partial fill on cancel → `partial_filled` + position refresh |
| H-11 | **fixed** | `9b9b9c7` | Mock sell-to-open via OSI symbols + `row.tradable` |
| H-12 | **fixed** | Phase 3 | `multiplier`/`size`/`rootSymbol` on rows; standard contract filter |
| H-13 | **fixed** | Phase 3 | `roundOptionLimit` tick rounding on submit |
| H-14 | **fixed** | `928c673` | HMM path accumulation (Lane 2.3) |
| H-15 | **fixed** | `928c673` | `fmt.pctFromRatio` (Lane 2.5) |
| H-16 | **fixed** | Phase 3 | Ladder clears while expiration reloads |
| H-17 | **fixed** | `5ca1bcd` | `onRefresh={() => void refresh()}` |
| H-19 | **fixed** | `5ca1bcd`, Lane 1.3 | `check:api` in CI; catalyst types from OpenAPI |
| M-8 | **fixed** | Phase 3 | Skip blotter when `to === from` |
| M-12 | **fixed** | Phase 3 | `orderBlotter.save()` try/catch |
| M-14 | **fixed** | Phase 3 | Put % OTM colour |
| M-15 | **fixed** | Phase 3 | CSP collateral uses `optionsBuyingPower` |
| M-16 | **fixed** | Phase 3 | Ladder quote refresh + `quotedAt` |
| M-19 | **fixed** | Phase 3 | No dual pollers during cancel wait |
| M-20 | **fixed** | Phase 3 | Roll sell leg uses ladder `side` |
| M-21 | **fixed** | Phase 3 | `position_intent: buy_to_close` |
| M-22 | **fixed** | Phase 3 | Qty clamp + ack reset |
| M-23 | **fixed** | Phase 3 | `place()` checks blotter cross-tab |
| M-39 | **fixed** | `5ca1bcd` | Global `button:focus-visible` rule |
| M-40 | **fixed** | Phase 3 | Focus highlight fade timer |
| M-43 | **fixed** | `5ca1bcd` | Root `WheelDashboard.tsx` deleted |
| M-44 | **fixed** | Lane 1.3 | ESLint + GitHub Actions CI |
| L-34 | **fixed** | Lane 1.3 | `.gitattributes` (`eol=lf`, generated marker) |
| M-11 | **open** | — | Close/roll still use padded OSI from `buildOsiSymbol` |
| M-13 | **open** | — | Snapped strike still shows un-snapped assignment probs |
| H-21 | **open** | — | No `usePendingOptionOrder` tests yet (Lane 4.2) |
| C-1 | **open** | — | Keys still in bundle (Phase 5) |
| H-5 | **partial** | `928c673` | Account fetch half fixed; hook stale indicators in Lane 4.3 |
| H-6 | **open** | — | Timeouts, rate limits (Lane 4.3) |
| H-18 | **open** | — | OpenAPI advisory (Lane 4.1) |
| H-20 | **open** | — | Backend validation/logging (Lane 4.1) |

Current toolchain (post-Phase 3): `npm run build` passes; `npm test` — 73 tests / 16 files;
`npm run lint` — 0 errors (2 warnings); `npm run check:api` passes; `dotnet test` — 11 tests.

---

## 2. Executive summary

The codebase is **better engineered than most projects of this size**, and the good parts are good for the right reasons. TypeScript is strict with no `any`, no `@ts-ignore`, and no `console.*` debris. The order layer shows genuine domain awareness: `client_order_id` on every submission, `POST` deliberately never retried, orphan reconciliation after a failed submit, and a cancel that isn't believed until the venue confirms it. The Black-Scholes and realized-volatility math is, on line-by-line inspection, correct.

The defects cluster in five places:

1. **Secrets.** The Alpaca key *and secret* are compiled verbatim into the shipped JavaScript, and the Finnhub token is written into request URLs that get logged.
2. **Market data that is quietly wrong.** A misunderstanding of Alpaca's `limit` semantics means most symbols receive **no bars at all**; bar requests omit `adjustment=all`, so a post-split 52-week range renders ~10× too high; only one option leg per underlying survives, so portfolio P&L is not merely incomplete but incorrect.
3. **React wiring around the order state machine.** ~~One dependency-array mistake aborts the first order of every session (C-2)~~ **fixed Phase 3**; ~~missing `key` / hook leak (C-3)~~ **fixed**.
4. **Failures that render as confident numbers.** Errors collapse into `$0.00`, `NaN` becomes `0`, regime probabilities display 100× too small, and a stale mark is dressed up as a live quote.
5. **Verification.** The statistical engine has no tests, the order state machine has none. ~~Sell-to-open was unreachable in mock mode~~ (**H-11** fixed in `9b9b9c7` — simulated orders work; automated tests still open per **H-21**).

The recurring theme across all five areas is worth stating on its own: **this codebase is much better at computing the right answer than at admitting when it can't.** Almost every failure path substitutes a plausible-looking number — zero, a stale price, an unadjusted high — for "I don't know". On a trading desk those are not equivalent, and the fix is usually a nullable field and a visible indicator rather than new logic.

### Top risks

| ID | Finding | Severity |
|---|---|---|
| [C-1](#c-1--alpaca-api-key-and-secret-are-compiled-into-the-shipped-javascript) | Alpaca key **and secret** inlined into the production bundle | **Critical** |
| [C-2](#c-2--place-aborts-its-own-acceptance-wait-leaving-a-live-unmonitored-order) | ~~`place()` aborts its own acceptance wait~~ | ~~**Critical**~~ *fixed Phase 3* |
| [C-3](#c-3--order-state-leaks-between-ticker-tabs) | ~~Order state leaks between ticker tabs~~ | ~~**Critical**~~ *fixed `5ca1bcd` + Phase 3* |
| [C-5](#c-5--the-bar-cache-never-backfills-analysis-silently-runs-on-truncated-history) | ~~Bar cache never backfills~~ | ~~**Critical**~~ *fixed `928c673`* |
| [H-1](#h-1--the-multi-symbol-bar-limit-is-a-total-not-per-symbol-so-most-symbols-get-nothing) | ~~Multi-symbol bar `limit` is a total~~ | ~~**High**~~ *fixed `928c673`* |
| [H-3](#h-3--only-one-option-leg-per-underlying-survives) | ~~Only one option leg per underlying~~ | ~~**High**~~ *fixed `928c673`* |
| [H-5](#h-5--errors-are-swallowed-into-zeros-and-stale-values) | Errors swallowed into `$0.00` and stale values | **High** |

---

## 3. Critical

### C-1 — Alpaca API key and secret are compiled into the shipped JavaScript

**Files:** `src/api/alpacaClient.ts:25-28`, `src/api/tradeUpdatesStream.ts:96-99`, `.env`

```21:31:src/api/alpacaClient.ts
function authHeaders(withJson = false): HeadersInit {
  // No Content-Type on GET: it isn't needed (no body) and adding it triggers a
  // CORS preflight that Alpaca's data API rejects
  // ("content-type is not allowed by Access-Control-Allow-Headers").
  const headers: Record<string, string> = {
    "APCA-API-KEY-ID": import.meta.env.VITE_ALPACA_API_KEY_ID,
    "APCA-API-SECRET-KEY": import.meta.env.VITE_ALPACA_API_SECRET_KEY,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}
```

Vite performs a literal text substitution on every `VITE_`-prefixed variable at build time. The values are not fetched at runtime — they become string literals in the output.

**Verified against the actual build output.** After `npm run build`, both the key ID (26 chars) and the secret key (44 chars) from `.env` appear verbatim inside `dist/assets/index-*.js`:

```
VITE_ALPACA_API_KEY_ID         len=26   PRESENT_IN_BUNDLE=true
VITE_ALPACA_API_SECRET_KEY     len=44   PRESENT_IN_BUNDLE=true
```

The secret is additionally transmitted in the websocket auth frame (`tradeUpdatesStream.ts:96-99`).

**Blast radius.** These are not read-only market-data keys — the same pair authenticates `/v2/positions`, `/v2/account`, and `POST /v2/orders`. Anyone with the bundle can liquidate positions, place arbitrary orders, or read balances and history from any machine with `curl`. It is a permanent credential: no expiry, no scoping, no per-request signing. It stays valid until manually rotated.

Two things currently cap the damage, and neither is a control: the app is served only from localhost, and `.env` points at `paper-api.alpaca.markets`. Both evaporate the moment someone deploys this or pastes in a live key — and `constants.ts:27` already reserves an `alpaca-live` broker slot. Note that `.env.example`, which *is* committed, actively instructs the user to put the secret behind a `VITE_` prefix, so this is baked into the setup docs rather than an accident.

**What was checked and is clean:** no secret is committed (`.env` is untracked and gitignored; `git log --all -- .env` is empty); nothing is logged (zero `console.*` calls in `src/`); no key material in mock data or `localStorage` (only `wheel-watchlist` and `wheel-order-blotter`).

**Fix.** Extend the backend you already have — `WheelStrategy.Api` is already an authenticated Alpaca client holding credentials server-side via user-secrets:

1. Add a passthrough controller forwarding `/v2/positions`, `/v2/account`, `/v2/account/activities`, `/v2/assets`, `/v2/options/contracts`, `/v2/orders`, and the market-data endpoints, injecting the `APCA-*` headers server-side. `Program.cs:57` restricts CORS to `WithMethods("GET")`, so order placement needs `POST`/`DELETE` added — and that proxy should validate the order body rather than forwarding it blind.
2. Point `alpacaClient.ts` at `API_BASE` and delete `authHeaders()`. The CORS `Content-Type` workaround documented at `alpacaClient.ts:22-24` becomes unnecessary.
3. Remove the two `VITE_ALPACA_*` secrets from `.env.example` and `vite-env.d.ts`. Keep `IS_MOCK` working by switching `config.ts:1` to a non-secret flag such as `VITE_USE_MOCK` — it is currently derived from the *presence of the key*.
4. **Rotate the current keys.** They have been on disk in a build-input file and are in whatever bundles already exist.

Until that lands, treat `dist/` as a secret: never deploy it, never share it.

### C-2 — `place()` aborts its own acceptance wait, leaving a live unmonitored order

> **Remediation:** **Fixed** Phase 3 — client order ID in ref; resume/trade effects split; effect cleanup no longer aborts place/cancel.

**File:** `src/hooks/usePendingOptionOrder.ts:70-124`, `:243-250`, `:277-282`, `:312`, `:340`

`transition` is a `useCallback` that depends on the `clientOrderId` **state**:

```122:124:src/hooks/usePendingOptionOrder.ts
    },
    [clientOrderId, underlying],
  );
```

That identity propagates through `applyBrokerOrder` → `refreshOrder` → `startStatusPoll`, all of which are dependencies of the mount/resume effect:

```243:250:src/hooks/usePendingOptionOrder.ts
    return () => {
      cancelled = true;
      stopPolling();
      clearAbort();
      unsub();
      flightRef.current = false;
    };
  }, [underlying, enabled, applyBrokerOrder, startStatusPoll, stopPolling, clearAbort]);
```

So **any change to `clientOrderId` tears down and re-runs the resume effect**, cleanup first. And `place()` changes it on its first statement path, from `null` to the new ID:

```276:282:src/hooks/usePendingOptionOrder.ts
      const cid = params.clientOrderId ?? newClientOrderId();
      setClientOrderId(cid);
      transition("submitting", {
        clientOrderId: cid,
        order: null,
        detail: `place ${params.side ?? "sell"} ${params.contractSymbol} x${params.qty}`,
      });
```

Tracing a first order placement:

1. `setClientOrderId(cid)` schedules the state change; `await placeOptionOrder(...)` yields.
2. React commits, `transition` gets a new identity, the effect's cleanup runs and **`clearAbort()` aborts the `AbortController` created at `:272`** — the one `place()` is about to use.
3. The POST resolves. **The order is now live at Alpaca.**
4. `waitForOrderAcceptance(created.id, { signal: ctrl.signal })` hits `if (opts.signal?.aborted) throw` (`optionOrders.ts:237`) and throws immediately.
5. The catch at `:339` sees `ctrl.signal.aborted` and returns `null` (`:340`).

Final state: phase latched at `ack_pending`, `locked === true`, **`startStatusPoll` never called**, and `place()` resolved to `null` — so `submitTicket`'s `if (order)` branch is skipped and the user gets no flash message at all. There is a working order at the venue that nothing is polling and no UI acknowledges.

The effect's re-run does not reliably rescue it: at that moment the blotter entry has `orderId: null`, so it takes the `reconcileSubmission(cid)` branch, which races the still-in-flight POST and normally 404s, then falls through to `listOpenOptionOrdersForUnderlying`, which cannot see the order yet either. After that `clientOrderId` never changes again, so the effect never re-runs. Only the websocket can move it forward — and mock mode never connects the socket, so this is **invisible locally** ([H-10](#h-10--sell-to-open-is-unreachable-in-mock-mode)).

The cleanup also sets `flightRef.current = false` mid-submit, destroying the synchronous single-flight guard during exactly the window it exists to protect.

**Fix.** Keep the client order ID in a ref and drop it from the dependency chain; split the effect; never reset `flightRef` or the abort controller from effect cleanup:

```ts
const clientOrderIdRef = useRef<string | null>(null);
// in transition: opts.clientOrderId ?? nextOrder?.client_order_id ?? clientOrderIdRef.current ?? "unknown"
const transition = useCallback((/* ... */) => { /* ... */ }, [underlying]);
```

Put the resume logic in an effect keyed only on `[underlying, enabled]`, and let `place`/`cancel` own their abort controllers, resetting `flightRef` only in their own `finally`.

### C-3 — Order state leaks between ticker tabs

> **Remediation:** **Fixed** — `key={activePosition.id}` / `key={activeWatchlistTicker}` in `5ca1bcd` (Lane 1.1); hook clears state on `underlying` change in Phase 3.

**Files:** `src/WheelDashboard.tsx:137-152`, `src/components/OpenOptionsSection.tsx:97-100`, `src/hooks/usePendingOptionOrder.ts:169-250`

The detail views are rendered without a `key`:

```137:148:src/WheelDashboard.tsx
            ) : activePosition ? (
              <TickerDetail
                pos={activePosition}
                account={account}
                focusOpenOptions={focusOpenOptionsFor === activePosition.id}
                onFocusOpenOptionsHandled={clearOpenOptionsFocus}
                onPositionRefresh={refresh}
              />
            ) : activeWatchlistTicker ? (
              <WatchlistTickerDetail
                symbol={activeWatchlistTicker}
                account={account}
```

Switching from ticker A to ticker B renders the same component type in the same position, so React reconciles instead of remounting and `OpenOptionsSection` keeps all its state. Its only reset is partial:

```97:100:src/components/OpenOptionsSection.tsx
  useEffect(() => {
    setSelectedExpiration(null);
    setTicket(null);
  }, [symbol, side]);
```

`qty`, `busy`, `flashMsg`, `flashErr`, and `rollPending` are never cleared. More seriously, `usePendingOptionOrder` does not clear `order`/`phase` when `underlying` changes — the effect at `:169` only *overwrites* them if it finds an open order for the new symbol, and otherwise silently leaves the old ones in place (`catch { /* Non-fatal */ }`).

**Failure scenario.** You have a working sell-to-open on AAPL and click the TSLA tab. TSLA's page renders the banner `SELL 1× AAPL250801C00230000 · WORKING · OTHER ACTIONS LOCKED`; TSLA's entire SELL ladder is disabled because `locked` is still true; and the `CANCEL ORDER` button on the TSLA page cancels **the AAPL order**. If a roll was mid-flight, the `rollPending` effect (`:307-322`) can fire while TSLA is displayed and open a sell ticket for an AAPL contract under the TSLA header.

**Fix.** Force a remount per symbol — one line, and it eliminates the whole class:

```tsx
<TickerDetail key={activePosition.id} pos={activePosition} /* ... */ />
<WatchlistTickerDetail key={activeWatchlistTicker} symbol={activeWatchlistTicker} /* ... */ />
```

Independently, `usePendingOptionOrder` should clear `order`/`phase`/`error` at the top of its `underlying` effect so a stale order can never survive a symbol change.

### C-4 — `tickerTab.css` is dropped from the production bundle, breaking every detail-page header

> **Remediation:** **Fixed** in `5ca1bcd` — `@import "./theme/tickerTab.css"` moved to the top of `index.css` (before any non-`@import` rules).

**Files:** `src/index.css:10`, `src/theme/tickerTab.css`, `src/components/TickerTabLabel.tsx:12-18`

```10:12:src/index.css
@import "./theme/tickerTab.css";

button { all: unset; }
```

CSS requires `@import` to precede all statements except `@charset` and empty `@layer`. This one sits after the reset and scrollbar rules, so it is invalid and discarded. The build says so, and the output confirms it — the entire production stylesheet is 394 bytes and contains not one selector from the file:

```
*,*:before,*:after{box-sizing:border-box;margin:0;padding:0}html,body,#root{height:100%;background:#030310}::-webkit-scrollbar{...}button{all:unset}
```

All seven classes are in active use, and six are now completely unstyled in production:

| Class | Lost styling | Visible impact |
|---|---|---|
| `.ticker-tab-label` | `flex; column` | Container collapses to plain block flow |
| `.ticker-tab-label__symbol-group` | `flex; gap:10px` | **The ALPACA / WATCHLIST badge drops onto its own line** below the symbol |
| `.ticker-tab-label__symbol` | `28px Syne 800` | Ticker renders as a default `<h2>` — inherited monospace, wrong size and weight |
| `.ticker-tab-label__company` | `12px mono, #5a5a7a` | **Company name renders at 16px in `#c0c0e0`** — nearly as prominent as the ticker |
| `.ticker-tab-label__subtitle` | `12px mono, #5a5a7a` | Sector / "research view" text renders large and light grey |
| `.ticker-tab-label__badge` | `flex-shrink:0` | Moot once the flex row is gone |
| `.ticker-tab-bar__tab` | `cursor; transition` | No impact — `TabBar` re-declares both inline |

`TickerTabLabel` is rendered by both `TickerDetail` and `WatchlistTickerDetail`, so **every ticker detail page in production has a broken header**. Also note `.ticker-tab-bar__tab--active` is applied by `TabBar.tsx:39` but was never defined in the stylesheet at all.

Rated Critical on blast radius rather than danger — it is a one-line fix affecting every page in the app.

**Fix.** Move the `@import` above all rules, or better, import it from `main.tsx` alongside `index.css` so ordering cannot regress silently. Then confirm the built CSS grew.

### C-5 — The bar cache never backfills; analysis silently runs on truncated history

**File:** `backend/WheelStrategy.Api/Services/BarCacheService.cs:28-48`

`existing` is loaded with **no date filter**, and the incremental anchor only ever looks forward:

```43:48:backend/WheelStrategy.Api/Services/BarCacheService.cs
        // Incremental: only fetch from the last stored bar (or the requested start).
        var fetchFrom = existing.Count > 0
            ? existing[^1].BarStart           // refetch last (possibly-incomplete) bar + newer
            : start;

        var fetched = await alpaca.GetBarsAsync(symbol, timeframe, fetchFrom, ct);
```

Nothing compares `existing[0].BarStart` against the requested `start`. Once *any* bar for `(symbol, timeframe)` is cached, a request with a **wider** lookback can never pull the older bars.

**Failure scenario**, fully reachable since `lookbackDays` is a public query parameter:

1. `?symbol=NVDA&lookbackDays=90&granularity=daily` caches ~62 daily bars.
2. `?symbol=NVDA&lookbackDays=730&granularity=daily` finds `existing.Count == 62`, so `fetchFrom` is this week and only today's bar is fetched. The final `Where(b => b.BarStart >= start)` returns the same 62 bars.
3. With `dte=35`, `horizon = 25`, so `fwd.Count = 37` — above `MinSamples` (20). **The guard does not trip.**

The response advertises `LookbackDays: 730` while every strike suggestion, the realized volatility, and both assignment probabilities were computed from three months of data. Ninety days of NVDA sitting inside one trending regime produces an empirical forward-return distribution with a badly wrong mean and a compressed left tail, which moves the recommended put strike directly. `SampleCount: 37` looks plausible, so the caller has no way to detect it. The cache is never invalidated on a lookback mismatch, so it never self-heals.

**Fix.** Only use the incremental anchor when the cache already covers the requested start (`existing[0]` is valid because the query is `OrderBy(b => b.BarStart)`):

```csharp
var coversStart = existing.Count > 0 && existing[0].BarStart <= start;
var fetchFrom = coversStart ? existing[^1].BarStart : start;
```

Better still, record per-`(symbol, timeframe)` coverage bounds in a metadata table rather than inferring them from row extents — a recently-IPO'd symbol will always look "not covered" and re-fetch the full range on every call.

---

## 4. High

### Market data correctness

#### H-1 — The multi-symbol bar `limit` is a total, not per-symbol, so most symbols get nothing

**Files:** `src/api/fetchWheelPositions.ts:37-43`, `src/api/fetchStockQuotes.ts:24-30`

```37:43:src/api/fetchWheelPositions.ts
  const data = await marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", {
    symbols: symbols.join(","),
    timeframe: "1Day",
    start,
    limit: String(PRICE_HISTORY_DAYS),
    feed: "iex",
  });
```

Alpaca's documentation is explicit on both points — verified directly against the vendor reference:

> The limit applies to the total number of data points, **not per symbol**!

> The returned results are sorted by symbol first, then by bar timestamp. This means that you are likely to see only one symbol in your first response if there are enough bars for that symbol to hit the limit you requested.

The code then ignores `next_page_token`, which `AlpacaBarsResponse` declares (`alpacaTypes.ts:44`) and which `fetch52WeekRange` correctly follows sixty lines further down — which is why this reads as an oversight rather than a misunderstanding.

**Failure scenario.** A four-position portfolio requests ~44 trading bars per symbol with `limit=60`. Alphabetically the first symbol consumes 44, the second gets 16, and the third and fourth get **nothing**. `priceHistory[pos.symbol] ?? []` (`:187`) silently yields `[]`, so those tickers render an empty chart, no trend chips, and `—` for average price. Nothing surfaces an error.

It is worse in `fetchStockQuotes.ts:24-30`, which requests 5-minute bars for the whole watchlist with `limit: "1"`. Exactly **one** symbol receives a live intraday bar; the other nineteen in the seeded `target` watchlist fall through to `snap.dailyBar?.c`. During the session the watchlist shows the daily close for nearly every row, while the code path exists specifically to show a live price.

**Fix.** Scale the limit by symbol count and paginate, exactly as `fetch52WeekRange` already does:

```ts
limit: String(Math.min(10000, symbols.length * (PRICE_HISTORY_DAYS + 10))),
// ...then loop on data.next_page_token, merging pages
```

For the 5-minute call, `limit: String(symbols.length)` at minimum.

#### H-2 — Frontend bar requests omit `adjustment=all`

**Files:** `src/api/fetchWheelPositions.ts:37-43`, `:96-109`

The backend deliberately sends `adjustment=all` (`AlpacaMarketDataClient.cs:41`) and CLAUDE.md documents the bars as adjusted. Neither frontend bar request does, so both receive **raw** prices — Alpaca's default.

**Failure scenario.** For a symbol that split during the lookback window — NVDA's 10:1 is the codebase's own example ticker — `fetch52WeekRange` returns a pre-split high. `WatchlistTickerDetail.tsx:161-164` renders it as `52 Week Range`: a number roughly 10× the current price, presented as fact next to the live quote. SMA20/SMA50 and the 30-day slope are computed across the split boundary and are meaningless. The backend's analysis and the frontend's chart are then computed on two different price series for the same ticker.

**Fix.** Add `adjustment: "all"` to the params in both `fetchPriceHistory` and `fetch52WeekRange`.

#### H-3 — Only one option leg per underlying survives

**File:** `src/api/fetchWheelPositions.ts:123-138`, consumed at `:189-194`, `:226-228`

```129:137:src/api/fetchWheelPositions.ts
    optionsByUnderlying[parsed.underlying] = {
      type: parsed.type,
      strike: parsed.strike,
      expiration: parsed.expiration,
      premiumReceived,
      contracts,
      currentOptionPrice: parseFloat(opt.current_price),
      unrealizedPnL: parseFloat(opt.unrealized_pl),
    };
```

The map is keyed on underlying alone, so a second leg on the same name overwrites the first in whatever order Alpaca returns positions.

This is not an exotic case for a wheel desk: two CSPs at different strikes on the same name, a covered call plus a leftover protective put, or a roll that briefly leaves two legs open. And the consequence is worse than a missing row — `:194` computes `unrealizedPnL: parseFloat(pos.unrealized_pl) + (optData?.unrealizedPnL ?? 0)` from only the surviving leg, and `:190` computes `premiumCollectedTotal` from one leg. **The position row and the `SummaryDashboard` totals that reduce over it are wrong numbers presented as portfolio P&L**, not merely incomplete ones. A dropped losing leg makes the book look better than it is.

**Fix.** Accumulate all legs (`Record<string, OptionLeg[]>`), sum `unrealizedPnL` and `premiumCollectedTotal` across them, and pick a display leg deterministically (nearest expiration). If `activeOption` must stay singular for now, at minimum sum the P&L across every leg and show a "2 legs" indicator so the operator knows something is hidden.

#### H-4 — Snapshot sub-objects are dereferenced without optional chaining

**Files:** `src/api/fetchStockQuotes.ts:40`, `:45`, `:49`, `src/api/fetchWheelPositions.ts:169-170`, `:183-185`, `:206-207`, `src/hooks/useTickerSnapshot.ts:131-136`

`AlpacaSnapshot` declares `latestTrade`, `dailyBar`, and `prevDailyBar` as required, but Alpaca omits them for symbols with no activity on the requested feed — routine on the free **IEX** feed for thin names and outside regular hours. The code guards the container but not the members:

```169:170:src/api/fetchWheelPositions.ts
    const currentPrice = snap?.latestTrade.p ?? parseFloat(pos.current_price);
    const prevClose = snap?.prevDailyBar.c ?? parseFloat(pos.lastday_price);
```

The `?.` on `snap` does nothing for a present-but-incomplete snapshot. The inconsistency is the tell: `fetchStockQuotes.ts:49` guards `dailyBar?.c` and then dereferences `snap.latestTrade.p` on the same line, while `:40` guards neither.

**Failure scenario.** One illiquid watchlist symbol returns a snapshot without `prevDailyBar` → `TypeError` at `:40` → the whole `fetchStockQuotes` promise rejects → `useWatchlist.ts:54` swallows it in an empty `catch` → **every row in the watchlist shows no quote**, with no error and no log, because one symbol was quiet. The same shape in `fetchWheelPositions:169` aborts the entire positions load, and in `useTickerSnapshot:131` it produces a "Failed to load ticker" page for a symbol that is fine.

**Fix.** Optional-chain the whole path, and be explicit about missing data rather than substituting a number:

```ts
const closePrice = snap?.prevDailyBar?.c;
if (closePrice == null) continue; // or a null-quote sentinel the UI renders as "—"
```

#### H-5 — Errors are swallowed into zeros and stale values

**Files:** `src/api/fetchAccountDetails.ts:8`, `src/hooks/useWheelPositions.ts:34-37`, `src/hooks/useWatchlist.ts:54`

```ts
trading.get<AlpacaPosition[]>("/v2/positions").catch(() => [])
```

If the positions call fails while `/v2/account` succeeds, `costBasis` and `unrealizedPnL` are computed over an empty array and returned as **exactly `0`** — indistinguishable from a genuinely flat book. `AccountInfo.unrealizedPnL` is documented as "Sum of unrealized_pl across all open positions" and rendered as a dollar figure. An operator glancing at `$0.00` unrealized P&L on a book that is actually down five figures is precisely the silent failure that drives a bad trade.

The same pattern recurs: background refresh failures in `useWheelPositions` are discarded and `lastRefresh` simply stops advancing, with no staleness banner; watchlist quote failures are caught into `/* best-effort */` and stale prices keep rendering at full opacity while the footer still claims `5MIN DELAYED`.

Keeping last-good data instead of clobbering it with an error is the right instinct. Not telling the operator is not.

**Fix.** Distinguish "zero" from "unknown" in the type — make the fields nullable and render `—`. For the polling hooks, expose `staleSince` / `lastError` and render a visible degraded-data indicator. In a trading UI, "I don't know" must not look like `$0.00`.

#### H-6 — No request timeouts, no in-flight guard, and an N+3 fan-out that will trip Alpaca's rate limit

**Files:** `src/api/alpacaClient.ts:46-76`, `src/hooks/useWheelPositions.ts:23-69`, `src/api/searchAssets.ts:63-72`

Three compounding problems:

1. **No timeout anywhere.** No `fetch` passes `AbortSignal.timeout(...)`. A hung connection leaves `loading` true forever, and `withRetry` never fires because there is no response to inspect.
2. **No in-flight guard or response sequencing.** `fetchPositions` can be invoked from three places at once — the 5-minute interval, the 5-second working-order interval, and the `orderBlotter.subscribe` callback. Since the blotter dispatches an event on *every* mutation and the order machine appends a transition on each status poll ([M-8](#5-medium)), an active order produces a burst of overlapping full refreshes. Whichever resolves last wins `setPositions(data)` — so a slow earlier response can overwrite a newer one, showing pre-fill positions after the fill landed.
3. **Request amplification.** Each refresh is `/v2/positions` + snapshots + bars + **one `/v2/assets/{sym}` call per symbol**, uncached — company names never change, yet they are re-fetched every cycle. Ten positions is 13 requests per refresh; at the 5-second pending-order cadence that is ~156 requests/minute against Alpaca's 200/min budget, before the order poller, watchlist quotes, and per-tab analysis. Once 429s start, `withRetry` multiplies each failure by three more attempts and ignores `Retry-After`.

**Fix.** Add `signal: AbortSignal.timeout(15_000)` to every request; honour `Retry-After` in `withRetry`; add a sequence ref in `useWheelPositions` so stale responses are dropped and blotter bursts coalesce; memoize `fetchAssetNames` in a module-level `Map`.

### Order execution

#### H-7 — `done_for_day` is treated as a fill

**Files:** `src/api/optionOrders.ts:59-62`, `src/hooks/usePendingOptionOrder.ts:30`

```59:62:src/api/optionOrders.ts
/** Fully done — no further cancel. Partial fills stay cancelable. */
export function isOrderFilled(status: AlpacaOrderStatus): boolean {
  return status === "filled" || status === "done_for_day";
}
```

`done_for_day` means "no further updates today", not "executed". A DAY-TIF sell-to-open that never traded can end the session in `done_for_day` with `filled_qty === "0"`.

`toDeskState` maps it to `"filled"`, so the banner reads `FILLED — no longer cancelable`, `onPositionRefresh()` fires, and the roll flow will open the follow-on sell ticket for a leg that was never opened. The user believes they collected premium they did not collect, cannot cancel, and a roll may leave them naked.

**Fix.** Decide on quantity, not the status string:

```ts
export function isOrderFilled(o: Pick<AlpacaOrder, "status" | "filled_qty" | "qty">): boolean {
  if (o.status === "filled") return true;
  if (o.status === "done_for_day") return Number(o.filled_qty ?? 0) >= Number(o.qty);
  return false;
}
```

and map an unfilled `done_for_day` to a distinct terminal state that **unlocks** the underlying. Related: `done_for_day` is in `ACCEPTED_STATUSES` but not `OPEN_STATUSES`, so the three predicates currently disagree.

#### H-8 — Buy-to-close and roll fabricate a bid/ask, defeating the fat-finger guard

**File:** `src/components/OpenOptionsSection.tsx:218-228`, `:247-268`

```218:228:src/components/OpenOptionsSection.tsx
    setTicket({
      action: "buy_to_close",
      optionType: activeOption.type,
      contractSymbol,
      strike: activeOption.strike,
      expiration: activeOption.expiration,
      limitPrice: mid,
      bid: mid * 0.95,
      ask: mid * 1.05,
      mid,
    });
```

`mid` is `activeOption.currentOptionPrice` — a position mark from the positions poll, up to five minutes old. Synthesizing a bid/ask around it neutralizes both safety mechanisms in `preTradeCheck`:

- The fat-finger band (`preTradeCheck.ts:105-116`) compares `limit` against `mid`. Because `limitPrice === mid` by construction, the band is always exactly `0` — the 35% blocker and 15% warning can never fire on a close or roll.
- The `"No live bid/ask — using estimated premium"` warning fires only when **both** `bid` and `ask` are `null`. The fabricated ±5% values suppress it, so the ticket looks priced off a live two-sided market when nothing was fetched.

**Failure scenario.** A covered call collapses overnight. The stale mark is $4.20; the real market is $0.30/$0.40. The user clicks CLOSE, sees `LIMIT $4.20` / `EST. DEBIT $420` with no warnings, and confirms — paying up to $420 for a $35 position with no pre-trade check objecting. This runs in **live** mode, not just mock.

**Fix.** Fetch a live snapshot for the contract being closed — `/v1beta1/options/snapshots` is already wired up in `fetchFridayOptions`. Until then pass `bid: null, ask: null, mid: null` so the warning fires honestly, and surface the quote timestamp on the ticket.

#### H-9 — `reset()` discards a live order and re-enables SELL

**File:** `src/hooks/usePendingOptionOrder.ts:339-348`, `:421-429`, `src/components/OpenOptionsSection.tsx:464-484`

Path: POST succeeds → `transition("ack_pending", { order: created })` → `waitForOrderAcceptance` throws because the status GET fails (Alpaca 5xx past the three retries, or a dropped connection). The generic catch runs `transition("error", { clientOrderId: cid })` with **no `order` key**, so `nextOrder` falls back to `orderRef.current` — the still-live order. `"error"` is deliberately outside the `locked` set, which is what allows recovery.

The `place()` guard at `:266` still protects you *while `orderRef` holds the order*. But the UI renders a `DISMISS` button for `error` wired to `reset()`, which does `transition("idle", { clearOrder: true })` and untracks the order. After one click `orderRef.current === null`, `locked === false`, and the guard is gone. The next SELL submits a **second live order for the same underlying** — double the intended short exposure and double the collateral.

**Fix.** Make `reset()` refuse to clear an order whose last-known status is open; require an explicit cancel, or re-query the broker before clearing.

#### H-10 — A partially-filled order that is then cancelled is silently erased

**Files:** `src/hooks/usePendingOptionOrder.ts:383-390`, `src/components/OpenOptionsSection.tsx:131-134`

`partially_filled` is correctly cancelable. When the venue confirms the cancel, the final order returns `status: "canceled"` with `filled_qty > 0` — and `filled_qty` is never inspected. The UI flashes `ORDER CANCELED — actions unlocked`, and `onPositionRefresh` runs only on `orderPhase === "filled"`, so the newly-opened short contracts never appear.

**The user is short N contracts, believes they are flat, sees an unlocked SELL button, and can stack another sale on top of an unrecognized position.**

**Fix.** Check `Number(final.filled_qty ?? 0) > 0` in the confirmed-cancel branch and surface a distinct outcome that shows the filled quantity and triggers `onPositionRefresh`.

#### H-11 — Sell-to-open is unreachable in mock mode

> **Remediation:** **Fixed** in `9b9b9c7` (Lane 1.2). Mock rows use `buildOsiSymbol(...)` and `FridayOptionRow.tradable`; `preTradeCheck` gates on `ticket.tradable !== false`.

**Files:** `src/api/fetchFridayOptions.ts:194-197`, `src/components/OpenOptionsSection.tsx:180`, `src/api/preTradeCheck.ts:56`

*Historical description (pre-fix):*

In `IS_MOCK`, `fetchFridayOptions` builds rows with no contracts, so `contractSymbol` becomes the synthetic `MOCK{LEVEL}{strike}`. `OpenOptionsSection` then passes `tradable: !ticket.contractSymbol.startsWith("MOCK")` → `false` → `preTradeCheck` pushes the blocker `"Contract is not tradable"` → `canSubmit` is false and the CONFIRM/SIMULATE button is **permanently disabled**.

So the mock order store, the phase machine, `waitForOrderAcceptance`, and the cancel-confirmation path cannot be exercised without live keys. This is the enabling condition for most of the execution bugs above: **the only environment in which the state machine can be driven end to end is one placing real orders.** The `tradable` guard itself is correct and valuable in live mode — the problem is the mock symbol tripping it.

**Fix.** In mock mode synthesize plausible OSI symbols via `buildOsiSymbol(...)` instead of the `MOCK` prefix, and gate tradability on a real `row.tradable` flag rather than a string prefix.

#### H-12 — Contract `multiplier` / `size` / `tradable` are ignored

**Files:** `src/api/fetchFridayOptions.ts:181-225`, `src/api/preTradeCheck.ts:68`, `:75-84`

`AlpacaOptionContract` carries `multiplier`, `size`, and `tradable`. None are read, and everything downstream hardcodes 100: `estCashFlow = px * qty * 100`, `collateralRequired = strike * 100 * qty - credit`, covered-call capacity `Math.floor(shares / 100)`.

Adjusted contracts (post-split, special dividend, merger) routinely have a deliverable other than 100 shares. Selling one as if it were standard understates collateral and overstates covered-call coverage — **you write an uncovered call believing it's covered**. Compounding this, `fetchContracts` doesn't filter `root_symbol`, so adjusted roots (`AAPL1`, `NVDA2`) are eligible for nearest-strike snapping.

**Fix.** Carry `multiplier`, `size`, `tradable`, and `root_symbol` onto `FridayOptionRow`; filter to `root_symbol === symbol && multiplier === "100"`; pass the real `tradable` into `preTradeCheck`.

#### H-13 — Option limit prices are not rounded to a valid tick

**Files:** `src/api/fetchFridayOptions.ts:92-95`, `src/api/optionOrders.ts:157`

```92:95:src/api/fetchFridayOptions.ts
function roundPrice(n: number): number {
  // Options under $3 often trade in $0.01; above in $0.05 — keep cents for simplicity.
  return Math.max(0.01, Math.round(n * 100) / 100);
}
```

The comment states the rule and then ignores it. Quotes at or above $3.00 must be in $0.05 increments under the Penny Interval Program. A mid of $4.235 becomes a $4.24 limit, which the venue rejects for a tick violation — surfacing as POST 422 → `orphan_check` → `error`, i.e. a failed submit for **most contracts priced above $3**.

**Fix.** Round to the correct increment, and away from you so rounding never worsens your price:

```ts
function roundLimit(px: number, side: "buy" | "sell"): number {
  const t = px < 3 ? 0.01 : 0.05;
  const n = side === "sell" ? Math.floor(px / t) : Math.ceil(px / t);
  return Math.max(t, Math.round(n * t * 100) / 100);
}
```

### Values shown to the operator

#### H-14 — The HMM forecast applies the terminal state's mean to every period

**File:** `backend/WheelStrategy.Api/Services/HmmTrendService.cs:86-102`

```92:94:backend/WheelStrategy.Api/Services/HmmTrendService.cs
            var stateProbs = GaussianHmm.ForecastStateProbs(model, current, horizonPeriods);
            var periodReturn = GaussianHmm.ExpectedPeriodReturn(model, stateProbs);
            var expectedPct = (Math.Exp(periodReturn * horizonPeriods) - 1.0) * 100.0;
```

`ForecastStateProbs` returns π_H = π₀Pᴴ — the distribution after **all** H transitions. `periodReturn` is therefore the expected return in the *final* period only. Multiplying by `H` assumes the chain sits in its H-step distribution for all H periods, which is backwards: π_H is the most mixed, least informative point in the trajectory. The correct quantity is Σ_{h=1..H} π₀Pʰ · μ.

**Magnitude.** With the model's own initialization (0.7 diagonal, 0.15 off-diagonal) the non-unit eigenvalue is 0.55, so π_h decays to uniform quickly. For a confidently-bear π₀ = [1,0,0] and weekly means μ = [−0.020, 0.000, +0.015], the correct 5-week cumulative is **−2.92%**; the code produces **−1.29%**. The forecast understates by 2.3×, and the error grows with H — at long horizons the endpoint reports roughly H × the unconditional mean, which is what an HMM with no states would give you.

**Fix.** Accumulate along the path:

```csharp
var probs = current.ToArray();
var cumLogReturn = 0.0;
for (var h = 0; h < horizonPeriods; h++)
{
    probs = GaussianHmm.ForecastStateProbs(model, probs, 1);
    cumLogReturn += GaussianHmm.ExpectedPeriodReturn(model, probs);
}
var expectedPct = (Math.Exp(cumLogReturn) - 1.0) * 100.0;
```

`StateProbs`, `BearProb`, and `BullProb` are correct as-is — only `ExpectedReturnPct` is wrong.

#### H-15 — The HMM panel renders every probability 100× too small

**Files:** `src/components/ResearchSection.tsx:173`, `:204`, `src/components/HmmTrendChart.tsx:237-241`, `src/utils/formatters.ts:15`

`fmt.pct` does **not** multiply by 100 — it assumes its input is already a percentage:

```15:15:src/utils/formatters.ts
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
```

Every other caller honours that contract (`dayChangePct`, `chgPct`, `snap.changePct` all pre-multiply). The HMM call sites do not — and the backend DTOs confirm these are raw probabilities in [0,1]:

| Site | Input | Renders | Should render |
|---|---|---|---|
| `HmmTrendChart.tsx:239-241` — `fmt.pct(row.bearProb)` etc. | 0–1 | `+0.18%` | `18%` |
| `ResearchSection.tsx:173` — `fmt.pct(prob)` | 0–1 | `+0.62%` | `62%` |
| `ResearchSection.tsx:204` — transition matrix | 0–1 | `+0.85%` | `85%` |
| `HmmTrendChart.tsx:237` — `fmt.pct(row.expectedReturnPct / 100)` | already ×100 | `+0.03%` | `+2.50%` |

The sibling hover strip in the same component gets it right (`(hovered.stateProbs[i] * 100).toFixed(0)`, `:190`), so the two disagree side by side — the hover says `62%` while the pill above says `+0.62%`.

A trader reads near-zero conviction in every regime and a flat forecast when the model is actually 71% bull with a +2.5% expected move.

**Fix.** Add `fmt.pctFromRatio` and use it at the four probability sites; drop the erroneous `/ 100` on `expectedReturnPct`.

#### H-16 — Changing the expiration shows the previous expiration's strikes under the new header

**Files:** `src/components/OpenOptionsSection.tsx:672`, `:737-747`, `:762`, `src/hooks/useFridayOptionSuggestions.ts:52-76`

`load()` sets `setLoading(true)` but never clears `data`, and the ladder renders whenever `data` is truthy with no dimming. The header meanwhile reads from `pickerExpiration`, which updates immediately on select. The loading placeholder is gated on `loading && !data`, so it never appears during a re-fetch, and the SELL buttons are gated only on `locked || !!ticket` — not on `loading`.

**Failure scenario.** The user switches EXP from 2026-07-31 to 2026-09-18. The header instantly reads `DTE 55` while the rows below are still the 6-DTE contracts. They click SELL on what they read as a 55-DTE put and sell the 6-DTE contract. The ticket shows the correct (old) expiration — but the decision was already made from a header that lied.

**Fix.** Clear rows while the bundle is in flight, disable SELL while `loading`, and render `data.expiration` rather than `pickerExpiration` in the DTE/SPOT strip.

#### H-17 — The TopBar REFRESH button silently swallows every error

> **Remediation:** **Fixed** in `5ca1bcd` — `onRefresh={() => void refresh()}` so React does not pass a `MouseEvent` as the `background` flag.

**Files:** `src/WheelDashboard.tsx:91`, `src/hooks/useWheelPositions.ts:23-41`, `:71`

`refresh` *is* `fetchPositions`, whose signature is `async (background = false)`. It is passed straight through as `onRefresh={refresh}` and then to `onClick={onRefresh}`, so React invokes it with the synthetic event — **`background` receives a truthy `MouseEvent`**. Every manual refresh therefore runs in background mode, which suppresses both the loading state and the error:

```23:41:src/hooks/useWheelPositions.ts
  const fetchPositions = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    ...
    } catch (e) {
      if (!background) {
        setError(e instanceof Error ? e.message : "Failed to load positions");
      }
```

TypeScript cannot catch it: `(background?: boolean) => Promise<void>` is assignable to `() => void`.

**Failure scenario.** Alpaca returns 401 on an expired key. The user clicks `↻ REFRESH`. No loading state, no error banner, and the position cards keep showing last-known prices as if current. The only signal is a timestamp in `#2a2a4a` against `#07071a` that stops advancing.

**Fix.** `onRefresh={() => void refresh()}`.

### Platform, supply chain, and verification

#### H-18 — `Microsoft.OpenApi` 2.0.0 carries a known high-severity advisory

**File:** `backend/WheelStrategy.Api/WheelStrategy.Api.csproj`

```
> Microsoft.OpenApi   2.0.0   High   https://github.com/advisories/GHSA-v5pm-xwqc-g5wc
```

It arrives transitively through `Microsoft.AspNetCore.OpenApi` and surfaces as `NU1903` on every build.

**Fix.** Pin an explicit patched version, matching the pattern already used for `SQLitePCLRaw.bundle_e_sqlite3` (which has a good explanatory comment at `.csproj:18-20`). Also note the **floating versions** (`10.*`, `9.*`) make builds non-reproducible, and EF Core is pinned to `9.*` while the project targets `net10.0`.

#### H-19 — Generated API types are stale and the contract rule is being bypassed

> **Remediation:** **Fixed** — types in `5ca1bcd`; CI gates `check:api` in Lane 1.3.

**Files:** `src/api/generated/analysis.ts`, `src/types.ts:97-130`

*Historical description (pre-fix):*

`npm run check:api` **fails**. Regenerating from the committed OpenAPI document produces a 73-insertion / 18-deletion diff. Missing from the committed TypeScript: the `/api/catalysts` path, the `CatalystEventDto` / `TickerCatalystsResult` / `HmmStateSnapshot` schemas, and changes to `StrikeSuggestion`.

The backend's `WheelStrategy.Api.json` is current — only the TypeScript lagged. Meanwhile `CatalystEvent` and `TickerCatalystsResult` have been **hand-written** in `src/types.ts:97-130`, and that is what `fetchCatalysts.ts` imports.

This is precisely the drift the pipeline in [CLAUDE.md](../CLAUDE.md) exists to prevent. The catalysts wire shape is now defined twice, in two languages, with nothing checking they agree — a backend field rename would compile cleanly on both sides and fail at runtime.

Worth noting the analysis types get this exactly right: `types.ts:53-63` narrows the generated types by `Omit`-and-intersect rather than duplicating them. The catalysts types are the exception, not the rule.

**Fix.** Run `npm run gen:api`, commit it, delete the hand-written duplicates, and wire `check:api` into CI so the guard that already exists actually gates something.

#### H-20 — Unvalidated inputs, unhandled exception types, and a logged API key on the backend

**Files:** `Endpoints/*.cs`, `Program.cs`, `Services/CatalystsService.cs:80-82`

Four related gaps that together make the backend fragile and hard to diagnose:

- **Unbounded `lookbackDays`.** Validation is only `> 0`, so `?lookbackDays=2000000000` makes `DateTime.AddDays` throw `ArgumentOutOfRangeException` → unhandled → **500 with a developer stack trace** (the app runs in Development per `launchSettings.json`, with no `UseExceptionHandler`). Below the overflow threshold it is a cost attack: `lookbackDays=100000` drives the pagination loop through many pages of a metered third-party API, unauthenticated and unrate-limited.
- **Only `HttpRequestException` is caught.** `HttpClient` timeouts throw `TaskCanceledException` since .NET 5. `JsonException`, `DbUpdateException`, and the above all escape as 500s. No timeout is configured on either typed client, so the default 100 s applies per request.
- **The Finnhub API key is interpolated into the request URL** (`CatalystsService.cs:80-82`). `IHttpClientFactory` logs `Start processing HTTP request GET {Uri}` at Information level, and `appsettings.json` sets `Default: Information` — so the token is written to the console and any sink. This is exactly what `FinnhubOptions.cs:6` mandates user-secrets to prevent, and the Alpaca client does it correctly with headers.
- **No `ILogger` anywhere.** Not one service or endpoint injects a logger. When Alpaca 429s, when the cache is wiped, or when an HMM fit throws (swallowed into a warning string), there is no server-side record.

**Fix.** Clamp `lookbackDays` and `dte` and validate `symbol` at the endpoints; add `AddProblemDetails()` + `UseExceptionHandler()`; set explicit `HttpClient` timeouts; move the Finnhub token to the `X-Finnhub-Token` header and set `"System.Net.Http.HttpClient": "Warning"`; inject `ILogger`. **Rotate the Finnhub key** — it has been in the logs.

#### H-21 — The analysis engine and the order state machine have no tests

**Files:** `backend/**` (no test project), `src/hooks/usePendingOptionOrder.ts`, `src/api/fetchFridayOptions.ts`, `src/api/tradeUpdatesStream.ts`

The 61 passing tests are real and well-written, but they miss the areas where a bug costs money.

| Component | Lines | Tests |
|---|---|---|
| Entire .NET backend (`StatMath`, `GaussianHmm`, `WheelAnalysisService`, `BarCacheService`) | ~1,500 | **none — no test project exists** |
| `usePendingOptionOrder.ts` (order state machine) | 454 | **none** |
| `fetchFridayOptions.ts` (strike snapping, limit pricing) | 336 | **none** |
| `tradeUpdatesStream.ts` (live order updates) | 193 | **none** |

Of sixteen test files, exactly one covers a component. `OpenOptionsSection`, `OrderTicket`, and `SummaryDashboard` — the three files where a bug places or mis-prices a real order — have none.

Every strike recommendation comes out of untested code. `StatMath` is pure and dependency-free, and Black-Scholes has published reference values, so these are cheap tests. [H-14](#h-14--the-hmm-forecast-applies-the-terminal-states-mean-to-every-period) is a formula error any golden-value test would have caught, and [C-2](#c-2--place-aborts-its-own-acceptance-wait-leaving-a-live-unmonitored-order), [C-3](#c-3--order-state-leaks-between-ticker-tabs), [H-7](#h-7--done_for_day-is-treated-as-a-fill) and [H-16](#h-16--changing-the-expiration-shows-the-previous-expirations-strikes-under-the-new-header) are all straightforwardly testable with `@testing-library/react`, already a dependency.

---

## 5. Medium

**Data and network**

| ID | Finding | File |
|---|---|---|
| M-1 | `parseFloat` on broker string fields produces `NaN` that reaches the screen as `$NaN`. `fmt.currency`/`fmt.pct` have no `Number.isFinite` guard, and `dayChangePct` divides by `previousClose` with no zero check — reachable via the CSP-only path where `prevClose` can be `0`. In `SummaryDashboard.tsx:42-43`, `positionDeployed \|\| account?.costBasis` then *masks* a `NaN` total (NaN is falsy) with an unrelated number, so the header looks plausible while rows show `$NaN`. | `fetchWheelPositions.ts:127-194`, `formatters.ts:3-23` |
| M-2 | Empty price history yields a `NaN%` trend chip: `Math.min(...[])` is `Infinity`, which passes the `periodLow > 0` guard, and `pctFromLevel` only rejects `level <= 0`. (`periodHigh` is `-Infinity` and correctly skipped — the asymmetry is the bug.) Triggered by [H-1](#h-1--the-multi-symbol-bar-limit-is-a-total-not-per-symbol-so-most-symbols-get-nothing). | `trendMetrics.ts:131-140` |
| M-3 | `averageClosingPrice` has no minimum-sample check, so with 6 bars the "1M (21-session)" average is a 6-bar mean, returned as a plain number and labelled `Average Price (1W/1M)`. Its sibling `simpleMovingAverage` correctly returns `null` — two functions doing the same job with opposite contracts, and the UI uses the permissive one. | `priceAverages.ts:4-19` |
| M-4 | `refresh()` runs with no abort signal, so `!signal?.aborted` is always true and it always writes state. Click REFRESH at DTE 35, then select DTE 21: the slower refresh lands afterwards and renders the DTE-35 ladder under the `21` header. Also `setState`s after unmount. | `useWheelAnalysis.ts:41`, `useHmmTrend.ts:40` |
| M-5 | Broker-switch race: neither hook guards against a response from the previous broker, so switching to E\*TRADE can display Alpaca balances. Capped today because only `alpaca-paper` is enabled — but `alpaca-live` is one line away, and mixing live and paper balances is the worst version. `useAccountDetails` also flashes its full loading state every 5 minutes; `useAccountActivities` got this right with a `background` flag. | `useAccountDetails.ts:12-36`, `useAccountActivities.ts:12-39` |
| M-6 | The same data is fetched 3–4× per ticker tab: `useTickerCatalysts` twice (from `CatalystsAndNews` and `OpenOptionsSection`), and `fetchWheelAnalysis` three times (`WheelAnalysisPanel`, `useVolatilityMetrics`, and `fetchAtmImpliedVol` internally). Each can trigger a backend bar refresh. StrictMode doubles all of it in dev. No request cache anywhere. | `OpenOptionsSection.tsx:93`, `useVolatilityMetrics.ts:17-18` |
| M-7 | `fetch52WeekRange` is uncached and re-runs on every tab open, paging 370 days at `limit=10000` per symbol, with no page cap and no timeout. A 52-week range changes at most daily. | `fetchWheelPositions.ts:86-112` |
| M-8 | Every poll tick writes a blotter transition even when `to === from`, so a resting order writes a row every 5 s. With `MAX_TRANSITIONS = 500`, ~42 minutes evicts the entire real audit trail, plus a full `localStorage` parse/stringify per tick. | `usePendingOptionOrder.ts:95-106` |
| M-9 | Zero runtime validation of network JSON — `res.json() as Promise<T>` everywhere. The `as` is an unchecked assertion at exactly the boundary that produces [H-4](#h-4--snapshot-sub-objects-are-dereferenced-without-optional-chaining). A backend returning `level: "aggressive"` yields `LEVEL_COLOR[r.level] === undefined`. | `alpacaClient.ts:75`, `:93` |
| M-10 | Every price comes from the hard-coded IEX feed, which carries a small single-digit share of consolidated volume — the root cause of [H-4](#h-4--snapshot-sub-objects-are-dereferenced-without-optional-chaining). The backend makes this configurable; the frontend does not. | `fetchWheelPositions.ts:42`, `fetchStockQuotes.ts:21` |

**Order execution**

| ID | Finding | File |
|---|---|---|
| M-11 | Space-padded OSI symbols sent on close and roll. `buildOsiSymbol` pads the root to six chars (`"SPCX  260724P00102000"`, locked in by the test) but Alpaca expects the compact form. Sell-to-open is unaffected — it uses Alpaca's own `row.contractSymbol` — consistent with close/roll never having been exercised. | `optionOrders.ts:323-337` |
| M-12 | `localStorage` failure permanently bricks SELL: `save()` has no try/catch, and `transition("submitting")` sits *outside* `place()`'s try block, so a throw escapes without running `finally { flightRef.current = false }`. | `orderBlotter.ts:69-72`, `usePendingOptionOrder.ts:270-284` |
| M-13 | Assignment probabilities don't match the strike shown. `nearestContract` snaps the strike and recomputes `pctFromSpot`, but copies the probabilities and premium verbatim from the un-snapped suggestion. No distance guard and no dedupe when suggestions collapse onto one contract. | `fetchFridayOptions.ts:188-222` |
| M-14 | `% OTM` colour is inverted for puts: a safe strike 8% below spot renders `-8.0%` in **red** while a risky strike above spot renders green. | `OpenOptionsSection.tsx:774-781` |
| M-15 | CSP collateral is checked against `buyingPower`, which on a Reg-T margin account is ~2× equity — permitting about twice the available cash and turning cash-secured puts into naked puts. Alpaca exposes `options_buying_power`. The check is also stateless about other working orders. | `preTradeCheck.ts:84-92` |
| M-16 | Ladder quotes are fetched once and never refreshed, with no staleness indicator. A ticket confirmed twenty minutes later uses a twenty-minute-old limit — and the fat-finger band compares it against the equally stale mid, so it always passes. | `useFridayOptionSuggestions.ts:78-97` |
| M-17 | Timezone bugs in expiration handling: `nextFriday()` returns today when today is Friday with no time check, so after 16:00 ET the default expiration is already dead; `dteUntil` parses `${expiration}T16:00:00` as **local** time, so DTE differs by locale and shifts the backend's strike suggestions; `preTradeCheck`'s expiry blocker has the same bug. | `nextFriday.ts:13-27`, `preTradeCheck.ts:58-61` |
| M-18 | Market-hours gating can strand a locked order: `new Date(toLocaleString(...))` re-parses a non-ISO string (implementation-defined; `Invalid Date` on some engines makes `isMarketOpen()` permanently false), and there is no holiday calendar. Either way a working order is never refreshed and `locked` stays true. | `marketHours.ts:2-9` |
| M-19 | Two concurrent pollers race during cancel — a 5 s interval plus `waitForOrderCanceled` at 1 s, both driving `transition`. The interval can reach `"canceled"` (not in `locked`) while `cancel()` is still awaiting, briefly unlocking SELL. | `usePendingOptionOrder.ts:374-406` |
| M-20 | Roll ticket can label a call as a put: `optionType` derives from `canCoverCall` alone while `openRow` comes from `side`. A naked short call then passes the CSP collateral branch instead of the covered-call branch that would have blocked it. | `OpenOptionsSection.tsx:257-268` |
| M-21 | `buy_to_close` never verifies the short position exists — no `position_intent`, so a stale `activeOption` turns it into a **buy-to-open**. | `OpenOptionsSection.tsx:205-229` |
| M-22 | Quantity isn't clamped to `maxQty` (the ticket shows `max 20` and accepts 200), and `acked` isn't reset when `qty` changes. Parsing itself is safe. | `OrderTicket.tsx:40`, `:85-102` |
| M-23 | The one-order-per-underlying invariant is per-hook-instance — `place()` never consults `orderBlotter.getOpenForUnderlying()`. Two tabs can each place an order for the same underlying, even though the blotter already has cross-tab `storage` sync. | `usePendingOptionOrder.ts:263-268` |

**Backend**

| ID | Finding | File |
|---|---|---|
| M-24 | Concurrent same-symbol requests violate the unique index: read-modify-write with no transaction or lock, so the loser throws `DbUpdateException` → uncaught → 500. Easy to hit since the analysis and HMM panels render together. | `BarCacheService.cs:28-79` |
| M-25 | `refresh=true` deletes cached bars *before* the fetch succeeds, so a 429 leaves the cache destroyed and returns 502. Unauthenticated `?refresh=true` is a free cache-buster. | `BarCacheService.cs:36-48` |
| M-26 | `NaN` is coerced to `0` on every probability, premium, and yield, converting "this calculation failed" into "0% assignment probability, $0.00 premium" — the failure value looks like the most attractive possible trade. Reachable whenever `sigma` is 0 or spot is missing. | `WheelAnalysisService.cs:144-145` |
| M-27 | HMM daily horizons treat calendar days as trading days (35 → ~49 calendar) while `WheelAnalysisService.cs:41` correctly uses `days * 5/7`; and weekly rounds both `5` and `10` days to 1 period, so those two forecast rows are byte-identical under different labels. | `HmmTrendService.cs:22`, `:88-90` |
| M-28 | Realized vol drives `EstPremium`, but options trade at implied vol — typically 2–4 points higher. At S=170, T=35/365, a 3-point gap is ≈ $0.55 on a ~$5 put: an **11% understatement** of the yield used to compare strikes. Undisclosed while the `warnings` list covers lesser caveats. | `WheelAnalysisService.cs:69`, `:106` |
| M-29 | Effective sample size is far below `SampleCount`: `MinSamples = 20` is checked against the *overlapping* count, so for the weekly default (`horizon = 5`) passing the guard means roughly **4 independent observations**. Tail quantiles at p = 0.15 from 4 samples are noise. | `WheelAnalysisService.cs:76-84` |
| M-30 | `asOf` reports `DateTime.UtcNow` for a possibly days-old cached close, and — unlike every other degradation here — appends no warning. | `WheelAnalysisService.cs:54` |
| M-31 | Non-finite doubles in the HMM response would throw at serialization: no `Round` guard, and `Normalize`'s `if (sum <= 0)` is false when `sum` is `NaN`. Defensive — but `PctFromSpot` *is* unguarded and yields `Infinity` if spot is 0. | `GaussianHmm.cs:282-293` |
| M-32 | The `1e-10` variance floor (σ = 1e-5, ~3000× below plausible weekly returns) prevents division by zero but not the degeneracy where one state collapses onto a few observations and is reported as a "regime". | `GaussianHmm.cs:134`, `:277` |
| M-33 | Upstream response bodies are read unbounded and echoed to the client as `detail:`, disclosing infrastructure details and confirming key state on auth failures. | `AlpacaMarketDataClient.cs:52-56` |

**State, UI, and process**

| ID | Finding | File |
|---|---|---|
| M-34 | A malformed `version: 2` payload crashes the app permanently: `migrate` trusts any object whose `version` is `2` without checking `watchlists` is a non-empty array, then `getDefaultWatchlist` calls `.find()` on `undefined` — inside a `useState` initializer, so the app white-screens and stays broken on reload because the bad value persists. | `watchlistStore.ts:42-59` |
| M-35 | `save()` is unguarded, so a `QuotaExceededError` (the append-only blotter shares the same origin budget) or Safari private mode throws out of every mutator into React. | `watchlistStore.ts:61-63` |
| M-36 | The `target` watchlist is force-synced on every load, silently deleting user additions and overwriting edited notes. From the operator's view, tickers added yesterday are gone this morning with no message. | `watchlistStore.ts:97-136` |
| M-37 | No cross-tab sync for the watchlist — last write wins, while `orderBlotter.subscribe` demonstrates the intended pattern. | `watchlistStore.ts` |
| M-38 | `useWatchlist` clears all quotes and re-fetches everything whenever `entries` changes identity — and `add` triggers two such changes, so adding one ticker blanks all 20 rows. `refreshQuotes` also has no sequencing, and its `finally` clears the loading flag for a *different* in-flight call. | `useWatchlist.ts:61-67` |
| M-39 | `button { all: unset }` resets `outline-style` to `none`… | `index.css:12` — **fixed `5ca1bcd`** |
| M-40 | The focus highlight never fades: `onFocusHandled?.()` at t=60 ms flips `focusSection`, changing the dependency and clearing the t=2400 ms timer before it fires. The amber "attention" ring stays for the session. | `OpenOptionsSection.tsx:115-128` |
| M-41 | `SummaryDashboard` recomputes the ledger and metrics every render, `useOpenBlotterOrders` returns a fresh array on every blotter event, and each card renders an unmemoized recharts `Sparkline`. `withRunningBalances` also silently assumes `activities` is newest-first. | `SummaryDashboard.tsx:80-105` |
| M-42 | `PriceTrendChart` dereferences `data.find(...)!.date` eighteen lines *before* its own `if (chartData.length === 0) return null`. Empty data or one `NaN` price throws a `TypeError` that unmounts the whole detail page — there is no error boundary anywhere. Latent because `PriceTrendSection` guards upstream. | `PriceTrendChart.tsx:45-49` |
| M-43 | ~~A tracked, never-type-checked duplicate of the root component…~~ **deleted `5ca1bcd`** | ~~`WheelDashboard.tsx` (root)~~ |
| M-44 | No linter… | repo root — **fixed Lane 1.3** |
| M-45 | Dev-dependency advisories: 4 total (`postcss` high, `js-yaml` moderate). Production deps are clean, but the PostCSS path-traversal issue touches the build pipeline. | `package.json` |
| M-46 | 745 kB single bundle, no code splitting. Recharts dominates and is needed only by the chart components. | `vite.config.ts` |

---

## 6. Low

| ID | Finding | File |
|---|---|---|
| L-1 | HMM log-likelihood sign is inverted; harmless today since convergence uses `Math.Abs`, but wrong for any future AIC/BIC use. The non-standard backward-pass scaling is **not** a bug — it cancels in the `gamma`/`xi` normalization. | `GaussianHmm.cs:78` |
| L-2 | `prevLl` isn't updated before `break`, so the returned log-likelihood is one iteration stale. | `GaussianHmm.cs:78-80` |
| L-3 | A full O(T·N²) Viterbi decode runs on every request and is never read. | `GaussianHmm.cs:140` |
| L-4 | HMM history dates misalign if any bar has a non-positive close — `logReturns` skips it but line 81 indexes `series[t+1]` assuming 1:1. | `HmmTrendService.cs:47-54` |
| L-5 | `StateMeans` multiplies a periodic **log** return by `periodsPerYear` and labels it a percentage; a 50% annualized log return is a 65% simple return. | `WheelAnalysisService.cs:122` |
| L-6 | Unrecognized `granularity` silently becomes weekly. | `WheelAnalysisService.cs:35` |
| L-7 | Strike grid ($1 / $0.50) doesn't match real chains; `Math.Round` also uses banker's rounding. Harmless since the frontend snaps to listed contracts. | `WheelAnalysisService.cs:138-142` |
| L-8 | Covered-call yield uses spot while CSP uses strike — defensible but asymmetric and undocumented. Annualization is simple, not compounded. | `WheelAnalysisService.cs:107`, `:119` |
| L-9 | Risk-neutral `N(-d2)` sits alongside a real-world empirical frequency; for μ ≈ 15% vs r = 4.5% the gap is ~2.2 points, always in the same direction. Worth one line in `warnings`. | `StatMath.cs:88-99` |
| L-10 | The Abramowitz–Stegun erf has *absolute* error 1.5e-7, so tail probabilities below ~1e-6 are meaningless. Fine for the 0.15–0.45 range in use. | `StatMath.cs:62-74` |
| L-11 | Pagination loops have no page cap; a stable `next_page_token` would spin forever inside a request that has no timeout. | `AlpacaMarketDataClient.cs:34-64`, `fetchFridayOptions.ts:112-131` |
| L-12 | `MacroSchedule` is a hard-coded FOMC/CPI calendar ending 2026-09-16; after that `UpcomingMacro` silently returns nothing. | `CatalystsService.cs:18-24` |
| L-13 | Empty `catch (HttpRequestException)` and no `Warnings` field on `TickerCatalystsResult`, so "no earnings scheduled" is indistinguishable from "the provider is down" — a meaningful difference when the point is avoiding an earnings print before expiry. | `CatalystsService.cs:46-49` |
| L-14 | `listOpenOptionOrdersForUnderlying` uses `nested: "true"` (which groups multi-leg legs under a parent) and `limit: "50"` with no pagination, so it can miss the order it is looking for. | `optionOrders.ts:276-288` |
| L-15 | Websocket churn: `close()` sets `state = "closed"` synchronously while `ws.close()` is async, so a second socket can open before the first finishes. Alpaca allows one `trade_updates` connection per account. A bad key produces an infinite backoff loop. | `tradeUpdatesStream.ts:53-59` |
| L-16 | The stream broadcasts everything when nothing is tracked; harmless now because the consumer re-filters, but a footgun. `untrack` is never called for filled orders. | `tradeUpdatesStream.ts:146-149` |
| L-17 | `sleep()` never removes its `abort` listener on the normal path — ~45 accumulate during a cancel wait. | `optionOrders.ts:339-355` |
| L-18 | No liquidity or minimum-premium guard: `roundPrice` floors at $0.01, `open_interest` is displayed but never gates a trade, and there is no max-spread check. | `fetchFridayOptions.ts:88` |
| L-19 | `looksLikeOptionSymbol`'s `\|\| symbol.length >= 15` fallback matches any long ticker. | `optionOrders.ts:290-292` |
| L-20 | `crypto.randomUUID()` is undefined outside secure contexts, so serving the preview over `http://<lan-ip>` throws during watchlist init and white-screens the app. | `watchlistStore.ts:29-31` |
| L-21 | `withDefaultSeeds` writes to `localStorage` as a side effect of a read, inside a `useState` initializer — a write during render. `syncFromStore` calls `getState()` three times per mutation. | `watchlistStore.ts:159-177` |
| L-22 | `ensureNamedWatchlist` can create a watchlist and report `changed: false` when the seed list is empty, so it is never persisted. | `watchlistStore.ts:85-108` |
| L-23 | `fetchTickerNews` and `fetchAtmImpliedVol` accept a `signal` and honour it only in the mock branch — the real path calls `marketData.get`, which has no `signal` parameter. Callers reasonably assume cancellation works. | `fetchTickerNews.ts:28-45`, `alpacaClient.ts:62-76` |
| L-24 | `withRetry` never drains or cancels discarded `Response` bodies between attempts. | `alpacaClient.ts:53-58` |
| L-25 | `USE_MOCK` re-derives `IS_MOCK` locally instead of importing it, so the two can drift. | `searchAssets.ts:45` |
| L-26 | `inferPhase` is always called with `hasStock: true` for equities and ignores `pos.side`, so a short equity position yields negative shares and negative `cashDeployed`, labelled `stock-holding`. | `fetchWheelPositions.ts:163-171` |
| L-27 | `sumOptionPremiumCollected` counts every positive option fill as wheel premium, including a sell that closes a long option. `formatActivityLabel` also ends with `return amount >= 0 ? base : base;` — a dead ternary. | `fetchAccountActivities.ts:85`, `:131-137` |
| L-28 | `fmt.dte` uses `new Date("YYYY-MM-DD")`, which parses as UTC midnight, while `catalystWarnings.ts:14` correctly appends `T16:00:00` for local time — an off-by-one DTE in western timezones. | `formatters.ts:25-28` |
| L-29 | `useTickerCatalysts` initializes `loading` to `false`, so consumers briefly render an empty state before the first fetch. | `useTickerCatalysts.ts:9` |
| L-30 | Accessibility: the `TabBar` close ✕ is a `role="button"` with no `tabIndex`/key handler nested inside a real `<button>` (invalid HTML, keyboard-unreachable); watchlist rows are click-only `<div>`s whose only focusable control is the destructive one; icon-only `↻` buttons and the qty/expiration inputs have no accessible names; the tab system has no ARIA tab semantics or arrow-key navigation; the suggestions dropdown is not a combobox; dropdowns don't close on Escape or restore focus. | `TabBar.tsx:68-88`, `WatchlistItem.tsx:20-33`, others |
| L-31 | The HMM ribbon and heat map encode regime purely as red/grey/green, revealed only on mouse hover — unusable for colourblind, touch, and keyboard users. The rest of the app's colour coding is fine (phases carry text labels, P&L has a leading `-`, DTE shows the count). | `HmmTrendChart.tsx:74-97` |
| L-32 | `AllowedHosts: "*"`; `/openapi/v1.json` mapped in all environments; no `UseHttpsRedirection`. CORS itself is correctly restrictive. | `appsettings.json:11`, `Program.cs:70` |
| L-33 | `EnsureCreated()` instead of migrations — intentional and documented; it does create the unique index. Future schema changes need a manual drop. `HasPrecision(18,4)` is a no-op on SQLite. | `Program.cs:62-66` |
| L-34 | No `.gitattributes`… | repo root — **fixed Lane 1.3** |
| L-35 | Duplicated `setSuggestions([])` — harmless, suggests a bad merge. | `WatchlistPanel.tsx:46-50` |

---

## 7. Reproducing the findings

```bash
# C-1 — secrets in the bundle (prints booleans only, not the secrets)
npm run build
node -e "const fs=require('fs'),p=require('path');const env=fs.readFileSync('.env','utf8');
const get=k=>(env.match(new RegExp('^'+k+'=(.*)$','m'))||[])[1]?.trim()||'';
const b=fs.readFileSync(p.join('dist','assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.js'))),'utf8');
for(const k of ['VITE_ALPACA_API_KEY_ID','VITE_ALPACA_API_SECRET_KEY'])
  console.log(k, 'IN_BUNDLE=' + (get(k).length>3 && b.includes(get(k))));"

# C-4 — dropped stylesheet (no ticker-tab rules in the output)
npm run build && cat dist/assets/*.css

# H-19 — stale generated types (exits non-zero if regen drifts)
npm run check:api   # passes as of 5ca1bcd when types match OpenAPI

# H-18 / M-45 — dependency advisories
cd backend/WheelStrategy.Api && dotnet list package --vulnerable --include-transitive
npm audit
```

---

## 8. Developer environment caveat: vitest and the lowercase drive letter

Worth recording because it makes a healthy test suite look broken.

Running `npm test` from a shell whose working directory is `c:\repos\wheel-strategy` (**lowercase** drive letter) fails 10 of 14 test files before a single test executes:

```
TypeError: Cannot read properties of undefined (reading 'config')
Test Files  10 failed | 4 passed (14)
```

Every failing file imports from `"vitest"` explicitly; the four that pass rely on `globals: true`. Vitest resolves the `vitest` module twice under the mismatched path casing, so the copy the test file imports is not the copy holding the runner state.

From `C:\repos\wheel-strategy` (**uppercase**), the identical command passes **14 files / 61 tests**. It reproduces with a two-line test file and disappears under `--pool=vmThreads`, confirming a module-resolution artifact rather than a defect in the tests. It is unrelated to the project's versions — a clean scratch project on vitest 4.1.9 / vite 6.4.3 behaves correctly.

**Mitigations.** `cd "C:/repos/wheel-strategy"` before running tests; run CI on Linux where this cannot occur; consider `test.pool: "vmThreads"` if the local friction persists.

---

## 9. What the codebase gets right

These are the parts that should survive any refactor:

- **Order idempotency is handled correctly.** Every submission carries a `client_order_id`, `POST` is deliberately never retried, and `reconcileSubmission` checks whether a failed POST actually landed before allowing a retry. The `orphan_check` state closes the "did my order go through?" gap that most hobby trading code ignores entirely.
- **Acceptance is correctly distinguished from fill**, documented, tested, and enforced in the phase machine.
- **Double-submit has three independent guards** — `disabled={!canSubmit}`, a synchronous `setBusy(true)` before the first `await`, and the synchronous `flightRef` check that throws rather than placing a second order. Every handler re-checks `locked` internally rather than trusting the `disabled` attribute.
- **The retry policy is thoughtfully asymmetric**: backoff with jitter, only 429/5xx, `GET`/`DELETE` only, and 404/204 treated as terminal success on the cancel path. It needs `Retry-After` and a timeout, but the instinct is right.
- **The order confirmation flow is well designed** — an explicit ticket step, an itemized risk acknowledgement, blockers that hard-disable CONFIRM, amber warnings, and a `SIMULATE ORDER` label in mock mode. The problems are in the *inputs* to that flow, not the flow itself.
- **The component tree is structurally clean.** No conditional or looped hooks, no components declared inside another component's render, no in-place state mutation, and no array-index keys on lists that reorder. Quantity parsing cannot produce NaN, zero, negative, or fractional contracts.
- **Cancellation is present and correct** in `useTickerSnapshot`, `useWheelAnalysis`, `useHmmTrend`, `useTickerCatalysts`, and `useVolatilityMetrics` — each guards `setState` behind a `cancelled`/`aborted` check and cleans up on unmount. The gaps are in paths that bypass the effect, not in the effects themselves.
- **The Black-Scholes and volatility math is correct.** Verified line by line: the erf polynomial, `d1`/`d2`, `N(-d2)` for put assignment and `N(d2)` for call assignment, the `n-1` divisor, log returns, √52 vs √252 tracking the timeframe actually requested, type-7 quantiles, forward-return loop bounds with no off-by-one, and probabilities re-derived at the *rounded* strike rather than assumed.
- **Backend async hygiene is clean.** No `new HttpClient()`, no `.Result`/`.Wait()`, no singleton capturing a `DbContext`, `CancellationToken` threaded end to end, and `ConfigureAwait` correctly omitted.
- **The backend surfaces its own uncertainty** — warning about IEX single-venue bars, insufficient samples, and that overlapping forward-return windows make the empirical percentile indicative rather than rigorous. Being honest about the weakness of your own statistics is rare.
- **Housekeeping is good.** `strict: true` with `noUnusedLocals`/`noUnusedParameters`, zero compiler warnings, no `any` or `@ts-ignore`, no `console.*` debris, no `TODO` backlog, secrets gitignored, `UserSecretsId` configured, restrictive CORS, and a genuinely useful `CLAUDE.md`.

---

## 10. Suggested order of work

| # | Action | Addresses |
|---|---|---|
| 1 | Move Alpaca credentials behind the backend; rotate the Alpaca and Finnhub keys | [C-1](#c-1--alpaca-api-key-and-secret-are-compiled-into-the-shipped-javascript), [H-20](#h-20--unvalidated-inputs-unhandled-exception-types-and-a-logged-api-key-on-the-backend) |
| 2 | ~~Five small fixes…~~ Lane 1.1 **done** (`5ca1bcd`); cache coverage + `adjustment=all` still open | [C-3](#c-3) partial, ~~[C-4](#c-4)~~, [C-5](#c-5), [H-2](#h-2), ~~[H-17](#h-17)~~ |
| 3 | Fix the bar `limit`/pagination and the unguarded snapshot derefs | [H-1](#h-1--the-multi-symbol-bar-limit-is-a-total-not-per-symbol-so-most-symbols-get-nothing), [H-4](#h-4--snapshot-sub-objects-are-dereferenced-without-optional-chaining) |
| 4 | Stabilize the hook's callback identities and split the effect | [C-2](#c-2--place-aborts-its-own-acceptance-wait-leaving-a-live-unmonitored-order) |
| 5 | ~~Make mock mode able to place orders~~ **H-11 done** (`9b9b9c7`); add state-machine tests | ~~[H-11](#h-11)~~, [H-21](#h-21--the-analysis-engine-and-the-order-state-machine-have-no-tests) |
| 6 | The "wrong money on screen" cluster: option legs, errors-as-zeros, `NaN` propagation | [H-3](#h-3--only-one-option-leg-per-underlying-survives), [H-5](#h-5--errors-are-swallowed-into-zeros-and-stale-values), [M-1](#5-medium), [M-26](#5-medium) |
| 7 | Order-status semantics: `done_for_day`, partial-fill-then-cancel, `reset()` | [H-7](#h-7--done_for_day-is-treated-as-a-fill), [H-9](#h-9--reset-discards-a-live-order-and-re-enables-sell), [H-10](#h-10--a-partially-filled-order-that-is-then-cancelled-is-silently-erased) |
| 8 | Displayed values: HMM percentages and forecast formula, stale ladder | [H-14](#h-14--the-hmm-forecast-applies-the-terminal-states-mean-to-every-period), [H-15](#h-15--the-hmm-panel-renders-every-probability-100-too-small), [H-16](#h-16--changing-the-expiration-shows-the-previous-expirations-strikes-under-the-new-header) |
| 9 | Real quotes on close/roll; tick rounding; contract multiplier; OSI padding | [H-8](#h-8--buy-to-close-and-roll-fabricate-a-bidask-defeating-the-fat-finger-guard), [H-12](#h-12--contract-multiplier--size--tradable-are-ignored), [H-13](#h-13--option-limit-prices-are-not-rounded-to-a-valid-tick), [M-11](#5-medium) |
| 10 | Add a fetch layer with timeouts, dedup, and sequencing; harden `watchlistStore` | [H-6](#h-6--no-request-timeouts-no-in-flight-guard-and-an-n3-fan-out-that-will-trip-alpacas-rate-limit), [M-34](#5-medium)–[M-38](#5-medium) |
| 11 | Add the xunit project, ESLint, and CI; ~~regenerate the API types~~ partial (`5ca1bcd`) | [H-19](#h-19) partial, [H-21](#h-21--the-analysis-engine-and-the-order-state-machine-have-no-tests), [M-44](#5-medium) |
| 12 | Pin `Microsoft.OpenApi`…; ~~restore focus rings; delete the duplicate root component~~ partial | [H-18](#h-18), ~~[M-39](#5-medium)~~, ~~[M-43](#5-medium)~~, [M-45](#5-medium) |
