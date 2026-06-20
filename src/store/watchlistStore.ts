import { DEFAULT_WATCHLIST } from "../data/defaultWatchlist";

export interface WatchlistEntry {
  symbol: string;
  addedAt: string;   // ISO timestamp
  notes?: string;
  displayOrder: number;
}

const KEY = "wheel-watchlist";

function load(): WatchlistEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as WatchlistEntry[];
  } catch {
    return [];
  }
}

function save(entries: WatchlistEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function ensureDefaults(entries: WatchlistEntry[]): WatchlistEntry[] {
  let updated = entries;
  for (const { symbol, notes } of DEFAULT_WATCHLIST) {
    const sym = symbol.toUpperCase();
    if (updated.some((e) => e.symbol === sym)) continue;
    updated = [
      ...updated,
      {
        symbol: sym,
        addedAt: new Date().toISOString(),
        notes,
        displayOrder: updated.length,
      },
    ];
  }
  if (updated !== entries) save(updated);
  return updated;
}

export const watchlistStore = {
  getAll(): WatchlistEntry[] {
    return ensureDefaults(load()).sort((a, b) => a.displayOrder - b.displayOrder);
  },

  add(symbol: string, notes?: string): WatchlistEntry[] {
    const entries = load();
    if (entries.some((e) => e.symbol === symbol.toUpperCase())) return entries;
    const next: WatchlistEntry = {
      symbol: symbol.toUpperCase(),
      addedAt: new Date().toISOString(),
      notes,
      displayOrder: entries.length,
    };
    const updated = [...entries, next];
    save(updated);
    return updated;
  },

  remove(symbol: string): WatchlistEntry[] {
    const updated = load()
      .filter((e) => e.symbol !== symbol.toUpperCase())
      .map((e, i) => ({ ...e, displayOrder: i }));
    save(updated);
    return updated;
  },

  updateNotes(symbol: string, notes: string): WatchlistEntry[] {
    const updated = load().map((e) =>
      e.symbol === symbol.toUpperCase() ? { ...e, notes } : e,
    );
    save(updated);
    return updated;
  },

  reorder(symbols: string[]): WatchlistEntry[] {
    const map = Object.fromEntries(load().map((e) => [e.symbol, e]));
    const updated = symbols
      .filter((s) => map[s])
      .map((s, i) => ({ ...map[s], displayOrder: i }));
    save(updated);
    return updated;
  },
};
