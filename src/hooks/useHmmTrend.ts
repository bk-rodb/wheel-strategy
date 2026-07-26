import { useState, useEffect, useCallback, useRef } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (refresh: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const params: HmmTrendParams = { symbol, lookbackDays, granularity, refresh };
        const result = await fetchHmmTrend(params, ctrl.signal);
        if (!ctrl.signal.aborted) setData(result);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load HMM trend");
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [symbol, lookbackDays, granularity],
  );

  useEffect(() => {
    void load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { data, loading, error, refresh };
}
