import { useState, useEffect, useCallback } from "react";
import { fetchAtmImpliedVol } from "../api/fetchAtmImpliedVol";
import { fetchWheelAnalysis } from "../api/fetchWheelAnalysis";
import { shouldIgnoreFetchError } from "../utils/abort";

export function useVolatilityMetrics(symbol: string) {
  const [realizedVol, setRealizedVol] = useState<number | null>(null);
  const [impliedVol, setImpliedVol] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [analysis, iv] = await Promise.all([
          fetchWheelAnalysis({ symbol, granularity: "daily" }, signal),
          fetchAtmImpliedVol(symbol, signal),
        ]);
        if (signal?.aborted) return;
        setRealizedVol(analysis.realizedVolAnnual);
        setImpliedVol(iv);
      } catch (e) {
        if (shouldIgnoreFetchError(signal, e)) return;
        setError(e instanceof Error ? e.message : "Failed to load volatility");
      } finally {
        setLoading(false);
      }
    },
    [symbol],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const vrp =
    realizedVol != null && impliedVol != null ? impliedVol - realizedVol : null;

  return { realizedVol, impliedVol, vrp, loading, error };
}
