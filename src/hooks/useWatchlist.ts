import { useState, useEffect, useCallback } from "react";
import {
  watchlistStore,
  type Watchlist,
  type WatchlistEntry,
} from "../store/watchlistStore";
import { fetchStockQuotes, type StockQuote } from "../api/fetchStockQuotes";
import { MOCK_QUOTES } from "../data/mockQuotes";
import { IS_MOCK } from "../config";

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

  const syncFromStore = useCallback(() => {
    setWatchlists(watchlistStore.getWatchlists());
    setActiveWatchlist(watchlistStore.getActiveWatchlist());
    setEntries(watchlistStore.getAll());
  }, []);

  const refreshQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
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
      setQuotes((prev) => ({ ...prev, ...data }));
    } catch {
      // quotes are best-effort
    } finally {
      setLoadingSymbols(new Set());
    }
  }, []);

  useEffect(() => {
    const symbols = entries.map((e) => e.symbol);
    setQuotes({});
    refreshQuotes(symbols);
    const interval = setInterval(() => refreshQuotes(symbols), 5 * 60_000);
    return () => clearInterval(interval);
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
  };
}
