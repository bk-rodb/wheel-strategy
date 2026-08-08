import { API_BASE } from "../config";
import { DEFAULT_TIMEOUT_MS } from "./alpacaClient";
import type { DeskOrderState } from "../store/orderBlotter";

export interface OrderJournalEntry {
  clientOrderId: string;
  alpacaOrderId: string | null;
  underlying: string;
  symbol: string;
  side: string;
  qty: string;
  filledQty: string;
  limitPrice: string | null;
  deskState: DeskOrderState | string;
  brokerStatus: string | null;
  source: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  terminalAt: string | null;
}

export interface OrderJournalListResponse {
  entries: OrderJournalEntry[];
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

/** Open (or recent) durable intents from the analysis API journal. */
export async function fetchOrderJournal(opts: {
  underlying?: string;
  openOnly?: boolean;
  limit?: number;
  signal?: AbortSignal;
}): Promise<OrderJournalEntry[]> {
  const url = new URL(`${API_BASE}/api/orders/journal`);
  if (opts.underlying) url.searchParams.set("underlying", opts.underlying);
  url.searchParams.set("openOnly", String(opts.openOnly ?? true));
  if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));

  const res = await fetch(url.toString(), { signal: requestSignal(opts.signal) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Order journal → ${res.status}: ${text}`);
  }
  const body = (await res.json()) as OrderJournalListResponse;
  return body.entries ?? [];
}

export async function reconcileOrderJournal(
  clientOrderId: string,
  signal?: AbortSignal,
): Promise<OrderJournalEntry> {
  const url = `${API_BASE}/api/orders/journal/${encodeURIComponent(clientOrderId)}/reconcile`;
  const res = await fetch(url, { method: "POST", signal: requestSignal(signal) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Order journal reconcile → ${res.status}: ${text}`);
  }
  return (await res.json()) as OrderJournalEntry;
}
