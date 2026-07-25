import type { WheelPosition, WheelPhase, OptionLeg, PricePoint } from "../types";
import { trading, marketData } from "./alpacaClient";
import { fetchAssetNames } from "./searchAssets";
import { parseOsiSymbol } from "./optionOrders";
import type {
  AlpacaPosition,
  AlpacaBarsResponse,
  AlpacaSnapshotsResponse,
} from "./alpacaTypes";

function stripOptionPnL(opt: OptionLeg & { unrealizedPnL: number }): OptionLeg {
  const { unrealizedPnL: _pnl, ...leg } = opt;
  return leg;
}


function inferPhase(
  hasStock: boolean,
  option: OptionLeg | undefined,
): WheelPhase {
  if (!hasStock && option?.type === "put") return "cash-secured-put";
  if (hasStock && option?.type === "call") return "covered-call";
  return "stock-holding";
}

// ─── Daily bar history (60 sessions for SMA50; chart uses last 30) ───────────

const PRICE_HISTORY_DAYS = 60;

export async function fetchPriceHistory(symbols: string[]): Promise<Record<string, PricePoint[]>> {
  if (symbols.length === 0) return {};

  const start = new Date(Date.now() - (PRICE_HISTORY_DAYS + 5) * 86400000)
    .toISOString()
    .slice(0, 10);
  const data = await marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", {
    symbols: symbols.join(","),
    timeframe: "1Day",
    start,
    limit: String(PRICE_HISTORY_DAYS),
    feed: "iex",
  });

  const result: Record<string, PricePoint[]> = {};
  for (const [symbol, bars] of Object.entries(data.bars ?? {})) {
    result[symbol] = bars.map((b) => ({
      date: b.t.slice(0, 10),
      price: b.c,
    }));
  }
  return result;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchWheelPositions(): Promise<WheelPosition[]> {
  const allPositions = await trading.get<AlpacaPosition[]>("/v2/positions");

  const equityPositions = allPositions.filter((p) => p.asset_class === "us_equity");
  const optionPositions = allPositions.filter((p) => p.asset_class === "us_option");

  // Build a map of underlying → active option leg
  const optionsByUnderlying: Record<string, OptionLeg & { unrealizedPnL: number }> = {};
  for (const opt of optionPositions) {
    const parsed = parseOsiSymbol(opt.symbol);
    if (!parsed) continue;
    const contracts = Math.abs(parseInt(opt.qty, 10));
    const premiumReceived = Math.abs(parseFloat(opt.avg_entry_price));
    optionsByUnderlying[parsed.underlying] = {
      type: parsed.type,
      strike: parsed.strike,
      expiration: parsed.expiration,
      premiumReceived,
      contracts,
      currentOptionPrice: parseFloat(opt.current_price),
      unrealizedPnL: parseFloat(opt.unrealized_pl),
    };
  }

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
          feed: "iex",
        })
      : Promise.resolve({} as AlpacaSnapshotsResponse),
    fetchPriceHistory(allSymbols),
    fetchAssetNames(allSymbols),
  ]);

  const now = new Date().toISOString();

  // Build WheelPosition for each equity holding
  const positions: WheelPosition[] = equityPositions.map((pos) => {
    const snap = snapshots[pos.symbol];
    const optData = optionsByUnderlying[pos.symbol];
    const activeOption = optData ? stripOptionPnL(optData) : undefined;
    const shares = parseInt(pos.qty, 10);
    const costBasis = parseFloat(pos.avg_entry_price);
    const currentPrice = snap?.latestTrade.p ?? parseFloat(pos.current_price);
    const prevClose = snap?.prevDailyBar.c ?? parseFloat(pos.lastday_price);
    const cashDeployed = shares * costBasis;

    return {
      id: pos.symbol,
      ticker: pos.symbol,
      companyName: assetNames[pos.symbol] ?? pos.symbol,
      sector: "—",
      phase: inferPhase(true, activeOption),
      shares,
      costBasis,
      currentPrice,
      previousClose: prevClose,
      dayHigh: snap?.dailyBar.h ?? currentPrice,
      dayLow: snap?.dailyBar.l ?? currentPrice,
      volume: snap?.dailyBar.v ?? 0,
      marketCap: 0,
      priceHistory: priceHistory[pos.symbol] ?? [],
      activeOption,
      premiumCollectedTotal: activeOption
        ? activeOption.premiumReceived * activeOption.contracts * 100
        : 0,
      cashDeployed,
      unrealizedPnL:
        parseFloat(pos.unrealized_pl) + (optData?.unrealizedPnL ?? 0),
      dataSource: "alpaca",
      lastUpdated: now,
    };
  });

  // Build WheelPosition for CSP-only underlyings (no stock held yet)
  for (const symbol of cspOnlySymbols) {
    const snap = snapshots[symbol];
    const optData = optionsByUnderlying[symbol];
    if (!optData) continue;
    const activeOption = stripOptionPnL(optData);
    const currentPrice = snap?.latestTrade.p ?? 0;
    const prevClose = snap?.prevDailyBar.c ?? currentPrice;
    const cashDeployed = optData.strike * optData.contracts * 100;

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
      dayHigh: snap?.dailyBar.h ?? currentPrice,
      dayLow: snap?.dailyBar.l ?? currentPrice,
      volume: snap?.dailyBar.v ?? 0,
      marketCap: 0,
      priceHistory: priceHistory[symbol] ?? [],
      activeOption,
      premiumCollectedTotal: optData.premiumReceived * optData.contracts * 100,
      cashDeployed,
      unrealizedPnL: optData.unrealizedPnL,
      dataSource: "alpaca",
      lastUpdated: now,
    });
  }

  return positions;
}
