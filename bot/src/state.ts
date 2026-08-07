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

function lastCyclePath(): string {
  return join(ensureDataDir(), "last-cycle.json");
}

export function appendRun(record: RunRecord): void {
  appendFileSync(runsPath(), `${JSON.stringify(record)}\n`, "utf8");
}

export interface LastCycle {
  targetFriday: string;
  clientOrderId: string;
  at: string;
  status: string;
}

export function readLastCycle(): LastCycle | null {
  const path = lastCyclePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LastCycle;
  } catch {
    return null;
  }
}

export function writeLastCycle(cycle: LastCycle): void {
  writeFileSync(lastCyclePath(), JSON.stringify(cycle, null, 2), "utf8");
}

/** True if we already completed a successful place/fill/dry_run for this Friday. */
export function alreadyCompletedForFriday(targetFriday: string): boolean {
  const last = readLastCycle();
  if (!last || last.targetFriday !== targetFriday) return false;
  return last.status === "placed" || last.status === "filled" || last.status === "dry_run";
}
