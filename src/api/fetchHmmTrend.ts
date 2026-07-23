import { API_BASE } from "../config";
import type { AnalysisGranularity, HmmTrendResult } from "../types";

export interface HmmTrendParams {
  symbol: string;
  lookbackDays?: number;
  granularity?: AnalysisGranularity;
  refresh?: boolean;
}

export async function fetchHmmTrend(
  params: HmmTrendParams,
  signal?: AbortSignal,
): Promise<HmmTrendResult> {
  const url = new URL(`${API_BASE}/api/analysis/hmm`);
  url.searchParams.set("symbol", params.symbol);
  if (params.lookbackDays != null) url.searchParams.set("lookbackDays", String(params.lookbackDays));
  if (params.granularity) url.searchParams.set("granularity", params.granularity);
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
    throw new Error(`HMM API → ${detail}`);
  }
  return res.json() as Promise<HmmTrendResult>;
}
