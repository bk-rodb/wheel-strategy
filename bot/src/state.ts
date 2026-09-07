import { mkdirSync, appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

export interface RunRecord {
  at: string;
  symbol: string;
  targetFriday: string;
  side: string;
  qty: number;
  dryRun: boolean;
  status:
    | "skipped"
    | "dry_run"
    | "placed"
    | "filled"
    | "canceled"
    | "blocked"
    | "error";
  reason?: string;
  contractSymbol?: string;
  strike?: number;
  sellLimit?: number;
  orderId?: string;
  clientOrderId?: string;
  blockers?: string[];
  warnings?: string[];
}

function ensureDataDir(): string {
  mkdirSync(config.dataDir, { recursive: true });
  return config.dataDir;
}

function runsPath(): string {
  return join(ensureDataDir(), "runs.jsonl");
}

function lastCyclePath(symbol: string): string {
  return join(ensureDataDir(), `last-cycle-${symbol.toLowerCase()}.json`);
}

export function appendRun(record: RunRecord): void {
  appendFileSync(runsPath(), `${JSON.stringify(record)}\n`, "utf8");
}

export interface LastCycle {
  targetFriday: string;
  clientOrderId: string;
  at: string;
  status: string;
  /** Number of same-friday retries already attempted (0 = first attempt). */
  retryIndex?: number;
}

/** Legacy single-symbol state file, from before multi-symbol support (BOT_SYMBOL=NVDA only). */
function legacyLastCyclePath(): string {
  return join(ensureDataDir(), "last-cycle.json");
}

export function readLastCycle(symbol: string): LastCycle | null {
  const path = lastCyclePath(symbol);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as LastCycle;
    } catch {
      return null;
    }
  }
  // Fall back to the pre-multi-symbol NVDA state file so upgrading the bot
  // doesn't lose dedupe protection for a Friday already handled under the
  // old single-symbol layout.
  if (symbol.toUpperCase() === "NVDA") {
    const legacyPath = legacyLastCyclePath();
    if (existsSync(legacyPath)) {
      try {
        return JSON.parse(readFileSync(legacyPath, "utf8")) as LastCycle;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function writeLastCycle(symbol: string, cycle: LastCycle): void {
  writeFileSync(lastCyclePath(symbol), JSON.stringify(cycle, null, 2), "utf8");
}

/**
 * True if we already completed a successful place/fill/dry_run for this Friday.
 * When `apiLast` is passed (`null` = API has no row), that wins over the local file
 * so a desk re-arm is visible to the next `--once`.
 */
export function alreadyCompletedForFriday(
  symbol: string,
  targetFriday: string,
  apiLast?: LastCycle | null,
): boolean {
  const last = apiLast !== undefined ? apiLast : readLastCycle(symbol);
  if (!last || last.targetFriday !== targetFriday) return false;
  return last.status === "placed" || last.status === "filled" || last.status === "dry_run";
}

/**
 * Returns the next retry index to use for a clientOrderId on same-friday
 * re-entries after a cancellation. Returns 0 on the very first attempt.
 * Alpaca permanently reserves a clientOrderId even for canceled orders, so
 * each retry needs a unique suffix (`-r1`, `-r2`, …).
 */
export function getNextRetryIndex(
  symbol: string,
  targetFriday: string,
  apiLast?: LastCycle | null,
): number {
  const last = apiLast !== undefined ? apiLast : readLastCycle(symbol);
  if (!last || last.targetFriday !== targetFriday) return 0;
  // Only bump the index if the previous attempt was a cancelation/error;
  // placed/filled/dry_run would have been caught by alreadyCompletedForFriday.
  if (last.status === "canceled" || last.status === "error") {
    return (last.retryIndex ?? 0) + 1;
  }
  return 0;
}
