import { resolveStockQuote } from "./resolveStockQuote";
import type { AlpacaSnapshot } from "./alpacaTypes";

const snap: Pick<AlpacaSnapshot, "prevDailyBar" | "dailyBar" | "latestTrade"> = {
  prevDailyBar: { c: 100, h: 101, l: 99, v: 1_000, t: "2026-01-01" },
  dailyBar: { c: 105, h: 106, l: 104, v: 2_000, t: "2026-01-02" },
  latestTrade: { p: 104.93, s: 100, t: "2026-01-02T15:00:00Z" },
};

describe("resolveStockQuote", () => {
  it("prefers 5-min bar close when market is open", () => {
    const quote = resolveStockQuote(snap, 115.07, true);
    expect(quote).toMatchObject({
      closePrice: 100,
      lastPrice: 115.07,
      source: "5min",
    });
    expect(quote?.change).toBeCloseTo(15.07, 5);
    expect(quote?.changePct).toBeCloseTo(15.07, 5);
  });

  it("uses daily bar close when market is closed", () => {
    const quote = resolveStockQuote(snap, undefined, false);
    expect(quote).toEqual({
      closePrice: 100,
      lastPrice: 105,
      change: 5,
      changePct: 5,
      source: "close",
    });
  });

  it("falls back to latest trade when daily bar is missing after hours", () => {
    const quote = resolveStockQuote(
      { ...snap, dailyBar: undefined as unknown as AlpacaSnapshot["dailyBar"] },
      undefined,
      false,
    );
    expect(quote?.lastPrice).toBe(104.93);
    expect(quote?.source).toBe("close");
  });

  it("returns null when prev close is unavailable", () => {
    expect(
      resolveStockQuote(
        { ...snap, prevDailyBar: undefined as unknown as AlpacaSnapshot["prevDailyBar"] },
        115.07,
        true,
      ),
    ).toBeNull();
  });
});
