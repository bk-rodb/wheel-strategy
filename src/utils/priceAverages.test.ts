import { describe, expect, it } from "vitest";
import { averageClosingPrice, formatAveragePricePair } from "./priceAverages";

const history = Array.from({ length: 21 }, (_, i) => ({
  date: `2026-01-${String(i + 1).padStart(2, "0")}`,
  price: 100 + i,
}));

describe("priceAverages", () => {
  it("averages the last N trading days", () => {
    // last 5 bars: prices 116–120 → avg 118
    expect(averageClosingPrice(history, 5)).toBe(118);
    expect(averageClosingPrice(history, 21)).toBe(110);
  });

  it("formats 1W/1M pair", () => {
    expect(formatAveragePricePair(history)).toBe("118.00/110.00");
    expect(formatAveragePricePair([])).toBe("—");
  });

  it("returns null when fewer bars than the requested window", () => {
    const short = history.slice(0, 6);
    expect(averageClosingPrice(short, 21)).toBeNull();
    expect(formatAveragePricePair(short)).toBe("103.00/—");
  });
});
