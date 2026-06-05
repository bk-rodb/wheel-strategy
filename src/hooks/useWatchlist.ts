import { useState, useEffect, useCallback } from "react";
import { watchlistStore, type WatchlistEntry } from "../store/watchlistStore";
import { marketData } from "../api/alpacaClient";
import type { AlpacaSnapshotsResponse, AlpacaBarsResponse } from "../api/alpacaTypes";
import { isMarketOpen } from "../utils/marketHours";
import { MOCK_QUOTES } from "../data/mockQuotes";
import { IS_MOCK } from "../config";

export interface WatchlistQuote {
  closePrice: number;   // previous day's close — baseline for all change calcs
  lastPrice: number;    // last 5-min bar (market hours) or today's close (after hours)
  change: number;
  changePct: number;
  source: "5min" | "close";
}

export interface WatchlistItem extends WatchlistEntry {
  quote?: WatchlistQuote;
  loadingQuote: boolean;
}


async function fetchQuotes(symbols: string[]): Promise<Record<string, WatchlistQuote>> {
  const marketOpen = isMarketOpen();

  // Always need snapshots for prevDailyBar (close) and fallback prices
  const [snapshots, fiveMinBars] = await Promise.all([
    marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
      symbols: symbols.join(","),
      feed: "iex",
    }),
    marketOpen
      ? marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", {
          symbols: symbols.join(","),
          timeframe: "5Min",
          limit: "1",
          sort: "desc",
          feed: "iex",
        })
      : Promise.resolve({ bars: {} } as AlpacaBarsResponse),
  ]);

  const result: Record<string, WatchlistQuote> = {};

  for (const symbol of symbols) {
    const snap = snapshots[symbol];
    if (!snap) continue;

    const closePrice = snap.prevDailyBar.c;

    let lastPrice: number;
    let source: "5min" | "close";

    if (marketOpen && fiveMinBars.bars[symbol]?.length > 0) {
      lastPrice = fiveMinBars.bars[symbol][0].c;
      source = "5min";
    } else {
      // After hours — use today's daily bar close (or latest trade if bar not yet settled)
      lastPrice = snap.dailyBar?.c ?? snap.latestTrade.p;
      source = "close";
    }

    const change = lastPrice - closePrice;
    const changePct = closePrice > 0 ? (change / closePrice) * 100 : 0;
    result[symbol] = { closePrice, lastPrice, change, changePct, source };
  }

  return result;
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(() => watchlistStore.getAll());
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [loadingSymbols, setLoadingSymbols] = useState<Set<string>>(new Set());

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
        : await fetchQuotes(symbols);
      setQuotes((prev) => ({ ...prev, ...data }));
    } catch {
      // quotes are best-effort
    } finally {
      setLoadingSymbols(new Set());
    }
  }, []);

  useEffect(() => {
    const symbols = entries.map((e) => e.symbol);
    refreshQuotes(symbols);
    // Refresh every 5 min (matches the bar period)
    const interval = setInterval(() => refreshQuotes(symbols), 5 * 60_000);
    return () => clearInterval(interval);
  }, [entries, refreshQuotes]);

  const items: WatchlistItem[] = entries.map((e) => ({
    ...e,
    quote: quotes[e.symbol],
    loadingQuote: loadingSymbols.has(e.symbol),
  }));

  const add = useCallback((symbol: string) => {
    const updated = watchlistStore.add(symbol);
    setEntries(updated);
  }, []);

  const remove = useCallback((symbol: string) => {
    setEntries(watchlistStore.remove(symbol));
    setQuotes((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  }, []);

  return { items, add, remove };
}
