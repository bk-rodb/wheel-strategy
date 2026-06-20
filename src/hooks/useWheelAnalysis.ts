import { useState, useEffect, useCallback } from "react";
import { fetchWheelAnalysis, type WheelAnalysisParams } from "../api/fetchWheelAnalysis";
import type { AnalysisGranularity, WheelAnalysis } from "../types";

interface UseWheelAnalysisOptions {
  symbol: string;
  dte?: number;
  lookbackDays?: number;
  granularity?: AnalysisGranularity;
}

export function useWheelAnalysis(opts: UseWheelAnalysisOptions) {
  const { symbol, dte, lookbackDays, granularity } = opts;
  const [data, setData] = useState<WheelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh: boolean, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params: WheelAnalysisParams = { symbol, dte, lookbackDays, granularity, refresh };
        const result = await fetchWheelAnalysis(params, signal);
        if (!signal?.aborted) setData(result);
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [symbol, dte, lookbackDays, granularity],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(false, ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, refresh };
}
