import { marketData } from "./alpacaClient";
import { MARKET_DATA_FEED } from "./fetchWheelPositions";
import type { AlpacaSnapshotsResponse, AlpacaBarsResponse } from "./alpacaTypes";
import { isMarketOpen } from "../utils/marketHours";

export interface StockQuote {
  closePrice: number;
  lastPrice: number;
  change: number;
  changePct: number;
  source: "5min" | "close";
}

export async function fetchStockQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};

  const marketOpen = isMarketOpen();

  const [snapshots, fiveMinBars] = await Promise.all([
    marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
      symbols: symbols.join(","),
      feed: MARKET_DATA_FEED,
    }),
    marketOpen
      ? marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", {
          symbols: symbols.join(","),
          timeframe: "5Min",
          limit: String(symbols.length),
          sort: "desc",
          feed: MARKET_DATA_FEED,
        })
      : Promise.resolve({ bars: {} } as AlpacaBarsResponse),
  ]);

  const result: Record<string, StockQuote> = {};

  for (const symbol of symbols) {
    const snap = snapshots[symbol];
    if (!snap) continue;

    const closePrice = snap.prevDailyBar?.c;
    if (closePrice == null) continue;

    let lastPrice: number | undefined;
    let source: "5min" | "close";

    if (marketOpen && fiveMinBars.bars[symbol]?.length > 0) {
      lastPrice = fiveMinBars.bars[symbol][0].c;
      source = "5min";
    } else {
      lastPrice = snap.dailyBar?.c ?? snap.latestTrade?.p;
      source = "close";
    }

    if (lastPrice == null) continue;

    const change = lastPrice - closePrice;
    const changePct = closePrice > 0 ? (change / closePrice) * 100 : 0;
    result[symbol] = { closePrice, lastPrice, change, changePct, source };
  }

  return result;
}
