import { useState, useEffect, useCallback } from "react";
import { fetchHmmTrend, type HmmTrendParams } from "../api/fetchHmmTrend";
import type { AnalysisGranularity, HmmTrendResult } from "../types";

interface UseHmmTrendOptions {
  symbol: string;
  lookbackDays?: number;
  granularity?: AnalysisGranularity;
}

export function useHmmTrend(opts: UseHmmTrendOptions) {
  const { symbol, lookbackDays, granularity } = opts;
  const [data, setData] = useState<HmmTrendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh: boolean, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params: HmmTrendParams = { symbol, lookbackDays, granularity, refresh };
        const result = await fetchHmmTrend(params, signal);
        if (!signal?.aborted) setData(result);
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "Failed to load HMM trend");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [symbol, lookbackDays, granularity],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(false, ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, refresh };
}
