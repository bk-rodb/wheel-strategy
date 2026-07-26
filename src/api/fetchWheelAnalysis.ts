import { API_BASE } from "../config";
import { DEFAULT_TIMEOUT_MS } from "./alpacaClient";
import { inflightDeduped } from "./inflightCache";
import type { AnalysisGranularity, WheelAnalysis } from "../types";

export interface WheelAnalysisParams {
  symbol: string;
  lookbackDays?: number;
  dte?: number;
  granularity?: AnalysisGranularity;
  riskFreeRate?: number;
  refresh?: boolean;
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

/** Light runtime check so a bad `level` cannot crash LEVEL_COLOR lookups (M-9). */
function assertWheelAnalysis(raw: unknown): WheelAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("Analysis API → invalid payload");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.symbol !== "string") {
    throw new Error("Analysis API → missing symbol");
  }
  for (const key of ["putSuggestions", "callSuggestions"] as const) {
    const rows = o[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const level = (row as { level?: unknown }).level;
      if (level != null && level !== "safe" && level !== "regular" && level !== "risky") {
        throw new Error(`Analysis API → unexpected level '${String(level)}'`);
      }
    }
  }
  return raw as WheelAnalysis;
}

async function fetchWheelAnalysisOnce(
  params: WheelAnalysisParams,
  signal?: AbortSignal,
): Promise<WheelAnalysis> {
  const url = new URL(`${API_BASE}/api/analysis/wheel`);
  url.searchParams.set("symbol", params.symbol);
  if (params.lookbackDays != null) url.searchParams.set("lookbackDays", String(params.lookbackDays));
  if (params.dte != null) url.searchParams.set("dte", String(params.dte));
  if (params.granularity) url.searchParams.set("granularity", params.granularity);
  if (params.riskFreeRate != null) url.searchParams.set("riskFreeRate", String(params.riskFreeRate));
  if (params.refresh) url.searchParams.set("refresh", "true");

  const res = await fetch(url.toString(), { signal: requestSignal(signal) });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.title ?? detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(`Analysis API → ${detail}`);
  }
  return assertWheelAnalysis(await res.json());
}

/**
 * Fetch wheel-strategy strike suggestions from the .NET analysis backend.
 * Concurrent identical requests (panel + vol metrics) share one in-flight GET.
 */
export async function fetchWheelAnalysis(
  params: WheelAnalysisParams,
  signal?: AbortSignal,
): Promise<WheelAnalysis> {
  if (params.refresh) {
    return fetchWheelAnalysisOnce(params, signal);
  }
  const key = [
    "wheel",
    params.symbol.toUpperCase(),
    params.dte ?? "",
    params.lookbackDays ?? "",
    params.granularity ?? "",
    params.riskFreeRate ?? "",
  ].join("|");
  return inflightDeduped(key, () => fetchWheelAnalysisOnce(params, signal));
}
