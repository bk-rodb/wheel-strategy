import type { WheelAnalysis } from "../types";

export function mockWheelAnalysis(overrides: Partial<WheelAnalysis> = {}): WheelAnalysis {
  return {
    symbol: "NVDA",
    currentPrice: 100,
    asOf: "2026-06-20T00:00:00Z",
    lookbackDays: 730,
    dte: 35,
    horizonPeriods: 5,
    granularity: "weekly",
    sampleCount: 99,
    realizedVolAnnual: 0.45,
    riskFreeRate: 0.05,
    atr: { atr7Pct: 0.025, atr14Pct: 0.028, atr21Pct: 0.030 },
    hmmRegime: {
      currentRegime: "neutral",
      bearProb: 0.2,
      bullProb: 0.25,
      expectedReturnPctAtDte: 1.2,
    },
    put: [],
    call: [],
    warnings: [],
    ...overrides,
  };
}
