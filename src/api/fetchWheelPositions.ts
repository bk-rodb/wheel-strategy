import type { WheelPosition, WheelPhase, OptionLeg, PricePoint } from "../types";
import { trading, marketData } from "./alpacaClient";
import { fetchAssetNames } from "./searchAssets";
import { parseOsiSymbol } from "./optionOrders";
import type {
  AlpacaBar,
  AlpacaPosition,
  AlpacaBarsResponse,
  AlpacaSnapshotsResponse,
} from "./alpacaTypes";

/** Alpaca market-data feed; defaults to IEX (free tier). Override via `VITE_ALPACA_DATA_FEED`. */
export const MARKET_DATA_FEED = import.meta.env.VITE_ALPACA_DATA_FEED ?? "iex";

type OptionLegWithPnL = OptionLeg & { unrealizedPnL: number };

function stripOptionPnL(opt: OptionLegWithPnL): OptionLeg {
  const { unrealizedPnL: _pnl, ...leg } = opt;
  return leg;
}

function inferPhase(
  stockSide: "long" | "short" | "none",
  option: OptionLeg | undefined,
): WheelPhase {
  if (stockSide === "none" && option?.type === "put") return "cash-secured-put";
  if (stockSide === "long" && option?.type === "call") return "covered-call";
  if (stockSide === "long") return "stock-holding";
  return "stock-holding";
}

function accumulateOptionLegs(
  optionPositions: AlpacaPosition[],
): Record<string, OptionLegWithPnL[]> {
  const byUnderlying: Record<string, OptionLegWithPnL[]> = {};
  for (const opt of optionPositions) {
    const parsed = parseOsiSymbol(opt.symbol);
    if (!parsed) continue;
    const leg: OptionLegWithPnL = {
      type: parsed.type,
      strike: parsed.strike,
      expiration: parsed.expiration,
      premiumReceived: Math.abs(parseFloat(opt.avg_entry_price)),
      contracts: Math.abs(parseInt(opt.qty, 10)),
      currentOptionPrice: parseFloat(opt.current_price),
      unrealizedPnL: parseFloat(opt.unrealized_pl),
    };
    const key = parsed.underlying;
    if (!byUnderlying[key]) byUnderlying[key] = [];
    byUnderlying[key].push(leg);
  }
  return byUnderlying;
}

/** Display leg: nearest expiration (deterministic tie-break). */
function pickDisplayLeg(legs: OptionLegWithPnL[]): OptionLegWithPnL {
  return legs.reduce((best, leg) => (leg.expiration < best.expiration ? leg : best));
}

function sumOptionMetrics(legs: OptionLegWithPnL[]): {
  unrealizedPnL: number;
  premiumCollectedTotal: number;
} {
  return {
    unrealizedPnL: legs.reduce((s, l) => s + l.unrealizedPnL, 0),
    premiumCollectedTotal: legs.reduce(
      (s, l) => s + l.premiumReceived * l.contracts * 100,
      0,
    ),
  };
}

// ─── Daily bar history (60 sessions for SMA50; chart uses last 30) ───────────

const PRICE_HISTORY_DAYS = 60;

export async function fetchPriceHistory(symbols: string[]): Promise<Record<string, PricePoint[]>> {
  if (symbols.length === 0) return {};

  const start = new Date(Date.now() - (PRICE_HISTORY_DAYS + 5) * 86400000)
    .toISOString()
    .slice(0, 10);
  const limitPerRequest = Math.min(10000, symbols.length * (PRICE_HISTORY_DAYS + 10));
  const barsBySymbol: Record<string, AlpacaBar[]> = {};
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      symbols: symbols.join(","),
      timeframe: "1Day",
      start,
      limit: String(limitPerRequest),
      feed: MARKET_DATA_FEED,
      adjustment: "all",
    };
    if (pageToken) params.page_token = pageToken;

    const data = await marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", params);
    for (const [symbol, bars] of Object.entries(data.bars ?? {})) {
      if (!barsBySymbol[symbol]) barsBySymbol[symbol] = [];
      barsBySymbol[symbol].push(...bars);
    }
    pageToken = data.next_page_token ?? undefined;
  } while (pageToken);

  const result: Record<string, PricePoint[]> = {};
  for (const [symbol, bars] of Object.entries(barsBySymbol)) {
    result[symbol] = bars.map((b) => ({
      date: b.t.slice(0, 10),
      price: b.c,
    }));
  }
  return result;
}

const WEEK_52_CALENDAR_DAYS = 370;
const WEEK_52_CACHE_MS = 24 * 60 * 60 * 1000;

const week52Cache = new Map<
  string,
  { result: { high: number; low: number } | null; fetchedAt: number }
>();

/** High/low from daily bars; falls back to close when h/l are missing. */
export function highLowFromDailyBars(bars: AlpacaBar[]): { high: number; low: number } | null {
  let high = -Infinity;
  let low = Infinity;
  let count = 0;

  for (const bar of bars) {
    const h = Number.isFinite(bar.h) ? bar.h : bar.c;
    const l = Number.isFinite(bar.l) ? bar.l : bar.c;
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;
    high = Math.max(high, h);
    low = Math.min(low, l);
    count++;
  }

  if (count === 0) return null;
  return { high, low };
}

function barsForSymbol(
  barsBySymbol: Record<string, AlpacaBar[]> | undefined,
  symbol: string,
): AlpacaBar[] {
  if (!barsBySymbol) return [];
  const sym = symbol.toUpperCase();
  return barsBySymbol[sym] ?? barsBySymbol[symbol] ?? [];
}

