import { describe, expect, it } from "vitest";
import { sumOptionPremiumCollected, type BalanceActivity } from "./fetchAccountActivities";

function fill(
  id: string,
  symbol: string,
  amount: number,
  side: "buy" | "sell",
  qty: number,
  timestamp: string,
): BalanceActivity {
  return {
    id,
    timestamp,
    activityType: "FILL",
    label: `${side} ${symbol}`,
    symbol,
    amount,
    side,
    qty,
  };
}

describe("sumOptionPremiumCollected", () => {
  it("counts sell-to-open premium", () => {
    const activities = [
      fill("1", "NVDA260220P00180000", 285, "sell", 1, "2026-01-01T12:00:00Z"),
    ];
    expect(sumOptionPremiumCollected(activities)).toBe(285);
  });

  it("excludes sell-to-close of a long option", () => {
    const activities = [
      fill("1", "NVDA260220P00180000", -200, "buy", 1, "2026-01-01T12:00:00Z"),
      fill("2", "NVDA260220P00180000", 150, "sell", 1, "2026-01-02T12:00:00Z"),
    ];
    expect(sumOptionPremiumCollected(activities)).toBe(0);
  });

  it("counts only the sell-to-open portion of a mixed fill", () => {
    const activities = [
      fill("1", "NVDA260220P00180000", -200, "buy", 1, "2026-01-01T12:00:00Z"),
      fill("2", "NVDA260220P00180000", 300, "sell", 2, "2026-01-02T12:00:00Z"),
    ];
    expect(sumOptionPremiumCollected(activities)).toBe(150);
  });
});
