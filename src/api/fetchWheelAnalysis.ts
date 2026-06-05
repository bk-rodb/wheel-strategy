import { API_BASE } from "../config";
import type { WheelAnalysis } from "../types";

export interface WheelAnalysisParams {
  symbol: string;
  lookbackDays?: number;
  dte?: number;
  granularity?: "weekly" | "daily";
  riskFreeRate?: number;
  refresh?: boolean;
}

/**
 * Fetch wheel-strategy strike suggestions from the .NET analysis backend.
 * Throws on a non-OK response (mirrors src/api/alpacaClient.ts).
 */
export async function fetchWheelAnalysis(
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

  const res = await fetch(url.toString(), { signal });
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
  return res.json() as Promise<WheelAnalysis>;
}
