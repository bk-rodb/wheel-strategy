import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWheelAnalysis, type WheelAnalysisParams } from "../api/fetchWheelAnalysis";
import { shouldIgnoreFetchError } from "../utils/abort";
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
        const params: WheelAnalysisParams = { symbol, dte, lookbackDays, granularity, refresh };
        const result = await fetchWheelAnalysis(params, ctrl.signal);
        if (!ctrl.signal.aborted) setData(result);
      } catch (e) {
        if (shouldIgnoreFetchError(ctrl.signal, e)) return;
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    },
    [symbol, dte, lookbackDays, granularity],
  );

  useEffect(() => {
    void load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { data, loading, error, refresh };
}
