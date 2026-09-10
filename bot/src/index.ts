import { lastCycleFor, loadRuntimeConfig, persistRun } from "./botApi.js";
import { decideEntry, nextMondayOpen, sleepUntil } from "./calendar.js";
import { config } from "./config.js";
import { runSellToOpenCycle } from "./cycle.js";
import { pingApi } from "./http.js";

const once = process.argv.includes("--once");

function log(msg: string): void {
  console.log(`[bot ${new Date().toISOString()}] ${msg}`);
}

async function ensureApi(): Promise<void> {
  try {
    await pingApi();
    log(`API ok at ${config.apiBase}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Cannot reach WheelStrategy.Api at ${config.apiBase} (${detail}). Start the backend first.`,
    );
  }
}

async function runOnce(): Promise<void> {
  await ensureApi();
  const runtime = await loadRuntimeConfig();
  log(
    `Config symbols=${runtime.symbols.join(",")} level=${runtime.level} dryRun=${runtime.dryRun} paused=${runtime.paused} source=${runtime.source}`,
  );

  const decision = decideEntry();
  if (decision.action === "wait") {
    log(`Not in entry window: ${decision.reason}`);
    if (once) {
      log(`--once exiting without placing (window closed).`);
      return;
    }
    log(`Sleeping until ${decision.until.toISOString()}`);
    await sleepUntil(decision.until, {
      onChunk: (ms) => {
        if (ms > 60_000) log(`… ${Math.round(ms / 60_000)} min remaining`);
      },
    });
    return runOnce();
  }

  log(decision.reason);
  if (runtime.paused) {
    const record = {
      at: new Date().toISOString(),
      symbol: "*",
      targetFriday: decision.targetFriday,
      side: "?",
      qty: 0,
      dryRun: runtime.dryRun,
      status: "skipped" as const,
      reason: "Bot paused — window skipped",
    };
    await persistRun(record);
    log(record.reason);
    return;
  }

  // Each symbol runs its own independent cycle — run them concurrently so a slow-filling
  // order on one symbol doesn't block the others from ever being tried today.
  const results = await Promise.allSettled(
    runtime.symbols.map((symbol) =>
      runSellToOpenCycle({
        symbol,
        targetFriday: decision.targetFriday,
        level: runtime.level,
        dryRun: runtime.dryRun,
        lastCycle: lastCycleFor(runtime, symbol),
      }),
    ),
  );
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r?.status === "rejected") {
      console.error(`[bot] Cycle failed for ${runtime.symbols[i]}:`, r.reason);
    }
  }
}

async function runLoop(): Promise<void> {
  // After a cycle (or skip), sleep until next Monday open, then repeat.
  for (;;) {
    await runOnce();
    if (once) break;

    const until = nextMondayOpen(new Date(Date.now() + 60_000));
    log(`Cycle finished — sleeping until next Monday open ${until.toISOString()}`);
    await sleepUntil(until, {
      onChunk: (ms) => {
        if (ms > 3_600_000) log(`… ${Math.round(ms / 3_600_000)} h remaining`);
      },
    });
  }
}

runLoop().catch((err) => {
  console.error(`[bot] Fatal:`, err);
  process.exitCode = 1;
});
