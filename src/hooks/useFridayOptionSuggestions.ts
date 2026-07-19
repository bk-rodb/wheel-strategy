import { useCallback, useEffect, useState } from "react";
import {
  fetchFridayOptions,
  type FridayOptionsBundle,
  type OptionSide,
} from "../api/fetchFridayOptions";

export function useFridayOptionSuggestions(opts: {
  symbol: string;
  side: OptionSide;
  shares: number;
  enabled?: boolean;
}) {
  const { symbol, side, shares, enabled = true } = opts;
  const [data, setData] = useState<FridayOptionsBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const bundle = await fetchFridayOptions({ symbol, side, shares, signal });
        if (!signal?.aborted) setData(bundle);
      } catch (e) {
        if (!signal?.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load Friday options");
          setData(null);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [symbol, side, shares, enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, enabled]);

  return { data, loading, error, refresh: () => load() };
}
