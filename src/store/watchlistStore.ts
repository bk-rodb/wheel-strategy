import { DEFAULT_WATCHLIST } from "../data/defaultWatchlist";
import {
  TARGET_WATCHLIST,
  TARGET_WATCHLIST_NAME,
} from "../data/targetWatchlist";

export interface WatchlistEntry {
  symbol: string;
  addedAt: string;   // ISO timestamp
  notes?: string;
  displayOrder: number;
}

export interface Watchlist {
  id: string;
  name: string;
  entries: WatchlistEntry[];
}

interface WatchlistsState {
  version: 2;
  activeId: string;
  watchlists: Watchlist[];
}

const KEY = "wheel-watchlist";
const WATCHLIST_EVENT = "wheel-watchlist";
const DEFAULT_NAME = "watchlist";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function isValidEntry(e: unknown): e is WatchlistEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.symbol === "string" &&
    o.symbol.length > 0 &&
    typeof o.addedAt === "string" &&
    typeof o.displayOrder === "number" &&
    Number.isFinite(o.displayOrder) &&
    (o.notes === undefined || typeof o.notes === "string")
  );
}

function isValidWatchlist(w: unknown): w is Watchlist {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.name === "string" &&
    Array.isArray(o.entries) &&
    o.entries.every(isValidEntry)
  );
}

function isValidWatchlistsState(raw: unknown): raw is WatchlistsState {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) return false;
  if (!Array.isArray(o.watchlists) || o.watchlists.length === 0) return false;
  if (!o.watchlists.every(isValidWatchlist)) return false;
  if (typeof o.activeId !== "string" || o.activeId.length === 0) return false;
  return o.watchlists.some((w) => w.id === o.activeId);
}

function loadRaw(): unknown {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function freshState(entries: WatchlistEntry[] = []): WatchlistsState {
  const defaultId = newId();
  return {
    version: 2,
    activeId: defaultId,
    watchlists: [{ id: defaultId, name: DEFAULT_NAME, entries }],
  };
}

function migrate(raw: unknown): WatchlistsState {
  if (isValidWatchlistsState(raw)) {
    return raw;
  }

  const legacyEntries = Array.isArray(raw)
    ? (raw as unknown[]).filter(isValidEntry)
    : [];
  return freshState(legacyEntries);
}

function save(state: WatchlistsState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
    return true;
  } catch {
    return false;
  }
}

function load(): WatchlistsState {
  return migrate(loadRaw());
}

function findById(state: WatchlistsState, id: string): Watchlist | undefined {
  return state.watchlists.find((w) => w.id === id);
}

function findByName(state: WatchlistsState, name: string): Watchlist | undefined {
  const lower = name.trim().toLowerCase();
  return state.watchlists.find((w) => w.name.toLowerCase() === lower);
}

function getDefaultWatchlist(state: WatchlistsState): Watchlist {
  return (
    state.watchlists.find((w) => w.name.toLowerCase() === DEFAULT_NAME) ??
    state.watchlists[0]
  );
}

function ensureNamedWatchlist(
  state: WatchlistsState,
  name: string,
  seeds: { symbol: string; notes?: string }[],
  mode: "merge" | "sync" = "merge",
): { state: WatchlistsState; changed: boolean } {
  let watchlists = state.watchlists;
  let existing = findByName({ ...state, watchlists }, name);
  let created = false;
  if (!existing) {
    existing = { id: newId(), name, entries: [] };
    watchlists = [...watchlists, existing];
    created = true;
  }
  const seeded =
    mode === "sync"
      ? syncToSeeds(existing.entries, seeds)
      : ensureDefaultsFor(existing.entries, seeds);
  if (!created && seeded === existing.entries) {
    return { state: { ...state, watchlists }, changed: false };
  }
  watchlists = watchlists.map((w) =>
    w.id === existing!.id ? { ...w, entries: seeded } : w,
  );
  return { state: { ...state, watchlists }, changed: true };
}

function syncToSeeds(
  entries: WatchlistEntry[],
  seeds: { symbol: string; notes?: string }[],
): WatchlistEntry[] {
  const bySymbol = Object.fromEntries(entries.map((e) => [e.symbol, e]));
  const next = seeds.map(({ symbol, notes }, displayOrder) => {
    const sym = symbol.toUpperCase();
    const prev = bySymbol[sym];
    if (prev && prev.notes === notes) return { ...prev, displayOrder };
    if (prev) return { ...prev, notes, displayOrder };
    return {
      symbol: sym,
      addedAt: new Date().toISOString(),
      notes,
      displayOrder,
    };
  });
  const unchanged =
    next.length === entries.length &&
    next.every(
      (e, i) =>
        e.symbol === entries[i]?.symbol &&
        e.notes === entries[i]?.notes &&
        e.displayOrder === entries[i]?.displayOrder,
    );
  return unchanged ? entries : next;
}

