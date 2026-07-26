import { useState, useEffect, useCallback } from "react";
import { fetchCatalysts } from "../api/fetchCatalysts";
import { fetchTickerNews } from "../api/fetchTickerNews";
import { shouldIgnoreFetchError } from "../utils/abort";
import type { CatalystEvent, NewsItem } from "../types";

export function useTickerCatalysts(symbol: string) {
  const [events, setEvents] = useState<CatalystEvent[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [catalysts, headlines] = await Promise.all([
          fetchCatalysts(symbol, signal),
          fetchTickerNews(symbol, signal),
        ]);
        if (signal?.aborted) return;
        setEvents(catalysts.events);
        setWarnings(catalysts.warnings ?? []);
        setNews(headlines);
      } catch (e) {
        if (shouldIgnoreFetchError(signal, e)) return;
        setError(e instanceof Error ? e.message : "Failed to load catalysts");
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

  return { events, news, loading, error, warnings };
}
