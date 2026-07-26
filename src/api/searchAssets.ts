import { IS_MOCK } from "../config";
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
  { symbol: "SPCX",  name: "Space Exploration Technologies Corp.", exchange: "NASDAQ" },
];

export async function fetchAsset(symbol: string): Promise<AssetResult | null> {
  const sym = symbol.toUpperCase();

  if (IS_MOCK) {
    return MOCK_ASSETS.find((a) => a.symbol === sym) ?? { symbol: sym, name: sym, exchange: "" };
  }

  try {
    const asset = await trading.get<AlpacaAsset>(`/v2/assets/${sym}`);
    if (!asset.tradable) return null;
    return { symbol: asset.symbol, name: asset.name, exchange: asset.exchange };
  } catch {
    return null;
  }
}

/** Company names rarely change — cache for the session to cut per-refresh fan-out (H-6). */
const assetNameCache = new Map<string, string>();

export async function fetchAssetNames(symbols: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const missing = unique.filter((s) => !assetNameCache.has(s));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (sym) => {
        const asset = await fetchAsset(sym);
        assetNameCache.set(sym, asset?.name ?? sym);
      }),
    );
  }
  return Object.fromEntries(unique.map((s) => [s, assetNameCache.get(s) ?? s]));
}

export async function searchAssets(query: string): Promise<AssetResult[]> {
  if (query.length < 1) return [];

  if (IS_MOCK) {
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
