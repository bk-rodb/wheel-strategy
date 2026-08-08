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
  /** Options-specific buying power for CSP collateral (falls back to buyingPower). */
  optionsBuyingPower: number;
  longMarketValue: number;
  dayPnL: number;
  dayPnLPct: number;
  /** Sum of |cost_basis| across all open positions. */
  costBasis: number;
  /** Sum of unrealized_pl across all open positions. */
  unrealizedPnL: number;
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
export type StrikeSuggestion = Omit<
  components["schemas"]["StrikeSuggestion"],
  | "level"
  | "pctFromSpot"
  | "targetDelta"
  | "blackScholesDelta"
  | "distanceAtr14"
  | "empiricalAssignmentProb"
  | "blackScholesAssignmentProb"
  | "estPremium"
  | "annualizedYield"
> & {
  level: AnalysisLevel;
  pctFromSpot: number | null;
  targetDelta: number | null;
  blackScholesDelta: number | null;
  distanceAtr14: number | null;
  empiricalAssignmentProb: number | null;
  blackScholesAssignmentProb: number | null;
  estPremium: number | null;
  annualizedYield: number | null;
};

export type AtrMetrics = components["schemas"]["AtrMetrics"];
export type HmmRegimeContext = components["schemas"]["HmmRegimeContext"];

export type WheelAnalysis = Omit<
  components["schemas"]["WheelAnalysisResult"],
  "put" | "call" | "realizedVolAnnual"
> & {
  put: StrikeSuggestion[] | null;
  call: StrikeSuggestion[] | null;
  realizedVolAnnual: number | null;
};

export type HmmRegime = "bear" | "neutral" | "bull" | "unknown";

export type HmmTrendResult = Omit<
  components["schemas"]["HmmTrendResult"],
  "currentRegime"
> & {
  currentRegime: HmmRegime;
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
  /** Present when more than one option leg is open on this underlying. */
  optionLegCount?: number;
  premiumCollectedTotal: number;
  cashDeployed: number;
  unrealizedPnL: number;
  dataSource: DataSource;
  lastUpdated: string;
}

export type CatalystEventType =
  | "earnings"
  | "ex_dividend"
  | "split"
  | "macro";

export type CatalystScope = "symbol" | "market";

export type CatalystEvent = Omit<
  components["schemas"]["CatalystEventDto"],
  "type" | "scope" | "timing" | "detail" | "conflictsWithExpiry" | "yieldPct" | "splitRatio"
> & {
  type: CatalystEventType;
  scope: CatalystScope;
  detail?: string | null;
  /** BMO / AMC for earnings. */
  timing?: "bmo" | "amc" | null;
  /** True when earnings falls before the next Friday option expiry. */
  conflictsWithExpiry?: boolean | null;
  yieldPct?: number | null;
  splitRatio?: string | null;
};

export type TickerCatalystsResult = Omit<
  components["schemas"]["TickerCatalystsResult"],
  "events"
> & {
  events: CatalystEvent[];
};

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
}
