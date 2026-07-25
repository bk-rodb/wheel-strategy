import { useState, useEffect } from "react";
import type { PricePoint } from "../types";
import { marketData } from "../api/alpacaClient";
import { fetch52WeekRange, fetchPriceHistory } from "../api/fetchWheelPositions";
import type { AlpacaSnapshotsResponse } from "../api/alpacaTypes";
import { fetchAsset } from "../api/searchAssets";
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
  week52High: number;
  week52Low: number;
  volume: number;
  companyName: string;
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
  week52High: 0,
  week52Low: 0,
  volume: 0,
  companyName: "",
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

function resolveWeek52Range(
  range: { high: number; low: number } | null,
  dayHigh: number,
  dayLow: number,
  lastPrice: number,
): { high: number; low: number } {
  if (range && Number.isFinite(range.high) && Number.isFinite(range.low)) {
    return range;
  }
  const high = Number.isFinite(dayHigh) ? dayHigh : lastPrice;
  const low = Number.isFinite(dayLow) ? dayLow : lastPrice;
  return { high, low };
}

export function useTickerSnapshot(symbol: string): TickerSnapshot {
  const [state, setState] = useState<TickerSnapshot>({
    ...EMPTY,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const sym = symbol.toUpperCase();
    let cancelled = false;
    setState({ ...EMPTY, loading: true, error: null });

    async function load() {
      try {
        if (IS_MOCK) {
          const [q, asset] = await Promise.all([
            Promise.resolve(
              MOCK_QUOTES[sym] ?? {
                closePrice: 100,
                lastPrice: 100 + Math.random() * 10 - 5,
                change: 0,
                changePct: 0,
                source: "close" as const,
              },
            ),
            fetchAsset(sym),
          ]);
          const change = q.lastPrice - q.closePrice;
          const changePct = q.closePrice > 0 ? (change / q.closePrice) * 100 : 0;
          if (cancelled) return;
          const mockRange = resolveWeek52Range(
            { high: q.lastPrice * 1.25, low: q.lastPrice * 0.75 },
            q.lastPrice * 1.01,
            q.lastPrice * 0.99,
            q.lastPrice,
          );
          setState({
            priceHistory: mockHistory(q.lastPrice),
            lastPrice: q.lastPrice,
            prevClose: q.closePrice,
            change,
            changePct,
            dayHigh: q.lastPrice * 1.01,
            dayLow: q.lastPrice * 0.99,
            week52High: mockRange.high,
            week52Low: mockRange.low,
            volume: 1_000_000,
            companyName: asset?.name ?? sym,
            loading: false,
            error: null,
          });
          return;
        }

        const [snapshots, history, week52Range, asset] = await Promise.all([
          marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
            symbols: sym,
            feed: "iex",
          }),
          fetchPriceHistory([sym]),
          fetch52WeekRange(sym),
          fetchAsset(sym),
        ]);

        if (cancelled) return;

        const snap = snapshots[sym];
        const prevClose = snap?.prevDailyBar.c ?? 0;
        const lastPrice = snap?.latestTrade.p ?? snap?.dailyBar.c ?? prevClose;
        const change = lastPrice - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const dayHigh = snap?.dailyBar.h ?? lastPrice;
        const dayLow = snap?.dailyBar.l ?? lastPrice;
        const range = resolveWeek52Range(week52Range, dayHigh, dayLow, lastPrice);

        setState({
          priceHistory: history[sym] ?? [],
          lastPrice,
          prevClose,
          change,
          changePct,
          dayHigh,
          dayLow,
          week52High: range.high,
          week52Low: range.low,
          volume: snap?.dailyBar.v ?? 0,
          companyName: asset?.name ?? sym,
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
