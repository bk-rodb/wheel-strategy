import { trading } from "./http.js";

export interface AlpacaPosition {
  symbol: string;
  asset_class: string;
  qty: string;
  side: string;
  avg_entry_price?: string;
}

export interface AccountSnapshot {
  cash: number;
  buyingPower: number;
  optionsBuyingPower: number;
}

interface AlpacaAccount {
  cash: string;
  buying_power: string;
  options_buying_power?: string;
}

export interface EquityPosition {
  /** Whole shares held long (0 if flat). */
  shares: number;
  /** Per-share cost basis (Alpaca avg_entry_price); null when flat or unreadable. */
  avgEntryPrice: number | null;
}

/** Long equity shares and cost basis for `symbol`. */
export async function getEquityPosition(
  symbol: string,
  signal?: AbortSignal,
): Promise<EquityPosition> {
  const positions = await trading.get<AlpacaPosition[]>("/v2/positions", undefined, signal);
  const u = symbol.toUpperCase();
  const pos = (positions ?? []).find(
    (p) => p.symbol.toUpperCase() === u && p.asset_class === "us_equity",
  );
  if (!pos) return { shares: 0, avgEntryPrice: null };
  const qty = parseFloat(pos.qty);
  if (!Number.isFinite(qty) || qty <= 0) return { shares: 0, avgEntryPrice: null };
  const avg = parseFloat(pos.avg_entry_price ?? "");
  return {
    shares: Math.floor(qty),
    avgEntryPrice: Number.isFinite(avg) && avg > 0 ? avg : null,
  };
}

export async function getAccount(signal?: AbortSignal): Promise<AccountSnapshot> {
  const raw = await trading.get<AlpacaAccount>("/v2/account", undefined, signal);
  return {
    cash: parseFloat(raw.cash),
    buyingPower: parseFloat(raw.buying_power),
    optionsBuyingPower: parseFloat(raw.options_buying_power ?? raw.buying_power),
  };
}

export type OptionSide = "put" | "call";

export function sideAndQty(shares: number): { side: OptionSide; qty: number } {
  if (shares >= 100) {
    return { side: "call", qty: Math.floor(shares / 100) };
  }
  return { side: "put", qty: 1 };
}