function ensureDefaultsFor(
  entries: WatchlistEntry[],
  seeds: { symbol: string; notes?: string }[],
): WatchlistEntry[] {
  let updated = entries;
  for (const { symbol, notes } of seeds) {
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
  return updated;
}

function withDefaultSeeds(state: WatchlistsState): { state: WatchlistsState; changed: boolean } {
  const defaultWl = getDefaultWatchlist(state);
  const seededDefault = ensureDefaultsFor(defaultWl.entries, DEFAULT_WATCHLIST);
  const defaultChanged = seededDefault !== defaultWl.entries;

  let next = state;
  if (defaultChanged) {
    next = {
      ...next,
      watchlists: next.watchlists.map((w) =>
        w.id === defaultWl.id ? { ...w, entries: seededDefault } : w,
      ),
    };
  }

  const { state: withTarget, changed: targetChanged } = ensureNamedWatchlist(
    next,
    TARGET_WATCHLIST_NAME,
    TARGET_WATCHLIST,
    "merge",
  );

  return { state: withTarget, changed: defaultChanged || targetChanged };
}

let seedPersistScheduled = false;

function scheduleSeedPersist(state: WatchlistsState) {
  if (seedPersistScheduled) return;
  seedPersistScheduled = true;
  queueMicrotask(() => {
    seedPersistScheduled = false;
    save(state);
  });
}

function loadSeeded(): WatchlistsState {
  return withDefaultSeeds(load()).state;
}

function activeWatchlist(state: WatchlistsState): Watchlist {
  return findById(state, state.activeId) ?? state.watchlists[0];
}

function updateActiveEntries(
  state: WatchlistsState,
  entries: WatchlistEntry[],
): WatchlistsState {
  const watchlists = state.watchlists.map((w) =>
    w.id === state.activeId ? { ...w, entries } : w,
  );
  const next = { ...state, watchlists };
  save(next);
  return next;
}

export type CreateWatchlistResult =
  | { ok: true; watchlist: Watchlist }
  | { ok: false; error: "duplicate" | "empty" };

export const watchlistStore = {
  getState(): WatchlistsState {
    const { state, changed } = withDefaultSeeds(load());
    if (changed) scheduleSeedPersist(state);
    return state;
  },

  getWatchlists(): Watchlist[] {
    return this.getState().watchlists;
  },

  getActiveWatchlist(): Watchlist {
    return activeWatchlist(this.getState());
  },

  getAll(): WatchlistEntry[] {
    return activeWatchlist(this.getState())
      .entries
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  setActive(id: string): WatchlistsState {
    const state = loadSeeded();
    if (!findById(state, id)) return state;
    const next = { ...state, activeId: id };
    save(next);
    return next;
  },

  create(name: string): CreateWatchlistResult {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "empty" };

    const state = loadSeeded();
    if (findByName(state, trimmed)) return { ok: false, error: "duplicate" };

    const watchlist: Watchlist = { id: newId(), name: trimmed, entries: [] };
    const next: WatchlistsState = {
      ...state,
      activeId: watchlist.id,
      watchlists: [...state.watchlists, watchlist],
    };
    save(next);
    return { ok: true, watchlist };
  },

  isNameTaken(name: string, excludeId?: string): boolean {
    const lower = name.trim().toLowerCase();
    if (!lower) return false;
    return this.getState().watchlists.some(
      (w) => w.name.toLowerCase() === lower && w.id !== excludeId,
    );
  },

  add(symbol: string, notes?: string): WatchlistEntry[] {
    const state = loadSeeded();
    const active = activeWatchlist(state);
    if (active.entries.some((e) => e.symbol === symbol.toUpperCase())) {
      return active.entries;
    }
    const next: WatchlistEntry = {
      symbol: symbol.toUpperCase(),
      addedAt: new Date().toISOString(),
      notes,
      displayOrder: active.entries.length,
    };
    return updateActiveEntries(state, [...active.entries, next]).watchlists.find(
      (w) => w.id === state.activeId,
    )!.entries;
  },

  remove(symbol: string): WatchlistEntry[] {
    const state = loadSeeded();
    const active = activeWatchlist(state);
    const updated = active.entries
      .filter((e) => e.symbol !== symbol.toUpperCase())
      .map((e, i) => ({ ...e, displayOrder: i }));
    return updateActiveEntries(state, updated).watchlists.find(
      (w) => w.id === state.activeId,
    )!.entries;
  },

  updateNotes(symbol: string, notes: string): WatchlistEntry[] {
    const state = loadSeeded();
    const active = activeWatchlist(state);
    const updated = active.entries.map((e) =>
      e.symbol === symbol.toUpperCase() ? { ...e, notes } : e,
    );
    return updateActiveEntries(state, updated).watchlists.find(
      (w) => w.id === state.activeId,
    )!.entries;
  },

  reorder(symbols: string[]): WatchlistEntry[] {
    const state = loadSeeded();
    const active = activeWatchlist(state);
    const map = Object.fromEntries(active.entries.map((e) => [e.symbol, e]));
    const updated = symbols
      .filter((s) => map[s])
      .map((s, i) => ({ ...map[s], displayOrder: i }));
    return updateActiveEntries(state, updated).watchlists.find(
      (w) => w.id === state.activeId,
    )!.entries;
  },

  /** Notify listeners after watchlist mutations (same-tab + cross-tab via storage). */
  subscribe(onChange: () => void): () => void {
    const handler = () => onChange();
    window.addEventListener(WATCHLIST_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  },
};
