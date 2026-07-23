import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMarketOpen, ORDER_STATUS_POLL_MS } from "./marketHours";

describe("marketHours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports a 5s order poll interval", () => {
    expect(ORDER_STATUS_POLL_MS).toBe(5000);
  });

  it("is open during regular session on a weekday", () => {
    // Wed Jul 22 2026 11:00 AM ET
    vi.setSystemTime(new Date("2026-07-22T15:00:00.000Z"));
    expect(isMarketOpen()).toBe(true);
  });

  it("is closed before the open and after the close", () => {
    vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z")); // 8:00 AM ET
    expect(isMarketOpen()).toBe(false);

    vi.setSystemTime(new Date("2026-07-22T21:00:00.000Z")); // 5:00 PM ET
    expect(isMarketOpen()).toBe(false);
  });

  it("is closed on weekends", () => {
    vi.setSystemTime(new Date("2026-07-25T15:00:00.000Z")); // Sat 11:00 AM ET
    expect(isMarketOpen()).toBe(false);
  });
});
