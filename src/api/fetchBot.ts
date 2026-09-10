import { API_BASE, IS_MOCK } from "../config";

const DEFAULT_TIMEOUT_MS = 15_000;

export type BotLevel = "safe" | "regular" | "risky";
export type BotRunStatus =
  | "skipped"
  | "dry_run"
  | "placed"
  | "filled"
  | "canceled"
  | "blocked"
  | "error";

export interface BotSettings {
  symbols: string[];
  level: BotLevel;
  dryRun: boolean;
  paused: boolean;
  updatedAt: string;
}

export interface BotLastCycle {
  symbol: string;
  targetFriday: string;
  clientOrderId: string;
  at: string;
  status: string;
  retryIndex: number;
}

export interface BotConfig {
  settings: BotSettings;
  lastCycles: BotLastCycle[];
}

export interface BotRun {
  at: string;
  symbol: string;
  targetFriday: string;
  side: string;
  qty: number;
  dryRun: boolean;
  status: BotRunStatus | string;
  reason: string | null;
  contractSymbol: string | null;
  strike: number | null;
  sellLimit: number | null;
  orderId: string | null;
  clientOrderId: string | null;
  blockers: string[] | null;
  warnings: string[] | null;
}

const mockUpdatedAt = "2026-09-06T16:00:00.000Z";

let mockConfig: BotConfig = {
  settings: {
    symbols: ["NVDA", "SPCX", "RKLB"],
    level: "regular",
    dryRun: true,
    paused: false,
    updatedAt: mockUpdatedAt,
  },
  lastCycles: [
    {
      symbol: "NVDA",
      targetFriday: "2026-09-04",
      clientOrderId: "bot-nvda-20260904-p-20260901",
      at: "2026-09-01T14:54:29.220Z",
      status: "filled",
      retryIndex: 1,
    },
  ],
};

let mockRuns: BotRun[] = [
  {
    at: "2026-09-01T14:54:29.220Z",
    symbol: "NVDA",
    targetFriday: "2026-09-04",
    side: "put",
    qty: 1,
    dryRun: false,
    status: "filled",
    reason: "Final status=filled",
    contractSymbol: "NVDA260904P00170000",
    strike: 170,
    sellLimit: 1.15,
    orderId: "alp-1",
    clientOrderId: "bot-nvda-20260904-p-20260901",
    blockers: null,
    warnings: null,
  },
  {
    at: "2026-09-01T14:55:01.000Z",
    symbol: "SPCX",
    targetFriday: "2026-09-04",
    side: "put",
    qty: 1,
    dryRun: true,
    status: "dry_run",
    reason: "BOT_DRY_RUN=true — order not submitted",
    contractSymbol: "SPCX260904P00025000",
    strike: 25,
    sellLimit: 0.4,
    orderId: null,
    clientOrderId: "bot-spcx-20260904-p-20260901",
    blockers: null,
    warnings: null,
  },
];

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

async function readError(res: Response, label: string): Promise<Error> {
  const text = await res.text();
  return new Error(`${label} → ${res.status}: ${text}`);
}

/**
 * Read-only mirror of the bot's own governance settings. The bot self-reports symbols / level /
 * dry-run / paused (sourced from bot/.env) on every cycle via `POST /api/bot/config`; this UI
 * never writes those knobs — edit bot/.env and restart the worker to change them.
 */
export async function fetchBotConfig(signal?: AbortSignal): Promise<BotConfig> {
  if (IS_MOCK) return structuredClone(mockConfig);

  const res = await fetch(`${API_BASE}/api/bot/config`, { signal: requestSignal(signal) });
  if (!res.ok) throw await readError(res, "Bot config");
  return (await res.json()) as BotConfig;
}

export async function fetchBotRuns(opts?: {
  symbol?: string;
  status?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<BotRun[]> {
  if (IS_MOCK) {
    let rows = [...mockRuns];
    if (opts?.symbol) rows = rows.filter((r) => r.symbol === opts.symbol);
    if (opts?.status) rows = rows.filter((r) => r.status === opts.status);
    return rows.slice(0, opts?.limit ?? 100);
  }

  const url = new URL(`${API_BASE}/api/bot/runs`);
  if (opts?.symbol) url.searchParams.set("symbol", opts.symbol);
  if (opts?.status) url.searchParams.set("status", opts.status);
  if (opts?.limit != null) url.searchParams.set("limit", String(opts.limit));
  const res = await fetch(url.toString(), { signal: requestSignal(opts?.signal) });
  if (!res.ok) throw await readError(res, "Bot runs");
  const body = (await res.json()) as { runs: BotRun[] };
  return body.runs ?? [];
}

export async function clearBotLastCycle(
  symbol?: string,
  signal?: AbortSignal,
): Promise<number> {
  if (IS_MOCK) {
    if (!symbol) {
      const n = mockConfig.lastCycles.length;
      mockConfig = { ...mockConfig, lastCycles: [] };
      return n;
    }
    const before = mockConfig.lastCycles.length;
    mockConfig = {
      ...mockConfig,
      lastCycles: mockConfig.lastCycles.filter((c) => c.symbol !== symbol),
    };
    return before - mockConfig.lastCycles.length;
  }

  const url = new URL(`${API_BASE}/api/bot/last-cycle`);
  if (symbol) url.searchParams.set("symbol", symbol);
  const res = await fetch(url.toString(), {
    method: "DELETE",
    signal: requestSignal(signal),
  });
  if (!res.ok) throw await readError(res, "Bot re-arm");
  const body = (await res.json()) as { cleared?: number };
  return body.cleared ?? 0;
}

/** Test-only reset so mock mutations do not leak across files. */
export function resetMockBotState(): void {
  mockConfig = {
    settings: {
      symbols: ["NVDA", "SPCX", "RKLB"],
      level: "regular",
      dryRun: true,
      paused: false,
      updatedAt: mockUpdatedAt,
    },
    lastCycles: [
      {
        symbol: "NVDA",
        targetFriday: "2026-09-04",
        clientOrderId: "bot-nvda-20260904-p-20260901",
        at: "2026-09-01T14:54:29.220Z",
        status: "filled",
        retryIndex: 1,
      },
    ],
  };
  mockRuns = mockRuns.slice(0, 2);
}
