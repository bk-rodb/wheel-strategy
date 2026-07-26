/**
 * Alpaca trade_updates stream — currently inert; order state comes from polling.
 *
 * Alpaca authenticates this websocket with an in-band frame carrying the API key
 * and secret, so a browser-side socket meant shipping the secret in the bundle.
 * With credentials moved behind the backend proxy the browser has nothing to
 * authenticate with, and this becomes a no-op: `usePendingOptionOrder` already
 * treats the stream as additive and polls `GET /v2/orders/{id}` every
 * `ORDER_STATUS_POLL_MS` (5s) while an order is working, which is what actually
 * drives the phase machine.
 *
 * The follow-up is a server-side relay — WheelStrategy.Api holds the Alpaca
 * socket and fans updates out over SSE — restoring push latency with no
 * credential in the client. The surface below is deliberately unchanged so that
 * lands as one implementation swap rather than a change to every caller.
 */

export type TradeUpdateHandler = (payload: {
  event: string;
  order: {
    id: string;
    client_order_id?: string;
    symbol: string;
    status: string;
    filled_qty?: string;
    qty?: string;
    side?: string;
    limit_price?: string | null;
  };
}) => void;

export class TradeUpdatesStream {
  private handlers = new Set<TradeUpdateHandler>();
  private trackedOrderIds = new Set<string>();
  private trackedClientIds = new Set<string>();

  subscribe(handler: TradeUpdateHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  track(orderId: string | null, clientOrderId?: string | null) {
    if (orderId) this.trackedOrderIds.add(orderId);
    if (clientOrderId) this.trackedClientIds.add(clientOrderId);
  }

  untrack(orderId: string | null, clientOrderId?: string | null) {
    if (orderId) this.trackedOrderIds.delete(orderId);
    if (clientOrderId) this.trackedClientIds.delete(clientOrderId);
  }

  /** Always false without a relay — callers must not treat push as available. */
  get connected(): boolean {
    return false;
  }

  close() {
    this.trackedOrderIds.clear();
    this.trackedClientIds.clear();
  }
}

/** Shared singleton — one stream per page. */
export const tradeUpdatesStream = new TradeUpdatesStream();
