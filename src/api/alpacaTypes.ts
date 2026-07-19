export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  equity: string;
  last_equity: string;
  cash: string;
  buying_power: string;
  long_market_value: string;
  short_market_value: string;
  portfolio_value: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  asset_class: "us_equity" | "us_option" | "crypto";
  exchange: string;
  qty: string;
  qty_available: string;
  avg_entry_price: string;
  side: "long" | "short";
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface AlpacaBar {
  t: string; // timestamp ISO
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface AlpacaBarsResponse {
  bars: Record<string, AlpacaBar[]>;
  next_page_token: string | null;
}

export interface AlpacaSnapshot {
  latestTrade: { p: number; s: number; t: string };
  latestQuote: { ap: number; bp: number; as: number; bs: number; t: string };
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
}

export interface AlpacaSnapshotsResponse {
  [symbol: string]: AlpacaSnapshot;
}

export interface AlpacaOptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expiration_date: string;
  root_symbol: string;
  underlying_symbol: string;
  type: "call" | "put";
  style: string;
  strike_price: string;
  multiplier: string;
  size: string;
  open_interest?: string;
  close_price?: string;
}

export interface AlpacaOptionContractsResponse {
  option_contracts: AlpacaOptionContract[];
  next_page_token: string | null;
}

export interface AlpacaOptionQuote {
  ap?: number;
  as?: number;
  bp?: number;
  bs?: number;
  t?: string;
}

export interface AlpacaOptionTrade {
  p?: number;
  s?: number;
  t?: string;
}

export interface AlpacaOptionSnapshot {
  latestQuote?: AlpacaOptionQuote;
  latestTrade?: AlpacaOptionTrade;
  impliedVolatility?: number;
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number };
}

export interface AlpacaOptionSnapshotsResponse {
  snapshots: Record<string, AlpacaOptionSnapshot>;
  next_page_token?: string | null;
}

export interface AlpacaOrderRequest {
  symbol: string;
  qty: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  time_in_force: "day" | "gtc";
  limit_price?: string;
  client_order_id?: string;
}

export type AlpacaOrderStatus =
  | "new"
  | "partially_filled"
  | "filled"
  | "done_for_day"
  | "canceled"
  | "expired"
  | "replaced"
  | "pending_cancel"
  | "pending_replace"
  | "accepted"
  | "pending_new"
  | "accepted_for_bidding"
  | "stopped"
  | "rejected"
  | "suspended"
  | "calculated"
  | "held"
  | string;

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  filled_at?: string | null;
  canceled_at?: string | null;
  expired_at?: string | null;
  failed_at?: string | null;
  symbol: string;
  asset_class?: string;
  qty: string;
  filled_qty?: string;
  side: string;
  type: string;
  order_type?: string;
  time_in_force?: string;
  status: AlpacaOrderStatus;
  limit_price: string | null;
}
