import { useState, useEffect, useCallback, useRef } from "react";
import {
  watchlistStore,
  type Watchlist,
  type WatchlistEntry,
} from "../store/watchlistStore";
import { fetchStockQuotes, type StockQuote } from "../api/fetchStockQuotes";
import { MOCK_QUOTES } from "../data/mockQuotes";
import { IS_MOCK } from "../config";
import { QUOTE_REFRESH_MS } from "../utils/marketHours";

export type WatchlistQuote = StockQuote;

export interface WatchlistItem extends WatchlistEntry {
  quote?: WatchlistQuote;
  loadingQuote: boolean;
}

export function useWatchlist() {
  const [activeWatchlist, setActiveWatchlist] = useState<Watchlist>(() =>
    watchlistStore.getActiveWatchlist(),
  );
  const [watchlists, setWatchlists] = useState<Watchlist[]>(() =>
    watchlistStore.getWatchlists(),
  );
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => watchlistStore.getAll());
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [loadingSymbols, setLoadingSymbols] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);
  const [staleSince, setStaleSince] = useState<Date | null>(null);
  const seqRef = useRef(0);

  const syncFromStore = useCallback(() => {
    setWatchlists(watchlistStore.getWatchlists());
    setActiveWatchlist(watchlistStore.getActiveWatchlist());
    setEntries(watchlistStore.getAll());
  }, []);

  const refreshQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    const seq = ++seqRef.current;
    setLoadingSymbols(new Set(symbols));
    try {
      const data = IS_MOCK
        ? Object.fromEntries(
            symbols.map((s) => [
              s,
              MOCK_QUOTES[s] ?? {
                closePrice: 100,
                lastPrice: 100 + Math.random() * 10 - 5,
                change: 0,
                changePct: 0,
                source: "close" as const,
              },
            ]),
          )
        : await fetchStockQuotes(symbols);
      if (seq !== seqRef.current) return;
      setQuotes((prev) => ({ ...prev, ...data }));
      setLastError(null);
      setStaleSince(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setLastError(e instanceof Error ? e.message : "Failed to load quotes");
      setStaleSince((prev) => prev ?? new Date());
    } finally {
      if (seq === seqRef.current) setLoadingSymbols(new Set());
    }
  }, []);

  useEffect(() => {
    const symbols = entries.map((e) => e.symbol);
    // Keep last-good quotes for symbols that remain; drop removed ones.
    setQuotes((prev) => {
      const next: Record<string, WatchlistQuote> = {};
      for (const s of symbols) {
        if (prev[s]) next[s] = prev[s];
      }
      return next;
    });
    void refreshQuotes(symbols);
    const interval = setInterval(() => void refreshQuotes(symbols), QUOTE_REFRESH_MS);
    return () => {
      clearInterval(interval);
      seqRef.current += 1;
    };
  }, [entries, refreshQuotes]);

  const items: WatchlistItem[] = entries.map((e) => ({
    ...e,
    quote: quotes[e.symbol],
    loadingQuote: loadingSymbols.has(e.symbol),
  }));

  const add = useCallback((symbol: string) => {
    setEntries(watchlistStore.add(symbol));
    syncFromStore();
  }, [syncFromStore]);

  const remove = useCallback((symbol: string) => {
    setEntries(watchlistStore.remove(symbol));
    setQuotes((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
    syncFromStore();
  }, [syncFromStore]);

  const selectWatchlist = useCallback((id: string) => {
    watchlistStore.setActive(id);
    syncFromStore();
  }, [syncFromStore]);

  const createWatchlist = useCallback((name: string) => {
    const result = watchlistStore.create(name);
    if (result.ok) syncFromStore();
    return result;
  }, [syncFromStore]);

  const isNameTaken = useCallback(
    (name: string, excludeId?: string) => watchlistStore.isNameTaken(name, excludeId),
    [],
  );

  return {
    items,
    add,
    remove,
    watchlists,
    activeWatchlist,
    selectWatchlist,
    createWatchlist,
    isNameTaken,
    lastError,
    staleSince,
  };
}
