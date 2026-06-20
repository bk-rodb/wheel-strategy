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
    put: [],
    call: [],
    warnings: [],
    ...overrides,
  };
}
