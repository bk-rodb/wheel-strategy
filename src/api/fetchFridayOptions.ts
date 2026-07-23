import { IS_MOCK } from "../config";
import type { AnalysisLevel, StrikeSuggestion } from "../types";
import {
  buildExpirationPickerList,
  mockListedExpirations,
} from "../utils/optionExpirations";
import { dteUntil, nextFriday, toDateString } from "../utils/nextFriday";
import { marketData, trading } from "./alpacaClient";
import type {
  AlpacaOptionContract,
  AlpacaOptionContractsResponse,
  AlpacaOptionSnapshot,
  AlpacaOptionSnapshotsResponse,
} from "./alpacaTypes";
import { fetchWheelAnalysis } from "./fetchWheelAnalysis";

export type OptionSide = "put" | "call";

export interface FridayOptionRow {
  level: AnalysisLevel;
  label: "LOW" | "MED" | "HIGH";
  strike: number;
  pctFromSpot: number;
  empiricalAssignmentProb: number;
  blackScholesAssignmentProb: number;
  estPremium: number;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  /** Limit price suggested for a sell (mid, else bid, else est). */
  sellLimit: number;
  contractSymbol: string;
  openInterest: number | null;
}

export interface FridayOptionsBundle {
  symbol: string;
  side: OptionSide;
  expiration: string;
  dte: number;
  spot: number;
  contracts: number;
  rows: FridayOptionRow[];
  warnings: string[];
}

const LEVEL_LABEL: Record<AnalysisLevel, "LOW" | "MED" | "HIGH"> = {
  safe: "LOW",
  regular: "MED",
  risky: "HIGH",
};

const LEVEL_ORDER: AnalysisLevel[] = ["safe", "regular", "risky"];

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

function midFromSnapshot(snap: AlpacaOptionSnapshot | undefined, fallback: number): {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  sellLimit: number;
} {
  const bid = snap?.latestQuote?.bp ?? null;
  const ask = snap?.latestQuote?.ap ?? null;
  const trade = snap?.latestTrade?.p ?? null;
  let mid: number | null = null;
  if (bid != null && ask != null && bid > 0 && ask > 0) mid = (bid + ask) / 2;
  else if (trade != null && trade > 0) mid = trade;
  else if (bid != null && bid > 0) mid = bid;
  else if (ask != null && ask > 0) mid = ask;

  const sellLimit = roundPrice(mid ?? bid ?? fallback);
  return { bid, ask, mid, sellLimit };
}

function roundPrice(n: number): number {
  // Options under $3 often trade in $0.01; above in $0.05 — keep cents for simplicity.
  return Math.max(0.01, Math.round(n * 100) / 100);
}

/** Unique active expiration dates for an underlying (today through ~4 months). */
export async function fetchListedExpirations(
  symbol: string,
  type: OptionSide,
  signal?: AbortSignal,
): Promise<string[]> {
  if (IS_MOCK) return mockListedExpirations();

  const today = toDateString(new Date());
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 4);
  const expirationDateLte = toDateString(maxDate);

  const dates = new Set<string>();
  let page: string | undefined;
  do {
    const params: Record<string, string> = {
      underlying_symbols: symbol,
      type,
      status: "active",
      expiration_date_gte: today,
      expiration_date_lte: expirationDateLte,
      limit: "100",
    };
    if (page) params.page_token = page;
    const res = await trading.get<AlpacaOptionContractsResponse>(
      "/v2/options/contracts",
      params,
    );
    for (const c of res.option_contracts ?? []) {
      dates.add(c.expiration_date);
    }
    page = res.next_page_token ?? undefined;
    if (signal?.aborted) break;
  } while (page);

  return [...dates].sort();
}

export async function fetchExpirationPicker(
  symbol: string,
  type: OptionSide,
  signal?: AbortSignal,
): Promise<{ dates: string[]; defaultExpiration: string }> {
  const listed = await fetchListedExpirations(symbol, type, signal);
  return buildExpirationPickerList(listed);
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
    );
    all.push(...(res.option_contracts ?? []));
    page = res.next_page_token ?? undefined;
    if (signal?.aborted) break;
  } while (page);
  return all;
}

async function fetchSnapshots(symbols: string[]): Promise<Record<string, AlpacaOptionSnapshot>> {
  if (symbols.length === 0) return {};
  const res = await marketData.get<AlpacaOptionSnapshotsResponse>("/v1beta1/options/snapshots", {
    symbols: symbols.join(","),
  });
  return res.snapshots ?? {};
}

