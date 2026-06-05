import { useState, useEffect } from "react";
import type { PricePoint } from "../types";
import { marketData } from "../api/alpacaClient";
import { fetchPriceHistory } from "../api/fetchWheelPositions";
import type { AlpacaSnapshotsResponse } from "../api/alpacaTypes";
import { MOCK_QUOTES } from "../data/mockQuotes";
import { IS_MOCK } from "../config";

export interface TickerSnapshot {
  priceHistory: PricePoint[];
  lastPrice: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: Omit<TickerSnapshot, "loading" | "error"> = {
  priceHistory: [],
  lastPrice: 0,
  prevClose: 0,
  change: 0,
  changePct: 0,
  dayHigh: 0,
  dayLow: 0,
  volume: 0,
};

// Synthesize a 30-day series ending near `last`, for mock mode.
function mockHistory(last: number): PricePoint[] {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    price: parseFloat(
      (last * (0.9 + (i / 29) * 0.1) + Math.sin(i / 4) * (last * 0.02) + Math.random() * (last * 0.01)).toFixed(2),
    ),
  }));
}

export function useTickerSnapshot(symbol: string): TickerSnapshot {
  const [state, setState] = useState<TickerSnapshot>({
    ...EMPTY,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ ...EMPTY, loading: true, error: null });

    async function load() {
      try {
        if (IS_MOCK) {
          const q = MOCK_QUOTES[symbol] ?? {
            closePrice: 100,
            lastPrice: 100 + Math.random() * 10 - 5,
            change: 0,
            changePct: 0,
            source: "close" as const,
          };
          const change = q.lastPrice - q.closePrice;
          const changePct = q.closePrice > 0 ? (change / q.closePrice) * 100 : 0;
          if (cancelled) return;
          setState({
            priceHistory: mockHistory(q.lastPrice),
            lastPrice: q.lastPrice,
            prevClose: q.closePrice,
            change,
            changePct,
            dayHigh: q.lastPrice * 1.01,
            dayLow: q.lastPrice * 0.99,
            volume: 1_000_000,
            loading: false,
            error: null,
          });
          return;
        }

        const [snapshots, history] = await Promise.all([
          marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
            symbols: symbol,
            feed: "iex",
          }),
          fetchPriceHistory([symbol]),
        ]);

        if (cancelled) return;

        const snap = snapshots[symbol];
        const prevClose = snap?.prevDailyBar.c ?? 0;
        const lastPrice = snap?.latestTrade.p ?? snap?.dailyBar.c ?? prevClose;
        const change = lastPrice - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

        setState({
          priceHistory: history[symbol] ?? [],
          lastPrice,
          prevClose,
          change,
          changePct,
          dayHigh: snap?.dailyBar.h ?? lastPrice,
          dayLow: snap?.dailyBar.l ?? lastPrice,
          volume: snap?.dailyBar.v ?? 0,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          ...EMPTY,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load ticker",
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return state;
}
