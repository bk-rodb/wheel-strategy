import type { AnalysisLevel } from "./config.js";
import { dteUntil } from "./calendar.js";
import { analysisGet, marketData, trading } from "./http.js";
import type { OptionSide } from "./positions.js";

export interface StrikeSuggestion {
  level: string;
  strike: number;
  pctFromSpot?: number | null;
  targetDelta?: number | null;
  blackScholesDelta?: number | null;
  distanceAtr14?: number | null;
  empiricalAssignmentProb?: number | null;
  blackScholesAssignmentProb?: number | null;
  estPremium?: number | null;
  annualizedYield?: number | null;
}

interface WheelAnalysisResult {
  symbol: string;
  currentPrice: number;
  put: StrikeSuggestion[] | null;
  call: StrikeSuggestion[] | null;
  warnings?: string[] | null;
}

interface AlpacaOptionContract {
  symbol: string;
  tradable: boolean;
  expiration_date: string;
  root_symbol: string;
  type: "call" | "put";
  strike_price: string;
  multiplier: string;
  size?: string;
  open_interest?: string;
}

interface AlpacaOptionContractsResponse {
  option_contracts: AlpacaOptionContract[];
  next_page_token: string | null;
}

interface AlpacaOptionSnapshot {
  latestQuote?: { bp?: number; ap?: number; t?: string };
  latestTrade?: { p?: number; t?: string };
}

interface AlpacaOptionSnapshotsResponse {
  snapshots?: Record<string, AlpacaOptionSnapshot>;
}

export interface LadderRow {
  level: AnalysisLevel;
  strike: number;
  pctFromSpot: number;
  empiricalAssignmentProb: number;
  blackScholesAssignmentProb: number;
  estPremium: number;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  sellLimit: number;
  contractSymbol: string;
  tradable: boolean;
  multiplier: number;
}

export interface FridayLadder {
  symbol: string;
  side: OptionSide;
  expiration: string;
  dte: number;
  spot: number;
  qty: number;
  row: LadderRow;
  warnings: string[];
}

/** Round to option tick ($0.01 below $3, $0.05 at/above), away from own side for sells. */
export function roundOptionLimit(price: number, side: "buy" | "sell"): number {
  if (price < 3) {
    const cents = price * 100;
    const roundedCents =
      side === "sell" ? Math.ceil(cents - 1e-9) : Math.floor(cents + 1e-9);
    return Math.max(1, roundedCents) / 100;
  }
  const nickels = price / 0.05;
  const roundedNickels =
    side === "sell" ? Math.ceil(nickels - 1e-9) : Math.floor(nickels + 1e-9);
  return Math.round(Math.max(0.05, roundedNickels * 0.05) * 100) / 100;
}

function isStandardContract(c: AlpacaOptionContract, symbol: string): boolean {
  return (
    c.root_symbol.toUpperCase() === symbol.toUpperCase() &&
    c.multiplier === "100" &&
    (c.size === "100" || c.size === undefined || c.size === "")
  );
}