function buildRowsFromSuggestions(
  suggestions: StrikeSuggestion[],
  contracts: AlpacaOptionContract[],
  snapshots: Record<string, AlpacaOptionSnapshot>,
  mockPrices: boolean,
): FridayOptionRow[] {
  const rows: FridayOptionRow[] = [];
  for (const level of LEVEL_ORDER) {
    const sug = suggestions.find((s) => s.level === level);
    if (!sug) continue;
    const contract = nearestContract(contracts, sug.strike);
    if (!contract && !mockPrices) continue;

    const strike = contract ? parseFloat(contract.strike_price) : sug.strike;
    const contractSymbol =
      contract?.symbol ??
      `MOCK${level.toUpperCase()}${Math.round(strike * 1000).toString().padStart(8, "0")}`;
    const snap = snapshots[contractSymbol];
    const prices = mockPrices
      ? {
          bid: roundPrice(sug.estPremium * 0.95),
          ask: roundPrice(sug.estPremium * 1.05),
          mid: roundPrice(sug.estPremium),
          sellLimit: roundPrice(sug.estPremium),
        }
      : midFromSnapshot(snap, sug.estPremium);

    rows.push({
      level,
      label: LEVEL_LABEL[level],
      strike,
      pctFromSpot: sug.pctFromSpot,
      empiricalAssignmentProb: sug.empiricalAssignmentProb,
      blackScholesAssignmentProb: sug.blackScholesAssignmentProb,
      estPremium: sug.estPremium,
      bid: prices.bid,
      ask: prices.ask,
      mid: prices.mid,
      sellLimit: prices.sellLimit,
      contractSymbol,
      openInterest: contract?.open_interest != null ? parseInt(contract.open_interest, 10) : null,
    });
  }
  return rows;
}

/** Recompute pctFromSpot against the live spot used for the bundle. */
function withSpotPct(rows: FridayOptionRow[], spot: number): FridayOptionRow[] {
  if (spot <= 0) return rows;
  return rows.map((r) => ({ ...r, pctFromSpot: r.strike / spot - 1 }));
}

/**
 * Load next-Friday put or call suggestions: analysis strikes snapped to the
 * listed chain, with live bid/ask when available.
 */
export async function fetchFridayOptions(opts: {
  symbol: string;
  side: OptionSide;
  shares: number;
  expiration?: string;
  signal?: AbortSignal;
}): Promise<FridayOptionsBundle> {
  const symbol = opts.symbol.toUpperCase();
  const expiration = opts.expiration ?? toDateString(nextFriday());
  const dte = dteUntil(expiration);
  const contractsQty =
    opts.side === "call" ? Math.max(1, Math.floor(opts.shares / 100)) : 1;
  const warnings: string[] = [];

  const analysis = await fetchWheelAnalysis(
    { symbol, dte, granularity: "daily" },
    opts.signal,
  );
  const suggestions = (opts.side === "call" ? analysis.call : analysis.put) ?? [];
  if (suggestions.length === 0) {
    throw new Error(`No ${opts.side} strike suggestions for ${symbol}`);
  }

  if (IS_MOCK) {
    const rows = withSpotPct(
      buildRowsFromSuggestions(suggestions, [], {}, true),
      analysis.currentPrice,
    );
    warnings.push("Mock mode: premiums are Black-Scholes estimates; orders are simulated.");
    return {
      symbol,
      side: opts.side,
      expiration,
      dte,
      spot: analysis.currentPrice,
      contracts: contractsQty,
      rows,
      warnings,
    };
  }

  let contracts: AlpacaOptionContract[] = [];
  try {
    contracts = await fetchContracts(symbol, expiration, opts.side, opts.signal);
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "Failed to load option contracts from Alpaca",
    );
  }

  if (contracts.length === 0) {
    warnings.push(`No listed ${opts.side}s for ${symbol} expiring ${expiration}.`);
    const rows = withSpotPct(
      buildRowsFromSuggestions(suggestions, [], {}, true),
      analysis.currentPrice,
    );
    return {
      symbol,
      side: opts.side,
      expiration,
      dte,
      spot: analysis.currentPrice,
      contracts: contractsQty,
      rows,
      warnings,
    };
  }

  const picked = LEVEL_ORDER.map((level) => {
    const sug = suggestions.find((s) => s.level === level);
    return sug ? nearestContract(contracts, sug.strike) : null;
  }).filter((c): c is AlpacaOptionContract => c != null);

  let snapshots: Record<string, AlpacaOptionSnapshot> = {};
  try {
    snapshots = await fetchSnapshots(picked.map((c) => c.symbol));
  } catch (e) {
    warnings.push(
      e instanceof Error
        ? `Option quotes unavailable: ${e.message}`
        : "Option quotes unavailable",
    );
  }

  const rows = withSpotPct(
    buildRowsFromSuggestions(suggestions, contracts, snapshots, false),
    analysis.currentPrice,
  );

  return {
    symbol,
    side: opts.side,
    expiration,
    dte,
    spot: analysis.currentPrice,
    contracts: contractsQty,
    rows,
    warnings,
  };
}
