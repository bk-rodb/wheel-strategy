import type {
  AnalysisGranularity,
  AnalysisLevel,
  BrokerAccount,
  BrokerType,
  DataSource,
  WheelPhase,
} from "./types";
import { vars } from "./theme";

// Colors below are theme references (`var(--wd-…)`); the values live in src/theme/themes/*.ts.

export const GAIN_COLOR = vars.status.gain;
export const LOSS_COLOR = vars.status.loss;

/** Green for ≥ 0, red for < 0 — P&L, day change, returns. */
export const signColor = (n: number): string => (n >= 0 ? GAIN_COLOR : LOSS_COLOR);

export const LEVEL_COLOR: Record<AnalysisLevel, string> = vars.level;

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
  "cash-secured-put": { label: "CSP", color: vars.phase.csp, step: 0 },
  "stock-holding": { label: "STOCK", color: vars.phase.stock, step: 1 },
  "covered-call": { label: "CC", color: vars.phase.cc, step: 2 },
};

export const SOURCE_BADGE: Record<DataSource, string> = vars.source;

export const BROKER_COLOR: Record<BrokerType, string> = {
  "alpaca-paper": vars.broker.alpacaPaper,
  "alpaca-live": vars.broker.alpacaLive,
  "etrade": vars.broker.etrade,
};

export const BROKER_ACCOUNTS: BrokerAccount[] = [
  { id: "alpaca-paper", label: "Alpaca Paper", sublabel: "Paper trading", available: true },
  { id: "alpaca-live",  label: "Alpaca Live",  sublabel: "Live trading",  available: false },
  { id: "etrade",       label: "E*TRADE",      sublabel: "OAuth required", available: false },
];
