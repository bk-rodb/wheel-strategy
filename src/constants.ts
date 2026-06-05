import type { WheelPhase, DataSource, BrokerType, BrokerAccount } from "./types";

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