function nearestContract(
  contracts: AlpacaOptionContract[],
  targetStrike: number,
): AlpacaOptionContract | null {
  if (contracts.length === 0) return null;
  let best = contracts[0];
  let bestDist = Math.abs(parseFloat(best.strike_price) - targetStrike);
  for (let i = 1; i < contracts.length; i++) {
    const c = contracts[i];
    const dist = Math.abs(parseFloat(c.strike_price) - targetStrike);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

function midFromSnapshot(
  snap: AlpacaOptionSnapshot | undefined,
  fallback: number,
): { bid: number | null; ask: number | null; mid: number | null; sellLimit: number } {
  const bid = snap?.latestQuote?.bp ?? null;
  const ask = snap?.latestQuote?.ap ?? null;
  const trade = snap?.latestTrade?.p ?? null;
  let mid: number | null = null;
  if (bid != null && ask != null && bid > 0 && ask > 0) mid = (bid + ask) / 2;
  else if (trade != null && trade > 0) mid = trade;
  else if (bid != null && bid > 0) mid = bid;
  else if (ask != null && ask > 0) mid = ask;
  return {
    bid,
    ask,
    mid,
    sellLimit: roundOptionLimit(mid ?? bid ?? fallback, "sell"),
  };
}

async function fetchContracts(
  symbol: string,
  expiration: string,
  type: OptionSide,
  signal?: AbortSignal,
): Promise<AlpacaOptionContract[]> {
  const all: AlpacaOptionContract[] = [];
  let page: string | undefined;
  do {
    const params: Record<string, string> = {
      underlying_symbols: symbol,
      expiration_date: expiration,
      type,
      status: "active",
      limit: "100",
    };
    if (page) params.page_token = page;
    const res = await trading.get<AlpacaOptionContractsResponse>(
      "/v2/options/contracts",
      params,
      signal,
    );
    all.push(
      ...(res.option_contracts ?? []).filter((c) => isStandardContract(c, symbol)),
    );
    page = res.next_page_token ?? undefined;
  } while (page);
  return all;
}

async function fetchSnapshot(
  contractSymbol: string,
  signal?: AbortSignal,
): Promise<AlpacaOptionSnapshot | undefined> {
  const res = await marketData.get<AlpacaOptionSnapshotsResponse>(
    "/v1beta1/options/snapshots",
    { symbols: contractSymbol },
    signal,
  );
  return res.snapshots?.[contractSymbol];
}

/**
 * Build the mid-tier (or configured level) Friday ladder row: analysis → snap → quotes.
 */
export async function fetchRegularLadder(opts: {
  symbol: string;
  side: OptionSide;
  qty: number;
  expiration: string;
  level: AnalysisLevel;
  signal?: AbortSignal;
}): Promise<FridayLadder> {
  const symbol = opts.symbol.toUpperCase();
  const dte = dteUntil(opts.expiration);
  const warnings: string[] = [];

  const analysis = await analysisGet<WheelAnalysisResult>(
    "/api/analysis/wheel",
    {
      symbol,
      dte: String(dte),
      granularity: "daily",
    },
    opts.signal,
  );

  if (analysis.warnings?.length) warnings.push(...analysis.warnings);

  const suggestions = (opts.side === "call" ? analysis.call : analysis.put) ?? [];
  const sug = suggestions.find((s) => s.level === opts.level);
  if (!sug || sug.estPremium == null) {
    throw new Error(
      `No ${opts.level} ${opts.side} suggestion for ${symbol} (dte=${dte})`,
    );
  }

  let contracts: AlpacaOptionContract[] = [];
  try {
    contracts = await fetchContracts(symbol, opts.expiration, opts.side, opts.signal);
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "Failed to load option contracts",
    );
  }

  if (contracts.length === 0) {
    throw new Error(
      `No listed ${opts.side}s for ${symbol} expiring ${opts.expiration}`,
    );
  }

  const contract = nearestContract(contracts, sug.strike);
  if (!contract) {
    throw new Error(`Could not snap strike ${sug.strike} for ${symbol}`);
  }

  let snap: AlpacaOptionSnapshot | undefined;
  try {
    snap = await fetchSnapshot(contract.symbol, opts.signal);
  } catch (e) {
    warnings.push(
      e instanceof Error
        ? `Option quotes unavailable: ${e.message}`
        : "Option quotes unavailable",
    );
  }

  const prices = midFromSnapshot(snap, sug.estPremium);
  const strike = parseFloat(contract.strike_price);
  const spot = analysis.currentPrice;

  const row: LadderRow = {
    level: opts.level,
    strike,
    pctFromSpot: spot > 0 ? strike / spot - 1 : (sug.pctFromSpot ?? 0),
    empiricalAssignmentProb: sug.empiricalAssignmentProb ?? 0,
    blackScholesAssignmentProb: sug.blackScholesAssignmentProb ?? 0,
    estPremium: sug.estPremium,
    bid: prices.bid,
    ask: prices.ask,
    mid: prices.mid,
    sellLimit: prices.sellLimit,
    contractSymbol: contract.symbol,
    tradable: contract.tradable,
    multiplier: 100,
  };

  if (Math.abs(strike - sug.strike) / sug.strike > 0.02) {
    warnings.push(
      `Snapped strike ${strike} is >2% from analysis ${sug.strike} — probs approximate`,
    );
  }

  return {
    symbol,
    side: opts.side,
    expiration: opts.expiration,
    dte,
    spot,
    qty: opts.qty,
    row,
    warnings,
  };
}
