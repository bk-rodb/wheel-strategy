import type { AnalysisLevel } from "./config.js";
import { config } from "./config.js";
import { apiGet, apiPost } from "./http.js";
import {
  appendRun,
  writeLastCycle,
  type LastCycle,
  type RunRecord,
} from "./state.js";

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

function asLevel(raw: string | undefined): AnalysisLevel {
  if (raw === "safe" || raw === "regular" || raw === "risky") return raw;
  return "regular";
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

/** Env fallback when `/api/bot/config` is unreachable. */
export function envRuntimeConfig(): RuntimeConfig {
  return {
    symbols: [...config.symbols],
    level: config.level,
    dryRun: config.dryRun,
    paused: false,
    lastCycles: new Map(),
    source: "env",
  };
}

export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  try {
    const res = await apiGet<BotConfigResponse>("/api/bot/config", undefined, signal);
    const symbols = (res.settings.symbols ?? [])
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return {
      symbols: symbols.length > 0 ? Array.from(new Set(symbols)) : [...config.symbols],
      level: asLevel(res.settings.level),
      dryRun: res.settings.dryRun,
      paused: res.settings.paused,
      lastCycles: new Map(
        (res.lastCycles ?? []).map((c) => [c.symbol.toUpperCase(), toLastCycle(c)]),
      ),
      source: "api",
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(`[bot] Config GET failed — using env (${detail})`);
    return envRuntimeConfig();
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
