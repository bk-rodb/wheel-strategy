/**
 * Append-only order blotter (localStorage). Mirrors watchlistStore pattern.
 * Tracks state transitions and last-known order per client_order_id for
 * reload/orphan reconciliation across browser sessions.
 */

export type DeskOrderState =
  | "idle"
  | "validating"
  | "confirming"
  | "submitting"
  | "orphan_check"
  | "ack_pending"
  | "working"
  | "cancel_requested"
  | "cancel_pending"
  | "filled"
  | "canceled"
  | "rejected"
  | "error";

export interface BlotterTransition {
  ts: string;
  clientOrderId: string;
  orderId: string | null;
  symbol: string;
  underlying: string;
  fromState: DeskOrderState;
  toState: DeskOrderState;
  status: string | null;
  detail?: string;
}

export interface BlotterOrder {
  clientOrderId: string;
  orderId: string | null;
  underlying: string;
  symbol: string;
  side: string;
  qty: string;
  limitPrice: string | null;
  status: string | null;
  deskState: DeskOrderState;
  updatedAt: string;
}

const KEY = "wheel-order-blotter";
const MAX_TRANSITIONS = 500;
const BLOT_EVENT = "wheel-order-blotter";

interface BlotterStore {
  transitions: BlotterTransition[];
  /** Last-known order keyed by client_order_id */
  orders: Record<string, BlotterOrder>;
}

function load(): BlotterStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<BlotterStore>;
    return {
      transitions: Array.isArray(raw.transitions) ? raw.transitions : [],
      orders: raw.orders && typeof raw.orders === "object" ? raw.orders : {},
    };
  } catch {
    return { transitions: [], orders: {} };
  }
}

function save(store: BlotterStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(BLOT_EVENT));
}

export const orderBlotter = {
  append(t: Omit<BlotterTransition, "ts"> & { ts?: string }): BlotterTransition {
    const store = load();
    const entry: BlotterTransition = { ...t, ts: t.ts ?? new Date().toISOString() };
    store.transitions = [...store.transitions, entry].slice(-MAX_TRANSITIONS);

    const prev = store.orders[t.clientOrderId];
    store.orders[t.clientOrderId] = {
      clientOrderId: t.clientOrderId,
      orderId: t.orderId ?? prev?.orderId ?? null,
      underlying: t.underlying,
      symbol: t.symbol || prev?.symbol || "",
      side: prev?.side ?? "",
      qty: prev?.qty ?? "",
      limitPrice: prev?.limitPrice ?? null,
      status: t.status,
      deskState: t.toState,
      updatedAt: entry.ts,
    };
    save(store);
    return entry;
  },

  upsertOrder(partial: Partial<BlotterOrder> & { clientOrderId: string }): BlotterOrder {
    const store = load();
    const prev = store.orders[partial.clientOrderId];
    const next: BlotterOrder = {
      clientOrderId: partial.clientOrderId,
      orderId: partial.orderId ?? prev?.orderId ?? null,
      underlying: partial.underlying ?? prev?.underlying ?? "",
      symbol: partial.symbol ?? prev?.symbol ?? "",
      side: partial.side ?? prev?.side ?? "",
      qty: partial.qty ?? prev?.qty ?? "",
      limitPrice: partial.limitPrice !== undefined ? partial.limitPrice : (prev?.limitPrice ?? null),
      status: partial.status ?? prev?.status ?? null,
      deskState: partial.deskState ?? prev?.deskState ?? "idle",
      updatedAt: new Date().toISOString(),
    };
    store.orders[partial.clientOrderId] = next;
    save(store);
    return next;
  },

  getOrder(clientOrderId: string): BlotterOrder | null {
    return load().orders[clientOrderId] ?? null;
  },

  /** Most recent non-terminal blotter order for an underlying. */
  getOpenForUnderlying(underlying: string): BlotterOrder | null {
    const u = underlying.toUpperCase();
    const entries = this.listOpen().filter((o) => o.underlying === u);
    return entries[0] ?? null;
  },

  /** All non-terminal desk orders, newest first. */
  listOpen(): BlotterOrder[] {
    const openStates = new Set<DeskOrderState>([
      "submitting",
      "orphan_check",
      "ack_pending",
      "working",
      "cancel_requested",
      "cancel_pending",
    ]);
    return Object.values(load().orders)
      .filter((o) => openStates.has(o.deskState))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  transitions(clientOrderId?: string): BlotterTransition[] {
    const all = load().transitions;
    if (!clientOrderId) return all;
    return all.filter((t) => t.clientOrderId === clientOrderId);
  },

  /** Notify listeners after blotter mutations (same-tab + cross-tab via storage). */
  subscribe(onChange: () => void): () => void {
    const handler = () => onChange();
    window.addEventListener(BLOT_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(BLOT_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  },

  clear() {
    save({ transitions: [], orders: {} });
  },
};
