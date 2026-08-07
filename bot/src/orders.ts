import { isRegularSession, marketCloseEt, sleep, toDateString } from "./calendar.js";
import { BotHttpError, trading } from "./http.js";
import { roundOptionLimit } from "./fridayLadder.js";

export type AlpacaOrderStatus = string;

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at?: string;
  updated_at?: string;
  canceled_at?: string | null;
  symbol: string;
  asset_class?: string;
  qty: string;
  filled_qty?: string;
  side: string;
  type: string;
  status: AlpacaOrderStatus;
  limit_price?: string | null;
}

const OPEN_STATUSES = new Set([
  "new",
  "accepted",
  "pending_new",
  "accepted_for_bidding",
  "partially_filled",
  "pending_cancel",
  "pending_replace",
  "held",
  "stopped",
  "suspended",
  "calculated",
]);

const CANCELED_STATUSES = new Set(["canceled", "expired", "rejected", "replaced"]);

const ACCEPTED_STATUSES = new Set([
  "new",
  "accepted",
  "partially_filled",
  "filled",
  "done_for_day",
  "pending_cancel",
  "pending_replace",
]);

export function isOrderOpen(status: AlpacaOrderStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function isOrderCanceled(status: AlpacaOrderStatus): boolean {
  return CANCELED_STATUSES.has(status);
}

export function isOrderAccepted(status: AlpacaOrderStatus): boolean {
  return ACCEPTED_STATUSES.has(status);
}

export function isOrderFilled(
  order: Pick<AlpacaOrder, "status" | "filled_qty" | "qty">,
): boolean {
  if (order.status === "filled") return true;
  if (order.status === "done_for_day") {
    return Number(order.filled_qty ?? 0) >= Number(order.qty);
  }
  return false;
}

export function isOrderDoneUnfilled(
  order: Pick<AlpacaOrder, "status" | "filled_qty">,
): boolean {
  return order.status === "done_for_day" && Number(order.filled_qty ?? 0) === 0;
}

export function isOrderCancelable(status: AlpacaOrderStatus): boolean {
  if (status === "filled" || isOrderCanceled(status)) return false;
  if (status === "done_for_day") return false;
  if (status === "pending_cancel") return false;
  return isOrderOpen(status) || status === "pending_new";
}

export function optionUnderlying(osi: string): string {
  const compact = osi.replace(/\s/g, "");
  if (compact.length >= 15) {
    return compact.slice(0, compact.length - 15).toUpperCase();
  }
  return osi.trim().split(/\s+/)[0]?.toUpperCase() ?? osi.toUpperCase();
}

function looksLikeOptionSymbol(symbol: string): boolean {
  return (
    /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(symbol.replace(/\s/g, "")) ||
    symbol.length >= 15
  );
}

export async function listOpenOptionOrdersForUnderlying(
  underlying: string,
  signal?: AbortSignal,
): Promise<AlpacaOrder[]> {
  const u = underlying.toUpperCase();
  const orders = await trading.get<AlpacaOrder[]>(
    "/v2/orders",
    {
      status: "open",
      nested: "true",
      direction: "desc",
      limit: "50",
    },
    signal,
  );
  return (orders ?? []).filter(
    (o) =>
      (o.asset_class === "us_option" || looksLikeOptionSymbol(o.symbol)) &&
      optionUnderlying(o.symbol) === u &&
      isOrderOpen(o.status),
  );
}

export async function placeSellToOpen(opts: {
  contractSymbol: string;
  qty: number;
  limitPrice: number;
  clientOrderId: string;
  signal?: AbortSignal;
}): Promise<AlpacaOrder> {
  const body = {
    symbol: opts.contractSymbol,
    qty: String(Math.max(1, Math.floor(opts.qty))),
    side: "sell",
    type: "limit",
    time_in_force: "day",
    client_order_id: opts.clientOrderId,
    limit_price: roundOptionLimit(opts.limitPrice, "sell").toFixed(2),
    position_intent: "sell_to_open",
  };
  return trading.post<AlpacaOrder>("/v2/orders", body, opts.signal);
}

export async function getOrder(orderId: string, signal?: AbortSignal): Promise<AlpacaOrder> {
  return trading.get<AlpacaOrder>(`/v2/orders/${orderId}`, undefined, signal);
}

export async function getOrderByClientId(
  clientOrderId: string,
  signal?: AbortSignal,
): Promise<AlpacaOrder | null> {
  try {
    return await trading.get<AlpacaOrder>(
      `/v2/orders:by_client_order_id/${encodeURIComponent(clientOrderId)}`,
      undefined,
      signal,
    );
  } catch (e) {
    if (e instanceof BotHttpError && (e.status === 404 || e.status === 422)) return null;
    throw e;
  }
}

export async function cancelOrder(orderId: string, signal?: AbortSignal): Promise<void> {
  await trading.delete(`/v2/orders/${orderId}`, signal);
}

/**
 * Poll until filled / canceled / done_for_day, or cancel at ET session close.
 */
export async function pollUntilDone(opts: {
  orderId: string;
  pollMs: number;
  signal?: AbortSignal;
  onTick?: (order: AlpacaOrder) => void;
}): Promise<AlpacaOrder> {
  while (true) {
    if (opts.signal?.aborted) throw new Error("poll aborted");
    const order = await getOrder(opts.orderId, opts.signal);
    opts.onTick?.(order);

    if (
      isOrderFilled(order) ||
      isOrderCanceled(order.status) ||
      isOrderDoneUnfilled(order)
    ) {
      return order;
    }

    const today = toDateString(new Date());
    const close = marketCloseEt(today);
    if (Date.now() >= close.getTime() - 30_000 && isOrderCancelable(order.status)) {
      console.log(`[orders] Session ending — canceling ${order.id}`);
      try {
        await cancelOrder(order.id, opts.signal);
      } catch (e) {
        console.warn(`[orders] Cancel failed:`, e);
      }
      // brief wait for venue confirm
      await sleep(2_000, opts.signal);
      return getOrder(opts.orderId, opts.signal);
    }

    if (!isRegularSession() && isOrderCancelable(order.status)) {
      // Off-hours with a still-open day order — cancel and stop.
      console.log(`[orders] Market closed — canceling ${order.id}`);
      try {
        await cancelOrder(order.id, opts.signal);
      } catch (e) {
        console.warn(`[orders] Cancel failed:`, e);
      }
      await sleep(2_000, opts.signal);
      return getOrder(opts.orderId, opts.signal);
    }

    await sleep(opts.pollMs, opts.signal);
  }
}

/** Stable idempotency key for a weekly cycle. */
export function cycleClientOrderId(
  symbol: string,
  expiration: string,
  side: string,
  runDate: string,
): string {
  // Alpaca client_order_id max ~48 chars
  const exp = expiration.replace(/-/g, "");
  const day = runDate.replace(/-/g, "");
  return `bot-${symbol.toLowerCase()}-${exp}-${side[0]}-${day}`.slice(0, 48);
}
