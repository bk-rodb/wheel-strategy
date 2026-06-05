import { trading } from "./alpacaClient";

export interface AssetResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface AlpacaAsset {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  tradable: boolean;
  asset_class: string;
}

const MOCK_ASSETS: AssetResult[] = [
  { symbol: "AAPL",  name: "Apple Inc.",               exchange: "NASDAQ" },
  { symbol: "AMZN",  name: "Amazon.com Inc.",           exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.",             exchange: "NASDAQ" },
  { symbol: "META",  name: "Meta Platforms Inc.",       exchange: "NASDAQ" },
  { symbol: "MSFT",  name: "Microsoft Corp.",           exchange: "NASDAQ" },
  { symbol: "NVDA",  name: "NVIDIA Corp.",              exchange: "NASDAQ" },
  { symbol: "TSLA",  name: "Tesla Inc.",                exchange: "NASDAQ" },
  { symbol: "SPY",   name: "SPDR S&P 500 ETF",         exchange: "NYSE" },
  { symbol: "QQQ",   name: "Invesco QQQ Trust",         exchange: "NASDAQ" },
  { symbol: "AMD",   name: "Advanced Micro Devices",   exchange: "NASDAQ" },
  { symbol: "INTC",  name: "Intel Corp.",               exchange: "NASDAQ" },
  { symbol: "NFLX",  name: "Netflix Inc.",              exchange: "NASDAQ" },
  { symbol: "DIS",   name: "Walt Disney Co.",           exchange: "NYSE" },
  { symbol: "BA",    name: "Boeing Co.",                exchange: "NYSE" },
  { symbol: "JPM",   name: "JPMorgan Chase & Co.",     exchange: "NYSE" },
  { symbol: "GS",    name: "Goldman Sachs Group",      exchange: "NYSE" },
  { symbol: "V",     name: "Visa Inc.",                exchange: "NYSE" },
  { symbol: "WMT",   name: "Walmart Inc.",             exchange: "NYSE" },
  { symbol: "XOM",   name: "Exxon Mobil Corp.",        exchange: "NYSE" },
  { symbol: "COIN",  name: "Coinbase Global Inc.",     exchange: "NASDAQ" },
  { symbol: "PLTR",  name: "Palantir Technologies",    exchange: "NYSE" },
  { symbol: "HOOD",  name: "Robinhood Markets Inc.",   exchange: "NASDAQ" },
  { symbol: "SOFI",  name: "SoFi Technologies Inc.",   exchange: "NASDAQ" },
];

const USE_MOCK = !import.meta.env.VITE_ALPACA_API_KEY_ID;

export async function searchAssets(query: string): Promise<AssetResult[]> {
  if (query.length < 1) return [];

  if (USE_MOCK) {
    const q = query.toUpperCase();
    const startsWith = MOCK_ASSETS.filter((a) => a.symbol.startsWith(q));
    const contains = MOCK_ASSETS.filter(
      (a) => !a.symbol.startsWith(q) && a.name.toUpperCase().includes(q),
    );
    return [...startsWith, ...contains].slice(0, 5);
  }

  const results = await trading.get<AlpacaAsset[]>("/v2/assets", {
    status: "active",
    asset_class: "us_equity",
    search: query,
  });

  const mapped = results
    .filter((a) => a.tradable)
    .map((a) => ({ symbol: a.symbol, name: a.name, exchange: a.exchange }));
  const q = query.toUpperCase();
  const startsWith = mapped.filter((a) => a.symbol.startsWith(q));
  const contains = mapped.filter((a) => !a.symbol.startsWith(q));
  return [...startsWith, ...contains].slice(0, 5);
}
