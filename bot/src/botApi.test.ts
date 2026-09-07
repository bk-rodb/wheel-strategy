import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { lastCycleFor, loadRuntimeConfig, type RuntimeConfig } from "./botApi.ts";

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

  it("maps API settings and last-cycles", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          settings: {
            symbols: ["nvda", "RKLB"],
            level: "risky",
            dryRun: false,
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
    assert.deepEqual(runtime.symbols, ["NVDA", "RKLB"]);
    assert.equal(runtime.level, "risky");
    assert.equal(runtime.dryRun, false);
    assert.equal(runtime.paused, true);
    assert.equal(runtime.lastCycles.get("NVDA")?.status, "filled");
  });

  it("falls back to env when GET fails", async () => {
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as typeof fetch;

    const runtime = await loadRuntimeConfig();
    assert.equal(runtime.source, "env");
    assert.equal(runtime.paused, false);
    assert.ok(runtime.symbols.length > 0);
  });
});
