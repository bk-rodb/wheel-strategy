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
