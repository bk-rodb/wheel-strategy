import type { WheelPosition, WheelPhase, OptionLeg, PricePoint } from "../types";
import { trading, marketData } from "./alpacaClient";
import type {
  AlpacaPosition,
  AlpacaBarsResponse,
  AlpacaSnapshotsResponse,
} from "./alpacaTypes";

// ─── OSI symbol parser ────────────────────────────────────────────────────────
// Format: TSLA  250718C00250000  (underlying padded to 6, YYMMDD, C/P, strike*1000)

function parseOptionSymbol(
  osi: string,
): { underlying: string; expiration: string; type: "call" | "put"; strike: number } | null {
  // OSI is 21 chars: 6 underlying + 6 date + 1 type + 8 strike
  if (osi.length !== 21) return null;
  const underlying = osi.slice(0, 6).trim();
  const dateStr = osi.slice(6, 12); // YYMMDD
  const optType = osi.slice(12, 13);
  const strikeRaw = osi.slice(13, 21);

  const year = parseInt(dateStr.slice(0, 2), 10) + 2000;
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiration = `${year}-${month}-${day}`;
  const strike = parseInt(strikeRaw, 10) / 1000;
  const type = optType === "C" ? "call" : "put";

  return { underlying, expiration, type, strike };
}

// ─── Phase inference ──────────────────────────────────────────────────────────

function inferPhase(
  hasStock: boolean,
  option: OptionLeg | undefined,
): WheelPhase {
  if (!hasStock && option?.type === "put") return "cash-secured-put";
  if (hasStock && option?.type === "call") return "covered-call";
  return "stock-holding";
}

// ─── 30-day bar history ───────────────────────────────────────────────────────

async function fetchPriceHistory(symbols: string[]): Promise<Record<string, PricePoint[]>> {
  if (symbols.length === 0) return {};

  const start = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const data = await marketData.get<AlpacaBarsResponse>("/v2/stocks/bars", {
    symbols: symbols.join(","),
    timeframe: "1Day",
    start,
    limit: "30",
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
  const optionsByUnderlying: Record<string, OptionLeg> = {};
  for (const opt of optionPositions) {
    const parsed = parseOptionSymbol(opt.symbol);
    if (!parsed) continue;
    optionsByUnderlying[parsed.underlying] = {
      type: parsed.type,
      strike: parsed.strike,
      expiration: parsed.expiration,
      premiumReceived: Math.abs(parseFloat(opt.avg_entry_price)),
      contracts: Math.abs(parseInt(opt.qty, 10)),
      currentOptionPrice: parseFloat(opt.current_price),
    };
  }

  // Fetch equity snapshots (current price, OHLCV, prev close)
  const equitySymbols = equityPositions.map((p) => p.symbol);

  // Also include underlyings that only have an option (CSP with no stock yet)
  const cspOnlySymbols = Object.keys(optionsByUnderlying).filter(
    (u) => !equitySymbols.includes(u),
  );
  const allSymbols = [...equitySymbols, ...cspOnlySymbols];

  const [snapshots, priceHistory] = await Promise.all([
    allSymbols.length > 0
      ? marketData.get<AlpacaSnapshotsResponse>("/v2/stocks/snapshots", {
          symbols: allSymbols.join(","),
          feed: "iex",
        })
      : Promise.resolve({} as AlpacaSnapshotsResponse),
    fetchPriceHistory(allSymbols),
  ]);

  const now = new Date().toISOString();

  // Build WheelPosition for each equity holding
  const positions: WheelPosition[] = equityPositions.map((pos) => {
    const snap = snapshots[pos.symbol];
    const activeOption = optionsByUnderlying[pos.symbol];
    const shares = parseInt(pos.qty, 10);
    const costBasis = parseFloat(pos.avg_entry_price);
    const currentPrice = snap?.latestTrade.p ?? parseFloat(pos.current_price);
    const prevClose = snap?.prevDailyBar.c ?? parseFloat(pos.lastday_price);
    const cashDeployed = shares * costBasis;

    return {
      id: pos.symbol,
      ticker: pos.symbol,
      companyName: pos.symbol,
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
      premiumCollectedTotal: 0, // Alpaca doesn't expose cumulative — track via closed orders if needed
      cashDeployed,
      unrealizedPnL: parseFloat(pos.unrealized_pl),
      dataSource: "alpaca",
      lastUpdated: now,
    };
  });

  // Build WheelPosition for CSP-only underlyings (no stock held yet)
  for (const symbol of cspOnlySymbols) {
    const snap = snapshots[symbol];
    const activeOption = optionsByUnderlying[symbol];
    if (!activeOption) continue;
    const currentPrice = snap?.latestTrade.p ?? 0;
    const prevClose = snap?.prevDailyBar.c ?? currentPrice;
    const cashDeployed = activeOption.strike * activeOption.contracts * 100;

    positions.push({
      id: symbol,
      ticker: symbol,
      companyName: symbol,
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
      premiumCollectedTotal: 0,
      cashDeployed,
      unrealizedPnL: 0,
      dataSource: "alpaca",
      lastUpdated: now,
    });
  }

  return positions;
}
