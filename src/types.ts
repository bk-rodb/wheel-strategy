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

export type AnalysisLevel = "safe" | "regular" | "risky";
export type AnalysisGranularity = "weekly" | "daily";

export interface StrikeSuggestion {
  level: AnalysisLevel;
  strike: number;
  pctFromSpot: number;
  empiricalAssignmentProb: number;
  blackScholesAssignmentProb: number;
  estPremium: number;
  annualizedYield: number;
}

export interface WheelAnalysis {
  symbol: string;
  currentPrice: number;
  asOf: string;
  lookbackDays: number;
  dte: number;
  horizonPeriods: number;
  granularity: string;
  sampleCount: number;
  realizedVolAnnual: number;
  riskFreeRate: number;
  put: StrikeSuggestion[] | null;
  call: StrikeSuggestion[] | null;
  warnings: string[];
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
