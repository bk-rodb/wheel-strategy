import { trading } from "./http.js";

export interface AlpacaPosition {
  symbol: string;
  asset_class: string;
  qty: string;
  side: string;
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

/** Equity shares held long for `symbol` (0 if flat). */
export async function getEquityShares(
  symbol: string,
  signal?: AbortSignal,
): Promise<number> {
  const positions = await trading.get<AlpacaPosition[]>("/v2/positions", undefined, signal);
  const u = symbol.toUpperCase();
  const pos = (positions ?? []).find(
    (p) => p.symbol.toUpperCase() === u && p.asset_class === "us_equity",
  );
  if (!pos) return 0;
  const qty = parseFloat(pos.qty);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty);
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
