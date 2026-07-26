import { IS_MOCK } from "../config";
import { AlpacaHttpError, trading } from "./alpacaClient";
import type { AlpacaOrder, AlpacaOrderRequest, AlpacaOrderStatus } from "./alpacaTypes";

export interface PlaceOptionOrderParams {
  contractSymbol: string;
  qty: number;
  /** Limit price; omit for market. */
  limitPrice?: number;
  side?: "buy" | "sell";
  /** Alpaca position intent for option closes. */
  positionIntent?: "buy_to_close" | "sell_to_close" | "buy_to_open" | "sell_to_open";
  /** Caller-supplied idempotency key; generated if omitted. */
  clientOrderId?: string;
}

/** Still live at the venue — blocks placing another order; cancelable until filled. */
const OPEN_STATUSES = new Set<string>([
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

/** Cancel confirmed (or otherwise dead without a full fill) — unlock SELL/BUY. */
const CANCELED_STATUSES = new Set<string>(["canceled", "expired", "rejected", "replaced"]);

/**
 * Alpaca has taken the order (acceptance ≠ fill).
 * `accepted` / `new` = working; only `filled` means fully done.
 */
const ACCEPTED_STATUSES = new Set<string>([
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

/** Fully done — no further cancel. Partial fills stay cancelable. */
export function isOrderFilled(
  order: Pick<AlpacaOrder, "status" | "filled_qty" | "qty">,
): boolean;
export function isOrderFilled(status: AlpacaOrderStatus): boolean;
export function isOrderFilled(
  orderOrStatus: Pick<AlpacaOrder, "status" | "filled_qty" | "qty"> | AlpacaOrderStatus,
): boolean {
  if (typeof orderOrStatus === "string") {
    return orderOrStatus === "filled";
  }
  const o = orderOrStatus;
  if (o.status === "filled") return true;
  if (o.status === "done_for_day") {
    return Number(o.filled_qty ?? 0) >= Number(o.qty);
  }
  return false;
}

/** Unfilled end-of-day — unlocks the underlying without treating as a fill. */
export function isOrderDoneUnfilled(
  order: Pick<AlpacaOrder, "status" | "filled_qty">,
): boolean {
  return order.status === "done_for_day" && Number(order.filled_qty ?? 0) === 0;
}

/** Cancel allowed until the order is fully filled (or already pending_cancel / terminal). */
export function isOrderCancelable(status: AlpacaOrderStatus): boolean {
  if (status === "filled" || isOrderCanceled(status)) return false;
  if (status === "done_for_day") return false;
  if (status === "pending_cancel") return false;
  return isOrderOpen(status) || status === "pending_new";
}

export function newClientOrderId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wheel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Round to a valid option tick ($0.01 below $3, $0.05 at or above), away from own side. */
export function roundOptionLimit(price: number, side: "buy" | "sell"): number {
  if (price < 3) {
    const cents = price * 100;
    const roundedCents =
      side === "sell" ? Math.ceil(cents - 1e-9) : Math.floor(cents + 1e-9);
    return Math.max(1, roundedCents) / 100;
  }
  const nickels = price / 0.05;
  const roundedNickels =
    side === "sell" ? Math.ceil(nickels - 1e-9) : Math.floor(nickels + 1e-9);
  return Math.round(Math.max(0.05, roundedNickels * 0.05) * 100) / 100;
}

export function formatOptionLimitPrice(price: number, side: "buy" | "sell" = "sell"): string {
  return roundOptionLimit(price, side).toFixed(2);
}

// ─── Mock store (session) so place → poll → cancel works without Alpaca ───

const mockOrders = new Map<string, AlpacaOrder>();
const mockByClientId = new Map<string, string>();

function mockOrder(
  partial: Partial<AlpacaOrder> &
    Pick<AlpacaOrder, "symbol" | "qty" | "side" | "type" | "status">,
): AlpacaOrder {
  const id = partial.id ?? `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clientId = partial.client_order_id ?? `mock-client-${id}`;
  const order: AlpacaOrder = {
    id,
    client_order_id: clientId,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    symbol: partial.symbol,
    asset_class: "us_option",
    qty: partial.qty,
    filled_qty: partial.filled_qty ?? "0",
    side: partial.side,
    type: partial.type,
    status: partial.status,
    limit_price: partial.limit_price ?? null,
  };
  mockOrders.set(id, order);
  mockByClientId.set(clientId, id);
  return order;
}

/** @internal — test helpers */
export const __mockOrders = {
  clear() {
    mockOrders.clear();
    mockByClientId.clear();
  },
  get(id: string) {
    return mockOrders.get(id);
  },
  all() {
    return [...mockOrders.values()];
  },
};

/**
 * Sell-to-open / buy-to-close an option via Alpaca Orders API.
 * Always sends a `client_order_id` for idempotent reconciliation.
 */
export async function placeOptionOrder(params: PlaceOptionOrderParams): Promise<AlpacaOrder> {
  const qty = Math.max(1, Math.floor(params.qty));
  const side = params.side ?? "sell";
  const clientOrderId = params.clientOrderId ?? newClientOrderId();

  if (IS_MOCK) {
    const existingId = mockByClientId.get(clientOrderId);
    if (existingId) {
      const existing = mockOrders.get(existingId);
      if (existing) return { ...existing };
    }
    return mockOrder({
      symbol: params.contractSymbol,
      qty: String(qty),
      side,
      type: params.limitPrice != null ? "limit" : "market",
      status: "pending_new",
      limit_price: params.limitPrice != null ? params.limitPrice.toFixed(2) : null,
      client_order_id: clientOrderId,
    });
  }

  const body: AlpacaOrderRequest & { client_order_id: string } = {
    symbol: params.contractSymbol,
    qty: String(qty),
    side,
    type: params.limitPrice != null ? "limit" : "market",
    time_in_force: "day",
    client_order_id: clientOrderId,
  };
  if (params.positionIntent) {
    body.position_intent = params.positionIntent;
  }
  if (params.limitPrice != null) {
    body.limit_price = formatOptionLimitPrice(params.limitPrice, side);
  }

  return trading.post<AlpacaOrder>("/v2/orders", body);
}

/** @deprecated Prefer placeOptionOrder */
export async function placeOptionSellOrder(params: PlaceOptionOrderParams): Promise<AlpacaOrder> {
  return placeOptionOrder({ ...params, side: "sell" });
}

export async function getOrder(orderId: string): Promise<AlpacaOrder> {
  if (IS_MOCK) {
    const existing = mockOrders.get(orderId);
    if (!existing) throw new Error(`Mock order ${orderId} not found`);
    if (existing.status === "pending_new") {
      existing.status = "accepted";
      existing.updated_at = new Date().toISOString();
    } else if (existing.status === "pending_cancel") {
      existing.status = "canceled";
      existing.canceled_at = new Date().toISOString();
      existing.updated_at = new Date().toISOString();
    }
    return { ...existing };
  }
  return trading.get<AlpacaOrder>(`/v2/orders/${orderId}`);
}

export async function getOrderByClientId(clientOrderId: string): Promise<AlpacaOrder | null> {
  if (IS_MOCK) {
    const id = mockByClientId.get(clientOrderId);
    if (!id) return null;
    const existing = mockOrders.get(id);
    return existing ? { ...existing } : null;
  }
  try {
    return await trading.get<AlpacaOrder>(
      `/v2/orders:by_client_order_id/${encodeURIComponent(clientOrderId)}`,
    );
  } catch (e) {
    if (e instanceof AlpacaHttpError && (e.status === 404 || e.status === 422)) return null;
    throw e;
  }
}

/**
 * After a failed/timed-out POST, check whether the order landed under our
 * client_order_id before allowing a retry.
 */
export async function reconcileSubmission(clientOrderId: string): Promise<AlpacaOrder | null> {
  return getOrderByClientId(clientOrderId);
}

/** Request cancel. Alpaca returns 204; status becomes canceled only after venue confirms. */
export async function cancelOrder(orderId: string): Promise<void> {
  if (IS_MOCK) {
    const existing = mockOrders.get(orderId);
    if (!existing) throw new Error(`Mock order ${orderId} not found`);
    if (!isOrderCancelable(existing.status) && existing.status !== "pending_cancel") {
      throw new Error(`Order not cancelable (status=${existing.status})`);
    }
    existing.status = "pending_cancel";
    existing.updated_at = new Date().toISOString();
    return;
  }
  await trading.delete(`/v2/orders/${orderId}`);
}

/**
 * Poll until the order is accepted by Alpaca/venue, or reaches a terminal failure.
 */
export async function waitForOrderAcceptance(
  orderId: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<AlpacaOrder> {
  const intervalMs = opts.intervalMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const start = Date.now();

    while (Date.now() - start < timeoutMs) {
    if (opts.signal?.aborted) throw new Error("Acceptance check aborted");
    const order = await getOrder(orderId);
    if (isOrderAccepted(order.status) || isOrderCanceled(order.status) || isOrderDoneUnfilled(order))
      return order;
    await sleep(intervalMs, opts.signal);
  }

  return getOrder(orderId);
}

/**
 * Poll until cancel is confirmed (`canceled` / expired / rejected) or the order fills.
 */
export async function waitForOrderCanceled(
  orderId: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<AlpacaOrder> {
  const intervalMs = opts.intervalMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (opts.signal?.aborted) throw new Error("Cancel wait aborted");
    const order = await getOrder(orderId);
    if (isOrderCanceled(order.status) || isOrderFilled(order) || isOrderDoneUnfilled(order))
      return order;
    await sleep(intervalMs, opts.signal);
  }

  return getOrder(orderId);
}

/** Open option orders whose OSI symbol belongs to `underlying` (e.g. SPCX). */
export async function listOpenOptionOrdersForUnderlying(underlying: string): Promise<AlpacaOrder[]> {
  const u = underlying.toUpperCase();
  if (IS_MOCK) {
    return [...mockOrders.values()].filter(
      (o) => isOrderOpen(o.status) && optionUnderlying(o.symbol) === u,
    );
  }

  const orders = await trading.get<AlpacaOrder[]>("/v2/orders", {
    status: "open",
    nested: "true",
    direction: "desc",
    limit: "50",
  });
  return (orders ?? []).filter(
    (o) =>
      (o.asset_class === "us_option" || looksLikeOptionSymbol(o.symbol)) &&
      optionUnderlying(o.symbol) === u &&
      isOrderOpen(o.status),
  );
}

function looksLikeOptionSymbol(symbol: string): boolean {
  return /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(symbol.replace(/\s/g, "")) || symbol.length >= 15;
}

/** Best-effort underlying from OSI (`AAPL  250117C00150000` or compacted). */
export function optionUnderlying(osi: string): string {
  const compact = osi.replace(/\s/g, "");
  if (compact.length >= 15) {
    return compact.slice(0, compact.length - 15).toUpperCase();
  }
  return osi.trim().split(/\s+/)[0]?.toUpperCase() ?? osi.toUpperCase();
}

/** Parse padded or compact OSI into legs (Alpaca positions use both forms). */
export function parseOsiSymbol(
  osi: string,
): { underlying: string; expiration: string; type: "call" | "put"; strike: number } | null {
  const compact = osi.replace(/\s/g, "").toUpperCase();
  const m = compact.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!m) return null;

  const [, underlying, dateStr, optType, strikeRaw] = m;
  const year = parseInt(dateStr.slice(0, 2), 10) + 2000;
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiration = `${year}-${month}-${day}`;
  const strike = parseInt(strikeRaw, 10) / 1000;
  const type = optType === "C" ? "call" : "put";

  return { underlying, expiration, type, strike };
}

/** Build a 21-char OSI symbol from legs (underlying padded to 6). */
export function buildOsiSymbol(
  underlying: string,
  expiration: string, // YYYY-MM-DD
  type: "call" | "put",
  strike: number,
): string {
  const root = underlying.toUpperCase().padEnd(6, " ").slice(0, 6);
  const [y, m, d] = expiration.split("-");
  const yymmdd = `${y.slice(2)}${m}${d}`;
  const cp = type === "call" ? "C" : "P";
  const strikePart = Math.round(strike * 1000)
    .toString()
    .padStart(8, "0");
  return `${root}${yymmdd}${cp}${strikePart}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}
