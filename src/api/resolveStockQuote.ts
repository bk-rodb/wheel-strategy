import type { AlpacaSnapshot } from "./alpacaTypes";

export interface StockQuote {
  closePrice: number;
  lastPrice: number;
  change: number;
  changePct: number;
  source: "5min" | "close";
}

/** Single source of truth for last-price display (watchlist rows + ticker detail). */
export function resolveStockQuote(
  snap: Pick<AlpacaSnapshot, "prevDailyBar" | "dailyBar" | "latestTrade"> | undefined,
  fiveMinBarClose: number | undefined,
  marketOpen: boolean,
): StockQuote | null {
  if (!snap) return null;

  const closePrice = snap.prevDailyBar?.c;
  if (closePrice == null) return null;

  let lastPrice: number | undefined;
  let source: "5min" | "close";

  if (marketOpen && fiveMinBarClose != null) {
    lastPrice = fiveMinBarClose;
    source = "5min";
  } else {
    lastPrice = snap.dailyBar?.c ?? snap.latestTrade?.p;
    source = "close";
  }

  if (lastPrice == null) return null;

  const change = lastPrice - closePrice;
  const changePct = closePrice > 0 ? (change / closePrice) * 100 : 0;
  return { closePrice, lastPrice, change, changePct, source };
}
