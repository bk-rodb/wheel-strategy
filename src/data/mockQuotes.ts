import type { WatchlistQuote } from "../hooks/useWatchlist";

export const MOCK_QUOTES: Record<string, WatchlistQuote> = {
  TSLA: { closePrice: 237.80, lastPrice: 241.30, change:  3.50, changePct:  1.47, source: "5min" },
  NVDA: { closePrice: 121.20, lastPrice: 118.40, change: -2.80, changePct: -2.31, source: "5min" },
  AMZN: { closePrice: 191.50, lastPrice: 193.70, change:  2.20, changePct:  1.15, source: "5min" },
  SPY:  { closePrice: 536.40, lastPrice: 538.60, change:  2.20, changePct:  0.41, source: "5min" },
  AAPL: { closePrice: 210.10, lastPrice: 212.50, change:  2.40, changePct:  1.14, source: "5min" },
  MSFT: { closePrice: 444.80, lastPrice: 447.30, change:  2.50, changePct:  0.56, source: "5min" },
  SPCX: { closePrice: 158.00, lastPrice: 162.40, change:  4.40, changePct:  2.78, source: "5min" },
};
