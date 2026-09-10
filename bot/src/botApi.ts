import type { AnalysisLevel } from "./config.js";
import { config } from "./config.js";
import { apiPost } from "./http.js";
import {
  appendRun,
  writeLastCycle,
  type LastCycle,
  type RunRecord,
} from "./state.js";

/** Whether `lastCycles` came from the API (idempotency) or is empty because the API was unreachable. */
export type RuntimeSource = "api" | "env";

export interface RuntimeConfig {
  symbols: string[];
  level: AnalysisLevel;
  dryRun: boolean;
  paused: boolean;
  lastCycles: Map<string, LastCycle>;
  source: RuntimeSource;
}

interface BotSettingsDto {
  symbols: string[];
  level: string;
  dryRun: boolean;
  paused: boolean;
  updatedAt: string;
}

interface BotLastCycleDto {
  symbol: string;
  targetFriday: string;
  clientOrderId: string;
  at: string;
  status: string;
  retryIndex: number;
}

interface BotConfigResponse {
  settings: BotSettingsDto;
  lastCycles: BotLastCycleDto[];
}

function toLastCycle(row: BotLastCycleDto): LastCycle {
  return {
    targetFriday: row.targetFriday,
    clientOrderId: row.clientOrderId,
    at: row.at,
    status: row.status,
    retryIndex: row.retryIndex,
  };
}

/** The bot's own governance settings — always sourced from bot/.env, never from the API. */
export function envRuntimeConfig(): RuntimeConfig {
  return {
    symbols: [...config.symbols],
    level: config.level,
    dryRun: config.dryRun,
    paused: config.paused,
    lastCycles: new Map(),
    source: "env",
  };
}

/**
 * Builds the runtime config from bot/.env (the only source of truth for symbols / level /
 * dry-run / paused) and best-effort self-reports it to `/api/bot/config` so the desk BOT tab
 * mirrors what the bot is actually doing. The POST response's `lastCycles` is reused for
 * idempotency; if the API is unreachable, governance still comes from env, just without
 * cross-process idempotency for this run.
 */
export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  const runtime = envRuntimeConfig();
  try {
    const res = await apiPost<BotConfigResponse>(
      "/api/bot/config",
      {
        symbols: runtime.symbols,
        level: runtime.level,
        dryRun: runtime.dryRun,
        paused: runtime.paused,
      },
      signal,
    );
    return {
      ...runtime,
      lastCycles: new Map(
        (res.lastCycles ?? []).map((c) => [c.symbol.toUpperCase(), toLastCycle(c)]),
      ),
      source: "api",
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(`[bot] Config self-report failed — dashboard may be stale, no cross-process idempotency this run (${detail})`);
    return runtime;
  }
}

export function lastCycleFor(
  runtime: RuntimeConfig,
  symbol: string,
): LastCycle | null | undefined {
  if (runtime.source !== "api") return undefined;
  return runtime.lastCycles.get(symbol.toUpperCase()) ?? null;
}

export async function persistRun(record: RunRecord, signal?: AbortSignal): Promise<void> {
  appendRun(record);
  try {
    await apiPost("/api/bot/runs", {
      at: record.at,
      symbol: record.symbol,
      targetFriday: record.targetFriday,
      side: record.side,
      qty: record.qty,
      dryRun: record.dryRun,
      status: record.status,
      reason: record.reason ?? null,
      contractSymbol: record.contractSymbol ?? null,
      strike: record.strike ?? null,
      sellLimit: record.sellLimit ?? null,
      orderId: record.orderId ?? null,
      clientOrderId: record.clientOrderId ?? null,
      blockers: record.blockers ?? null,
      warnings: record.warnings ?? null,
    }, signal);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(`[bot] Run POST failed (local file kept): ${detail}`);
  }
}

export async function persistLastCycle(
  symbol: string,
  cycle: LastCycle,
  signal?: AbortSignal,
): Promise<void> {
  writeLastCycle(symbol, cycle);
  try {
    await apiPost("/api/bot/last-cycle", {
      symbol: symbol.toUpperCase(),
      targetFriday: cycle.targetFriday,
      clientOrderId: cycle.clientOrderId,
      at: cycle.at,
      status: cycle.status,
      retryIndex: cycle.retryIndex ?? 0,
    }, signal);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(`[bot] Last-cycle POST failed (local file kept): ${detail}`);
  }
}
