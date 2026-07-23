import { watchlistStore } from "./watchlistStore";

const KEY = "wheel-watchlist";

function seedLegacy(entries: unknown[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

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

  it("creates default watchlist named watchlist", () => {
    const active = watchlistStore.getActiveWatchlist();
    expect(active.name).toBe("watchlist");
  });

  it("appends SPCX without removing existing entries", () => {
    seedLegacy([
      { symbol: "NVDA", addedAt: "2026-01-01T00:00:00.000Z", displayOrder: 0 },
    ]);

    const entries = watchlistStore.getAll();
    expect(entries.map((e) => e.symbol)).toEqual(["NVDA", "SPCX"]);
  });

  it("does not duplicate SPCX when already present", () => {
    seedLegacy([
      { symbol: "SPCX", addedAt: "2026-01-01T00:00:00.000Z", notes: "SpaceX", displayOrder: 0 },
    ]);

    const entries = watchlistStore.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].symbol).toBe("SPCX");
  });

  it("migrates legacy flat array into default watchlist", () => {
    seedLegacy([
      { symbol: "AAPL", addedAt: "2026-01-01T00:00:00.000Z", displayOrder: 0 },
    ]);

    const watchlists = watchlistStore.getWatchlists();
    expect(watchlists).toHaveLength(1);
    expect(watchlists[0].name).toBe("watchlist");
    expect(watchlists[0].entries.map((e) => e.symbol)).toEqual(["AAPL", "SPCX"]);
  });

  it("creates additional watchlists and switches active", () => {
    const result = watchlistStore.create("Tech");
    expect(result.ok).toBe(true);

    expect(watchlistStore.getActiveWatchlist().name).toBe("Tech");
    expect(watchlistStore.getWatchlists()).toHaveLength(2);
    expect(watchlistStore.getAll()).toEqual([]);
  });

  it("rejects duplicate watchlist names case-insensitively", () => {
    watchlistStore.create("Tech");
    const dup = watchlistStore.create("tech");
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBe("duplicate");
    expect(watchlistStore.getWatchlists()).toHaveLength(2);
  });

  it("keeps entries isolated per watchlist", () => {
    watchlistStore.add("NVDA");
    watchlistStore.create("Growth");
    watchlistStore.add("TSLA");

    expect(watchlistStore.getAll().map((e) => e.symbol)).toEqual(["TSLA"]);

    const defaultWl = watchlistStore.getWatchlists().find((w) => w.name === "watchlist");
    expect(defaultWl?.entries.map((e) => e.symbol)).toEqual(["NVDA", "SPCX"]);
  });
});
