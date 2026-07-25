import { describe, expect, it } from "vitest";
import type { AlpacaBar } from "./alpacaTypes";
import { highLowFromDailyBars } from "./fetchWheelPositions";

function bar(overrides: Partial<AlpacaBar> & Pick<AlpacaBar, "c">): AlpacaBar {
  return {
    t: "2026-01-01T00:00:00Z",
    o: overrides.c,
    h: overrides.h ?? overrides.c,
    l: overrides.l ?? overrides.c,
    v: 1,
    ...overrides,
  };
}

describe("highLowFromDailyBars", () => {
  it("returns high/low across all bars since inception", () => {
    const range = highLowFromDailyBars([
      bar({ c: 100, h: 110, l: 95 }),
      bar({ c: 105, h: 120, l: 90 }),
      bar({ c: 102, h: 108, l: 88 }),
    ]);
    expect(range).toEqual({ high: 120, low: 88 });
  });

  it("falls back to close when h/l are missing", () => {
    const range = highLowFromDailyBars([
      bar({ c: 100, h: Number.NaN, l: Number.NaN }),
      bar({ c: 80 }),
    ]);
    expect(range).toEqual({ high: 100, low: 80 });
  });

  it("returns null when no usable bars exist", () => {
    expect(highLowFromDailyBars([])).toBeNull();
    expect(
      highLowFromDailyBars([bar({ c: Number.NaN, h: Number.NaN, l: Number.NaN })]),
    ).toBeNull();
  });
});
