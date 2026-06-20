import { watchlistStore } from "./watchlistStore";

const KEY = "wheel-watchlist";

describe("watchlistStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("seeds SPCX on first getAll when watchlist is empty", () => {
    const entries = watchlistStore.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].symbol).toBe("SPCX");
    expect(entries[0].notes).toBe("SpaceX");
  });

  it("appends SPCX without removing existing entries", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { symbol: "NVDA", addedAt: "2026-01-01T00:00:00.000Z", displayOrder: 0 },
      ]),
    );

    const entries = watchlistStore.getAll();
    expect(entries.map((e) => e.symbol)).toEqual(["NVDA", "SPCX"]);
  });

  it("does not duplicate SPCX when already present", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { symbol: "SPCX", addedAt: "2026-01-01T00:00:00.000Z", notes: "SpaceX", displayOrder: 0 },
      ]),
    );

    const entries = watchlistStore.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].symbol).toBe("SPCX");
  });
});
