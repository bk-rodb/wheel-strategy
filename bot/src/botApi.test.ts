import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { envRuntimeConfig, lastCycleFor, loadRuntimeConfig, type RuntimeConfig } from "./botApi.ts";

describe("lastCycleFor", () => {
  it("returns undefined when config came from env", () => {
    const runtime: RuntimeConfig = {
      symbols: ["NVDA"],
      level: "regular",
      dryRun: true,
      paused: false,
      lastCycles: new Map(),
      source: "env",
    };
    assert.equal(lastCycleFor(runtime, "NVDA"), undefined);
  });

  it("returns null when API has no row for the symbol", () => {
    const runtime: RuntimeConfig = {
      symbols: ["NVDA"],
      level: "regular",
      dryRun: true,
      paused: false,
      lastCycles: new Map(),
      source: "api",
    };
    assert.equal(lastCycleFor(runtime, "NVDA"), null);
  });
});

describe("loadRuntimeConfig", () => {
  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("governs itself from env regardless of what the API reports back", async () => {
    const envSettings = envRuntimeConfig();
    globalThis.fetch = (async () =>
      // The API echoes back settings that DIFFER from env (e.g. a stale desk-tab value from
      // before this fix) plus last-cycles — env must still win for governance.
      new Response(
        JSON.stringify({
          settings: {
            symbols: ["AAPL"],
            level: "risky",
            dryRun: true,
            paused: true,
            updatedAt: "2026-09-07T00:00:00Z",
          },
          lastCycles: [
            {
              symbol: "NVDA",
              targetFriday: "2026-09-11",
              clientOrderId: "cid-1",
              at: "2026-09-07T13:35:00Z",
              status: "filled",
              retryIndex: 0,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const runtime = await loadRuntimeConfig();
    assert.equal(runtime.source, "api");
    assert.deepEqual(runtime.symbols, envSettings.symbols);
    assert.equal(runtime.level, envSettings.level);
    assert.equal(runtime.dryRun, envSettings.dryRun);
    assert.equal(runtime.paused, envSettings.paused);
    assert.equal(runtime.lastCycles.get("NVDA")?.status, "filled");
  });

  it("still governs itself from env when the self-report POST fails", async () => {
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;

    const runtime = await loadRuntimeConfig();
    assert.equal(runtime.source, "env");
    assert.equal(runtime.paused, false);
    assert.equal(runtime.lastCycles.size, 0);
    assert.ok(runtime.symbols.length > 0);
  });
});
