import type { components } from "./api/generated/analysis";

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

// `level`/`granularity` are lowercase string literals on the wire; the backend DTO
// types them as plain strings, so we narrow them here for the UI. `granularity` is also
// a request parameter, so it stays hand-authored.
export type AnalysisLevel = "safe" | "regular" | "risky";
export type AnalysisGranularity = "weekly" | "daily";

// The analysis contract is the single source of truth in the backend
// (Contracts/WheelAnalysisDtos.cs) and is generated into src/api/generated/analysis.ts
// via `npm run gen:api`. Re-exported here under stable names, narrowing `level`.
export type StrikeSuggestion = Omit<components["schemas"]["StrikeSuggestion"], "level"> & {
  level: AnalysisLevel;
};

export type WheelAnalysis = Omit<
  components["schemas"]["WheelAnalysisResult"],
  "put" | "call"
> & {
  put: StrikeSuggestion[] | null;
  call: StrikeSuggestion[] | null;
};

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
