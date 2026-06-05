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