/** Up to 52-week high/low; uses all available daily bars when listing is newer. Cached 24h. */
export async function fetch52WeekRange(
  symbol: string,
): Promise<{ high: number; low: number } | null> {
  const sym = symbol.toUpperCase();
  const cached = week52Cache.get(sym);
  if (cached && Date.now() - cached.fetchedAt < WEEK_52_CACHE_MS) {
    return cached.result;
  }

  const start = new Date(Date.now() - WEEK_52_CALENDAR_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  const allBars: AlpacaBar[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      symbols: sym,
      timeframe: "1Day",
      start,
      limit: "10000",
      feed: MARKET_DATA_FEED,
      adjustment: "all",
    };
    if (pageToken) params.page_token = pageToken;

    const data = await marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", params);
    allBars.push(...barsForSymbol(data.bars, sym));
    pageToken = data.next_page_token ?? undefined;
  } while (pageToken);

  const result = highLowFromDailyBars(allBars);
  week52Cache.set(sym, { result, fetchedAt: Date.now() });
  return result;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchWheelPositions(): Promise<WheelPosition[]> {
  const allPositions = await trading.get<AlpacaPosition[]>("/v2/positions");

  const equityPositions = allPositions.filter((p) => p.asset_class === "us_equity");
  const optionPositions = allPositions.filter((p) => p.asset_class === "us_option");

  const optionsByUnderlying = accumulateOptionLegs(optionPositions);

  // Fetch equity snapshots (current price, OHLCV, prev close)
  const equitySymbols = equityPositions.map((p) => p.symbol);

  // Also include underlyings that only have an option (CSP with no stock yet)
  const cspOnlySymbols = Object.keys(optionsByUnderlying).filter(
    (u) => !equitySymbols.includes(u),
  );
  const allSymbols = [...equitySymbols, ...cspOnlySymbols];

  const [snapshots, priceHistory, assetNames] = await Promise.all([
    allSymbols.length > 0
      ? marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
          symbols: allSymbols.join(","),
          feed: MARKET_DATA_FEED,
        })
      : Promise.resolve({} as AlpacaSnapshotsResponse),
    fetchPriceHistory(allSymbols),
    fetchAssetNames(allSymbols),
  ]);

  const now = new Date().toISOString();

  // Build WheelPosition for each equity holding
  const positions: WheelPosition[] = equityPositions.map((pos) => {
    const snap = snapshots[pos.symbol];
    const legs = optionsByUnderlying[pos.symbol] ?? [];
    const optMetrics = sumOptionMetrics(legs);
    const displayLeg = legs.length > 0 ? pickDisplayLeg(legs) : undefined;
    const activeOption = displayLeg ? stripOptionPnL(displayLeg) : undefined;
    const qty = parseInt(pos.qty, 10);
    const shares = pos.side === "short" ? -qty : qty;
    const costBasis = parseFloat(pos.avg_entry_price);
    const currentPrice = snap?.latestTrade?.p ?? parseFloat(pos.current_price);
    const prevClose = snap?.prevDailyBar?.c ?? parseFloat(pos.lastday_price);
    const cashDeployed = shares * costBasis;
    const stockSide = pos.side === "long" ? "long" : "short";

    return {
      id: pos.symbol,
      ticker: pos.symbol,
      companyName: assetNames[pos.symbol] ?? pos.symbol,
      sector: "—",
      phase: inferPhase(stockSide, activeOption),
      shares,
      costBasis,
      currentPrice,
      previousClose: prevClose,
      dayHigh: snap?.dailyBar?.h ?? currentPrice,
      dayLow: snap?.dailyBar?.l ?? currentPrice,
      volume: snap?.dailyBar?.v ?? 0,
      marketCap: 0,
      priceHistory: priceHistory[pos.symbol] ?? [],
      activeOption,
      ...(legs.length > 1 ? { optionLegCount: legs.length } : {}),
      premiumCollectedTotal: optMetrics.premiumCollectedTotal,
      cashDeployed,
      unrealizedPnL: parseFloat(pos.unrealized_pl) + optMetrics.unrealizedPnL,
      dataSource: "alpaca",
      lastUpdated: now,
    };
  });

  // Build WheelPosition for CSP-only underlyings (no stock held yet)
  for (const symbol of cspOnlySymbols) {
    const snap = snapshots[symbol];
    const legs = optionsByUnderlying[symbol];
    if (!legs || legs.length === 0) continue;
    const optMetrics = sumOptionMetrics(legs);
    const displayLeg = pickDisplayLeg(legs);
    const activeOption = stripOptionPnL(displayLeg);
    const currentPrice = snap?.latestTrade?.p ?? 0;
    const prevClose = snap?.prevDailyBar?.c ?? currentPrice;
    const cashDeployed = legs.reduce((s, l) => s + l.strike * l.contracts * 100, 0);

    positions.push({
      id: symbol,
      ticker: symbol,
      companyName: assetNames[symbol] ?? symbol,
      sector: "—",
      phase: "cash-secured-put",
      shares: 0,
      costBasis: 0,
      currentPrice,
      previousClose: prevClose,
      dayHigh: snap?.dailyBar?.h ?? currentPrice,
      dayLow: snap?.dailyBar?.l ?? currentPrice,
      volume: snap?.dailyBar?.v ?? 0,
      marketCap: 0,
      priceHistory: priceHistory[symbol] ?? [],
      activeOption,
      ...(legs.length > 1 ? { optionLegCount: legs.length } : {}),
      premiumCollectedTotal: optMetrics.premiumCollectedTotal,
      cashDeployed,
      unrealizedPnL: optMetrics.unrealizedPnL,
      dataSource: "alpaca",
      lastUpdated: now,
    });
  }

  return positions;
}
