import type {
  AnalysisGranularity,
  AnalysisLevel,
  BrokerAccount,
  BrokerType,
  DataSource,
  WheelPhase,
} from "./types";

export const GAIN_COLOR = "#34d399";
export const LOSS_COLOR = "#f87171";

/** Green for ≥ 0, red for < 0 — P&L, day change, returns. */
export const signColor = (n: number): string => (n >= 0 ? GAIN_COLOR : LOSS_COLOR);

export const LEVEL_COLOR: Record<AnalysisLevel, string> = {
  safe: GAIN_COLOR,
  regular: "#d8d8f0",
  risky: LOSS_COLOR,
};

export const GRANULARITY_CHOICES: { value: AnalysisGranularity; label: string; title: string }[] = [
  {
    value: "weekly",
    label: "WEEKLY",
    title: "Fewer, wider-spaced samples; default and faster to interpret.",
  },
  {
    value: "daily",
    label: "DAILY",
    title: "~5× more overlapping forward-return samples; empirical percentiles are sharper, but overlapping windows still widen confidence.",
  },
];

export const PHASE_CONFIG: Record<
  WheelPhase,
  { label: string; color: string; step: number }
> = {
  "cash-secured-put": { label: "CSP", color: "#f59e0b", step: 0 },
  "stock-holding": { label: "STOCK", color: "#60a5fa", step: 1 },
  "covered-call": { label: "CC", color: "#34d399", step: 2 },
};

export const SOURCE_BADGE: Record<DataSource, string> = {
  etrade: "#ef4444",
  alpaca: "#8b5cf6",
  polygon: "#3b82f6",
  yfinance: "#10b981",
};

export const BROKER_COLOR: Record<BrokerType, string> = {
  "alpaca-paper": "#8b5cf6",
  "alpaca-live": "#34d399",
  "etrade": "#3b82f6",
};

export const BROKER_ACCOUNTS: BrokerAccount[] = [
  { id: "alpaca-paper", label: "Alpaca Paper", sublabel: "Paper trading", available: true },
  { id: "alpaca-live",  label: "Alpaca Live",  sublabel: "Live trading",  available: false },
  { id: "etrade",       label: "E*TRADE",      sublabel: "OAuth required", available: false },
];
