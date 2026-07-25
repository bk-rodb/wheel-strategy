import { describe, expect, it } from "vitest";
import {
  buildTrendSnapshot,
  drawdownFromPeak,
  simpleMovingAverage,
  slopePctPerWeek,
} from "./trendMetrics";
import type { PricePoint } from "../types";

function series(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    price,
  }));
}

describe("trendMetrics", () => {
  it("computes SMA over exact period", () => {
    const data = series([10, 20, 30, 40]);
    expect(simpleMovingAverage(data, 2)).toBe(35);
    expect(simpleMovingAverage(data, 4)).toBe(25);
    expect(simpleMovingAverage(data, 5)).toBeNull();
  });

  it("computes drawdown from peak", () => {
    const data = series([100, 110, 105, 99]);
    expect(drawdownFromPeak(data)).toBeCloseTo(-10, 0);
  });

  it("computes positive weekly slope", () => {
    const data = series(Array.from({ length: 10 }, (_, i) => 100 + i * 2));
    const slope = slopePctPerWeek(data);
    expect(slope).not.toBeNull();
    expect(slope!).toBeGreaterThan(0);
  });

  it("builds chips including cost basis", () => {
    const data = series(Array.from({ length: 30 }, (_, i) => 100 + i * 0.5));
    const snap = buildTrendSnapshot(data, 115, 110);
    expect(snap.chips.length).toBeGreaterThanOrEqual(4);
    expect(snap.chips.some((c) => c.label === "vs basis")).toBe(true);
    expect(snap.chips.some((c) => c.label === "vs SMA20")).toBe(true);
  });
});
