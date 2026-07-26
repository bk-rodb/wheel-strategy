import { marketData } from "./alpacaClient";
import { MARKET_DATA_FEED } from "./fetchWheelPositions";
import type { AlpacaSnapshotsResponse, AlpacaBarsResponse } from "./alpacaTypes";
import { isMarketOpen } from "../utils/marketHours";
import { resolveStockQuote, type StockQuote } from "./resolveStockQuote";

export type { StockQuote } from "./resolveStockQuote";
export { resolveStockQuote } from "./resolveStockQuote";

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
    const quote = resolveStockQuote(
      snapshots[symbol],
      fiveMinBars.bars[symbol]?.[0]?.c,
      marketOpen,
    );
    if (quote) result[symbol] = quote;
  }

  return result;
}
