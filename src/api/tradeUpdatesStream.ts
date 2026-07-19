/**
 * Alpaca trade_updates websocket. Additive to polling — if the stream cannot
 * connect, callers silently rely on GET /v2/orders polling.
 *
 * Uses the same browser-exposed API keys as the REST client.
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

type StreamState = "idle" | "connecting" | "open" | "closed";

const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;

function streamUrl(): string | null {
  const base = import.meta.env.VITE_ALPACA_BASE_URL as string | undefined;
  if (!base) return null;
  // paper-api.alpaca.markets → wss://paper-api.alpaca.markets/stream
  // api.alpaca.markets → wss://api.alpaca.markets/stream
  try {
    const u = new URL(base);
    u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
    u.pathname = "/stream";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

export class TradeUpdatesStream {
  private ws: WebSocket | null = null;
  private state: StreamState = "idle";
  private handlers = new Set<TradeUpdateHandler>();
  private trackedOrderIds = new Set<string>();
  private trackedClientIds = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  subscribe(handler: TradeUpdateHandler): () => void {
    this.handlers.add(handler);
    this.ensureConnected();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.close();
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

  get connected(): boolean {
    return this.state === "open";
  }

  private ensureConnected() {
    if (this.state === "connecting" || this.state === "open") return;
    const key = import.meta.env.VITE_ALPACA_API_KEY_ID;
    const url = streamUrl();
    if (!key || !url) return; // mock / misconfigured — polling only

    this.intentionalClose = false;
    this.state = "connecting";
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.state = "closed";
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          action: "authenticate",
          data: {
            key_id: import.meta.env.VITE_ALPACA_API_KEY_ID,
            secret_key: import.meta.env.VITE_ALPACA_API_SECRET_KEY,
          },
        }),
      );
    };

    this.ws.onmessage = (ev) => {
      let msg: { stream?: string; data?: unknown };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      if (msg.stream === "authorization") {
        const data = msg.data as { status?: string };
        if (data?.status === "authorized") {
          this.ws?.send(
            JSON.stringify({ action: "listen", data: { streams: ["trade_updates"] } }),
          );
          this.state = "open";
          this.reconnectAttempt = 0;
        } else {
          this.state = "closed";
          this.ws?.close();
        }
        return;
      }

      if (msg.stream === "listening") return;

      if (msg.stream === "trade_updates") {
        const data = msg.data as {
          event?: string;
          order?: {
            id: string;
            client_order_id?: string;
            symbol: string;
            status: string;
            filled_qty?: string;
            qty?: string;
            side?: string;
            limit_price?: string | null;
          };
        };
        if (!data?.order || !data.event) return;
        const oid = data.order.id;
        const cid = data.order.client_order_id;
        const tracked =
          this.trackedOrderIds.has(oid) ||
          (cid != null && this.trackedClientIds.has(cid)) ||
          (this.trackedOrderIds.size === 0 && this.trackedClientIds.size === 0);
        if (!tracked) return;
        for (const h of this.handlers) {
          h({ event: data.event, order: data.order });
        }
      }
    };

    this.ws.onerror = () => {
      // onclose will schedule reconnect
    };

    this.ws.onclose = () => {
      this.state = "closed";
      this.ws = null;
      if (!this.intentionalClose && this.handlers.size > 0) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  close() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.state = "closed";
  }
}

/** Shared singleton — one socket per page. */
export const tradeUpdatesStream = new TradeUpdatesStream();
