import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

vi.mock("./fetchWheelAnalysis");

import { fetchFridayOptions } from "./fetchFridayOptions";
import { fetchWheelAnalysis } from "./fetchWheelAnalysis";
import { mockWheelAnalysis } from "../test/mockWheelAnalysis";
import { __clearInflightCache } from "./inflightCache";
import type { StrikeSuggestion } from "../types";

const putSuggestions: StrikeSuggestion[] = [
  {
    level: "safe",
    strike: 150,
    pctFromSpot: -0.12,
    targetDelta: 0.2,
    blackScholesDelta: -0.19,
    distanceAtr14: 2.1,
    empiricalAssignmentProb: 0.15,
    blackScholesAssignmentProb: 0.18,
    estPremium: 1.5,
    annualizedYield: 0.12,
  },
  {
    level: "regular",
    strike: 160,
    pctFromSpot: -0.06,
    targetDelta: 0.3,
    blackScholesDelta: -0.29,
    distanceAtr14: 1.4,
    empiricalAssignmentProb: 0.3,
    blackScholesAssignmentProb: 0.32,
    estPremium: 2.1,
    annualizedYield: 0.18,
  },
  {
    level: "risky",
    strike: 165,
    pctFromSpot: -0.03,
    targetDelta: 0.4,
    blackScholesDelta: -0.38,
    distanceAtr14: 0.9,
    empiricalAssignmentProb: 0.45,
    blackScholesAssignmentProb: 0.48,
    estPremium: 2.8,
    annualizedYield: 0.22,
  },
];

describe("fetchFridayOptions (mock)", () => {
  beforeEach(() => {
    __clearInflightCache();
    vi.mocked(fetchWheelAnalysis).mockResolvedValue(
      mockWheelAnalysis({ put: putSuggestions, call: [], currentPrice: 170 }),
    );
  });

  it("builds tradable OSI rows with BS premiums and a mock warning", async () => {
    const bundle = await fetchFridayOptions({
      symbol: "NVDA",
      side: "put",
      shares: 0,
    });

    expect(bundle.symbol).toBe("NVDA");
    expect(bundle.side).toBe("put");
    expect(bundle.rows.length).toBe(3);
    for (const row of bundle.rows) {
      expect(row.tradable).toBe(true);
      expect(row.contractSymbol.length).toBeGreaterThan(10);
      expect(row.sellLimit).toBeGreaterThan(0);
      expect(["safe", "regular", "risky"]).toContain(row.level);
    }
    expect(bundle.warnings.some((w) => /mock/i.test(w))).toBe(true);
  });
});
