import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dte, fmt } from "./formatters";

describe("fmt", () => {
  it("formats percentages that are already scaled", () => {
    expect(fmt.pct(2.5)).toBe("+2.50%");
    expect(fmt.pct(-1.25)).toBe("-1.25%");
  });

  it("formats 0–1 ratios via pctFromRatio", () => {
    expect(fmt.pctFromRatio(0.62)).toBe("+62.00%");
    expect(fmt.pctFromRatio(0.715)).toBe("+71.50%");
  });

  it("guards non-finite values", () => {
    expect(fmt.currency(NaN)).toBe("—");
    expect(fmt.pct(Infinity)).toBe("—");
    expect(fmt.pctFromRatio(NaN)).toBe("—");
    expect(fmt.num(Number.NaN)).toBe("—");
  });
});

describe("dte", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses 4 PM local close, not UTC midnight", () => {
    const expiration = "2099-07-24";
    const close = new Date(`${expiration}T16:00:00`).getTime();
    const beforeClose = close - 2 * 60 * 60 * 1000;
    const afterClose = close + 2 * 60 * 60 * 1000;

    vi.setSystemTime(beforeClose);
    expect(dte(expiration)).toBe(1);

    vi.setSystemTime(afterClose);
    expect(dte(expiration)).toBe(0);
  });
});
