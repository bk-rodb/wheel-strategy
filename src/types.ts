export type WheelPhase = "cash-secured-put" | "stock-holding" | "covered-call";
export type DataSource = "etrade" | "alpaca" | "polygon" | "yfinance";
export type BrokerType = "alpaca-paper" | "alpaca-live" | "etrade";

export interface BrokerAccount {
  id: BrokerType;
  label: string;
  sublabel: string;
  available: boolean;
}

export interface AccountInfo {
  broker: BrokerType;
  accountNumber: string;
  equity: number;
  lastEquity: number;
  cash: number;
  buyingPower: number;
  longMarketValue: number;
  dayPnL: number;
  dayPnLPct: number;
}

export interface OptionLeg {
  type: "put" | "call";
  strike: number;
  expiration: string;
  premiumReceived: number;
  contracts: number;
  currentOptionPrice: number;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface WheelPosition {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  phase: WheelPhase;
  shares: number;
  costBasis: number;
  currentPrice: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  priceHistory: PricePoint[];
  activeOption?: OptionLeg;
  premiumCollectedTotal: number;
  cashDeployed: number;
  unrealizedPnL: number;
  dataSource: DataSource;
  lastUpdated: string;
}
