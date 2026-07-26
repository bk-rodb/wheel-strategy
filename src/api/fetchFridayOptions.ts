import { IS_MOCK } from "../config";
import type { AnalysisLevel, StrikeSuggestion } from "../types";
import {
  buildExpirationPickerList,
  mockListedExpirations,
} from "../utils/optionExpirations";
import { dteUntil, nextFriday, toDateString } from "../utils/nextFriday";
import { buildOsiSymbol, roundOptionLimit } from "./optionOrders";
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
  tradable: boolean;
  multiplier: number;
  contractSize: number;
  rootSymbol: string;
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
  /** When live quotes were last fetched (ISO). */
  quotedAt: string | null;
}

const LEVEL_LABEL: Record<AnalysisLevel, "LOW" | "MED" | "HIGH"> = {
  safe: "LOW",
  regular: "MED",
  risky: "HIGH",
};

const LEVEL_ORDER: AnalysisLevel[] = ["safe", "regular", "risky"];

/** Standard deliverable only — filters adjusted/special contracts. */
function isStandardContract(c: AlpacaOptionContract, symbol: string): boolean {
  return (
    c.root_symbol.toUpperCase() === symbol.toUpperCase() &&
    c.multiplier === "100" &&
    (c.size === "100" || c.size === undefined || c.size === "")
  );
}

function contractMultiplier(c: AlpacaOptionContract | null): number {
  if (!c) return 100;
  const m = parseInt(c.multiplier, 10);
  return Number.isFinite(m) && m > 0 ? m : 100;
}

function contractSize(c: AlpacaOptionContract | null): number {
  if (!c) return 100;
  const s = parseInt(c.size, 10);
  return Number.isFinite(s) && s > 0 ? s : contractMultiplier(c);
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

  const sellLimit = roundOptionLimit(mid ?? bid ?? fallback, "sell");
  return { bid, ask, mid, sellLimit };
}

function roundPrice(n: number): number {
  return roundOptionLimit(n, "sell");
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
    all.push(...(res.option_contracts ?? []).filter((c) => isStandardContract(c, symbol)));
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

export interface ContractSnapshotQuote {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  quotedAt: string | null;
}

/** Live bid/ask/mid for a single option contract (close/roll tickets). */
export async function fetchContractSnapshot(
  contractSymbol: string,
): Promise<ContractSnapshotQuote> {
  if (IS_MOCK) {
    return { bid: null, ask: null, mid: null, quotedAt: null };
  }
  const snapshots = await fetchSnapshots([contractSymbol]);
  const snap = snapshots[contractSymbol];
  const bid = snap?.latestQuote?.bp ?? null;
  const ask = snap?.latestQuote?.ap ?? null;
  const trade = snap?.latestTrade?.p ?? null;
  let mid: number | null = null;
  if (bid != null && ask != null && bid > 0 && ask > 0) mid = (bid + ask) / 2;
  else if (trade != null && trade > 0) mid = trade;
  const quotedAt = snap?.latestQuote?.t ?? snap?.latestTrade?.t ?? null;
  return { bid, ask, mid, quotedAt };
}

function buildRowsFromSuggestions(
  suggestions: StrikeSuggestion[],
  contracts: AlpacaOptionContract[],
  snapshots: Record<string, AlpacaOptionSnapshot>,
  mockPrices: boolean,
  symbol: string,
  expiration: string,
  optionType: OptionSide,
  /** When rows are synthesized without a listed contract (mock mode only). */
  simulateTradable: boolean,
): FridayOptionRow[] {
  const rows: FridayOptionRow[] = [];
  for (const level of LEVEL_ORDER) {
    const sug = suggestions.find((s) => s.level === level);
    if (!sug || sug.estPremium == null) continue;
    const contract = nearestContract(contracts, sug.strike);
    if (!contract && !mockPrices) continue;

    const strike = contract ? parseFloat(contract.strike_price) : sug.strike;
    const contractSymbol =
      contract?.symbol ??
      buildOsiSymbol(symbol, expiration, optionType, strike);
    const tradable = contract != null ? contract.tradable : simulateTradable;
    const multiplier = contractMultiplier(contract);
    const contractSizeVal = contractSize(contract);
    const rootSymbol = contract?.root_symbol ?? symbol.toUpperCase();
    const snap = snapshots[contractSymbol];
    const prices = mockPrices
      ? {
          bid: roundPrice(sug.estPremium * 0.95),
          ask: roundPrice(sug.estPremium * 1.05),
          mid: roundPrice(sug.estPremium),
          sellLimit: roundPrice(sug.estPremium),
        }
      : midFromSnapshot(snap, sug.estPremium);

    if (contract && Math.abs(strike - sug.strike) / sug.strike > 0.02) {
      // Strike snapped >2% from suggestion — assignment probs are approximate.
    }

    rows.push({
      level,
      label: LEVEL_LABEL[level],
      strike,
      pctFromSpot: sug.pctFromSpot ?? 0,
      empiricalAssignmentProb: sug.empiricalAssignmentProb ?? 0,
      blackScholesAssignmentProb: sug.blackScholesAssignmentProb ?? 0,
      estPremium: sug.estPremium,
      bid: prices.bid,
      ask: prices.ask,
      mid: prices.mid,
      sellLimit: prices.sellLimit,
      contractSymbol,
      tradable,
      multiplier,
      contractSize: contractSizeVal,
      rootSymbol,
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

function latestQuoteTime(snapshots: Record<string, AlpacaOptionSnapshot>): string | null {
  let latest: string | null = null;
  for (const snap of Object.values(snapshots)) {
    const t = snap.latestQuote?.t ?? snap.latestTrade?.t ?? null;
    if (t && (!latest || t > latest)) latest = t;
  }
  return latest;
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
      buildRowsFromSuggestions(
        suggestions,
        [],
        {},
        true,
        symbol,
        expiration,
        opts.side,
        true,
      ),
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
      quotedAt: null,
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
      buildRowsFromSuggestions(
        suggestions,
        [],
        {},
        true,
        symbol,
        expiration,
        opts.side,
        false,
      ),
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
      quotedAt: null,
    };
  }

  const picked = [
    ...new Map(
      LEVEL_ORDER.map((level) => {
        const sug = suggestions.find((s) => s.level === level);
        return sug ? nearestContract(contracts, sug.strike) : null;
      })
        .filter((c): c is AlpacaOptionContract => c != null)
        .map((c) => [c.symbol, c] as const),
    ).values(),
  ];

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
    buildRowsFromSuggestions(
      suggestions,
      contracts,
      snapshots,
      false,
      symbol,
      expiration,
      opts.side,
      false,
    ),
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
    quotedAt: latestQuoteTime(snapshots),
  };
}
