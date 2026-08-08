import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

import {
  __mockTradeOutcomes,
  attachDecisionSnapshot,
  fetchRetrospective,
  fetchTradeOutcomes,
} from "./fetchTradeOutcomes";

describe("fetchTradeOutcomes (mock)", () => {
  beforeEach(() => {
    __mockTradeOutcomes.clear();
  });

  it("attachDecisionSnapshot stores immutable mock row", async () => {
    const row = await attachDecisionSnapshot("cid-1", {
      underlying: "NVDA",
      optionRight: "put",
      wheelSide: "csp",
      level: "regular",
      contractSymbol: "NVDA250801P00150000",
    });
    expect(row?.clientOrderId).toBe("cid-1");
    expect(row?.outcomeLabel).toBe("pending");

    const list = await fetchTradeOutcomes({});
    expect(list).toHaveLength(1);
    expect(list[0].underlying).toBe("NVDA");
  });

  it("fetchRetrospective summarizes mock ledger", async () => {
    await attachDecisionSnapshot("cid-2", {
      underlying: "AAPL",
      optionRight: "put",
      wheelSide: "csp",
    });
    const summary = await fetchRetrospective();
    expect(summary.totalOutcomes).toBe(1);
    expect(summary.learningSampleSize).toBe(0);
  });
});
