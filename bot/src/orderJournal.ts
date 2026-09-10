import { sleep } from "./calendar.js";
import { analysisGet } from "./http.js";

export interface OrderJournalEntry {
  clientOrderId: string;
  alpacaOrderId: string | null;
  underlying: string;
  symbol: string;
  side: string;
  qty: string;
  filledQty: string;
  limitPrice: string | null;
  deskState: string;
  brokerStatus: string | null;
  source: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  terminalAt: string | null;
}

interface OrderJournalListResponse {
  entries: OrderJournalEntry[];
}

const OPEN_DESK_STATES = new Set([
  "submitting",
  "orphan_check",
  "ack_pending",
  "working",
  "cancel_requested",
  "cancel_pending",
]);

export function isJournalOpen(entry: OrderJournalEntry): boolean {
  return OPEN_DESK_STATES.has(entry.deskState);
}

/** Open durable intents for an underlying (server journal). */
export async function listOpenJournalForUnderlying(
  underlying: string,
  signal?: AbortSignal,
): Promise<OrderJournalEntry[]> {
  const body = await analysisGet<OrderJournalListResponse>(
    "/api/orders/journal",
    {
      underlying: underlying.toUpperCase(),
      openOnly: "true",
      limit: "10",
    },
    signal,
  );
  return (body.entries ?? []).filter(isJournalOpen);
}

/**
 * Poll until no open journal entry remains for `underlying`, or the timeout elapses.
 *
 * A canceled Alpaca order doesn't immediately clear the desk journal — it lingers in
 * `cancel_pending` until the backend reconciles the cancellation — and the Alpaca proxy rejects
 * any new order for an underlying while an open journal entry exists (409 "Order already open for
 * underlying"), regardless of `client_order_id`. Callers that cancel-then-resubmit (e.g. a reprice
 * loop) must wait for this to clear first.
 */
export async function waitForJournalClear(
  underlying: string,
  opts?: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const pollMs = opts?.pollMs ?? 1_500;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const open = await listOpenJournalForUnderlying(underlying, opts?.signal);
    if (open.length === 0) return true;
    if (Date.now() >= deadline) return false;
    await sleep(pollMs, opts?.signal);
  }
}
