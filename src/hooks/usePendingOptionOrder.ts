import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelOrder,
  getOrder,
  isOrderCancelable,
  isOrderCanceled,
  isOrderFilled,
  isOrderOpen,
  listOpenOptionOrdersForUnderlying,
  newClientOrderId,
  placeOptionOrder,
  reconcileSubmission,
  waitForOrderAcceptance,
  waitForOrderCanceled,
  type PlaceOptionOrderParams,
} from "../api/optionOrders";
import { tradeUpdatesStream } from "../api/tradeUpdatesStream";
import type { AlpacaOrder } from "../api/alpacaTypes";
import { orderBlotter, type DeskOrderState } from "../store/orderBlotter";
import { isMarketOpen, ORDER_STATUS_POLL_MS } from "../utils/marketHours";

export type PendingOrderPhase = DeskOrderState;

interface UsePendingOptionOrderOptions {
  underlying: string;
  enabled?: boolean;
}

function toDeskState(status: string): DeskOrderState {
  if (status === "filled" || status === "done_for_day") return "filled";
  if (isOrderCanceled(status)) {
    return status === "rejected" ? "rejected" : "canceled";
  }
  if (status === "pending_cancel") return "cancel_pending";
  if (status === "pending_new") return "ack_pending";
  if (isOrderOpen(status)) return "working";
  return "working";
}

/**
 * Formal desk order state machine: place → ack → working → cancel confirm.
 * Single-flight lock prevents double-submit. Blotter persists transitions.
 * Trade-updates stream applies status immediately; polling is the fallback.
 */
export function usePendingOptionOrder({ underlying, enabled = true }: UsePendingOptionOrderOptions) {
  const [order, setOrder] = useState<AlpacaOrder | null>(null);
  const [phase, setPhase] = useState<PendingOrderPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clientOrderId, setClientOrderId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Synchronous single-flight — blocks double-click before React state settles. */
  const flightRef = useRef(false);
  const orderRef = useRef<AlpacaOrder | null>(null);
  const phaseRef = useRef<PendingOrderPhase>("idle");

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearAbort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const transition = useCallback(
    (
      to: DeskOrderState,
      opts: {
        order?: AlpacaOrder | null;
        clientOrderId?: string | null;
        detail?: string;
        clearOrder?: boolean;
      } = {},
    ) => {
      const from = phaseRef.current;
      const nextOrder = opts.clearOrder ? null : (opts.order !== undefined ? opts.order : orderRef.current);
      const cid =
        opts.clientOrderId ??
        nextOrder?.client_order_id ??
        clientOrderId ??
        "unknown";

      phaseRef.current = to;
      setPhase(to);
      orderRef.current = nextOrder;
      setOrder(nextOrder);
      if (opts.clientOrderId !== undefined) setClientOrderId(opts.clientOrderId);
      else if (nextOrder?.client_order_id) setClientOrderId(nextOrder.client_order_id);

      if (to !== "idle" || from !== "idle") {
        orderBlotter.append({
          clientOrderId: cid,
          orderId: nextOrder?.id ?? null,
          symbol: nextOrder?.symbol ?? "",
          underlying: underlying.toUpperCase(),
          fromState: from,
          toState: to,
          status: nextOrder?.status ?? null,
          detail: opts.detail,
        });
      }

      if (nextOrder) {
        orderBlotter.upsertOrder({
          clientOrderId: nextOrder.client_order_id,
          orderId: nextOrder.id,
          underlying: underlying.toUpperCase(),
          symbol: nextOrder.symbol,
          side: nextOrder.side,
          qty: nextOrder.qty,
          limitPrice: nextOrder.limit_price,
          status: nextOrder.status,
          deskState: to,
        });
        tradeUpdatesStream.track(nextOrder.id, nextOrder.client_order_id);
      }
    },
    [clientOrderId, underlying],
  );

  const applyBrokerOrder = useCallback(
    (next: AlpacaOrder) => {
      const desk = toDeskState(next.status);
      transition(desk, { order: next, detail: `broker status=${next.status}` });
      if (!isOrderOpen(next.status) && next.status !== "pending_new") {
        stopPolling();
      }
      return desk;
    },
    [transition, stopPolling],
  );

  const refreshOrder = useCallback(
    async (orderId: string) => {
      const latest = await getOrder(orderId);
      applyBrokerOrder(latest);
      return latest;
    },
    [applyBrokerOrder],
  );

  const startStatusPoll = useCallback(
    (orderId: string) => {
      stopPolling();

      const tick = () => {
        if (!isMarketOpen()) return;
        void refreshOrder(orderId).catch((e) => {
          setError(e instanceof Error ? e.message : "Order status check failed");
        });
      };

      // Always reconcile once (resume / off-hours included).
      void refreshOrder(orderId).catch((e) => {
        setError(e instanceof Error ? e.message : "Order status check failed");
      });

      pollRef.current = setInterval(tick, ORDER_STATUS_POLL_MS);
    },
    [refreshOrder, stopPolling],
  );

  // Resume open order from blotter / broker on mount.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const blotterOpen = orderBlotter.getOpenForUnderlying(underlying);
        if (blotterOpen?.orderId) {
          try {
            const latest = await getOrder(blotterOpen.orderId);
            if (cancelled) return;
            if (isOrderOpen(latest.status) || latest.status === "pending_new") {
              applyBrokerOrder(latest);
              startStatusPoll(latest.id);
              return;
            }
            // Terminal — clear blotter desk state
            orderBlotter.upsertOrder({
              clientOrderId: blotterOpen.clientOrderId,
              deskState: toDeskState(latest.status),
              status: latest.status,
            });
          } catch {
            // fall through to list open
          }
        }

        if (blotterOpen?.clientOrderId && !blotterOpen.orderId) {
          const found = await reconcileSubmission(blotterOpen.clientOrderId);
          if (cancelled) return;
          if (found && isOrderOpen(found.status)) {
            applyBrokerOrder(found);
            startStatusPoll(found.id);
            return;
          }
        }

        const open = await listOpenOptionOrdersForUnderlying(underlying);
        if (cancelled) return;
        const first = open[0] ?? null;
        if (first) {
          applyBrokerOrder(first);
          startStatusPoll(first.id);
        }
      } catch {
        // Non-fatal
      }
    })();

    const unsub = tradeUpdatesStream.subscribe((payload) => {
      const current = orderRef.current;
      if (!current) return;
      if (
        payload.order.id !== current.id &&
        payload.order.client_order_id !== current.client_order_id
      ) {
        return;
      }
      const merged: AlpacaOrder = {
        ...current,
        status: payload.order.status,
        filled_qty: payload.order.filled_qty ?? current.filled_qty,
        qty: payload.order.qty ?? current.qty,
        limit_price:
          payload.order.limit_price !== undefined
            ? payload.order.limit_price
            : current.limit_price,
      };
      applyBrokerOrder(merged);
      if (isOrderCanceled(merged.status) && phaseRef.current !== "idle") {
        // Keep canceled briefly then unlock via reset path in UI
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
      clearAbort();
      unsub();
      flightRef.current = false;
    };
  }, [underlying, enabled, applyBrokerOrder, startStatusPoll, stopPolling, clearAbort]);

  const locked =
    phase === "submitting" ||
    phase === "orphan_check" ||
    phase === "ack_pending" ||
    phase === "working" ||
    phase === "cancel_requested" ||
    phase === "cancel_pending" ||
    phase === "filled";

  const place = useCallback(
    async (params: Omit<PlaceOptionOrderParams, "clientOrderId"> & { clientOrderId?: string }) => {
      if (flightRef.current) {
        throw new Error("Order in flight — wait for acknowledgement");
      }
      if (orderRef.current && isOrderOpen(orderRef.current.status)) {
        throw new Error("An order is already pending — cancel it before placing another");
      }

      flightRef.current = true;
      clearAbort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setError(null);

      const cid = params.clientOrderId ?? newClientOrderId();
      setClientOrderId(cid);
      transition("submitting", {
        clientOrderId: cid,
        order: null,
        detail: `place ${params.side ?? "sell"} ${params.contractSymbol} x${params.qty}`,
      });

      try {
        let created: AlpacaOrder;
        try {
          created = await placeOptionOrder({ ...params, clientOrderId: cid });
        } catch (postErr) {
          transition("orphan_check", {
            clientOrderId: cid,
            detail: postErr instanceof Error ? postErr.message : "POST failed",
          });
          const orphan = await reconcileSubmission(cid);
          if (orphan) {
            created = orphan;
          } else {
            transition("error", {
              clientOrderId: cid,
              detail: postErr instanceof Error ? postErr.message : "Submit failed — no order landed",
            });
            setError(postErr instanceof Error ? postErr.message : "Failed to place order");
            throw postErr;
          }
        }

        transition("ack_pending", {
          order: created,
          clientOrderId: cid,
          detail: "awaiting venue acceptance",
        });

        const accepted = await waitForOrderAcceptance(created.id, {
          signal: ctrl.signal,
          timeoutMs: 30_000,
        });

        if (isOrderCanceled(accepted.status)) {
          const desk = accepted.status === "rejected" ? "rejected" : "canceled";
          transition(desk, { order: accepted, detail: `terminal ${accepted.status}` });
          setError(`Order ${accepted.status}`);
          return accepted;
        }
        if (isOrderFilled(accepted.status)) {
          transition("filled", { order: accepted });
          return accepted;
        }
        if (!isOrderOpen(accepted.status) && accepted.status !== "pending_new") {
          transition("error", {
            order: accepted,
            detail: `not accepted status=${accepted.status}`,
          });
          setError(`Order not accepted (status=${accepted.status})`);
          return accepted;
        }

        transition("working", { order: accepted, detail: `status=${accepted.status}` });
        startStatusPoll(accepted.id);
        return accepted;
      } catch (e) {
        if (ctrl.signal.aborted) return null;
        if (phaseRef.current !== "error") {
          transition("error", {
            clientOrderId: cid,
            detail: e instanceof Error ? e.message : "Failed to place order",
          });
          setError(e instanceof Error ? e.message : "Failed to place order");
        }
        throw e;
      } finally {
        flightRef.current = false;
      }
    },
    [clearAbort, transition, startStatusPoll],
  );

  const cancel = useCallback(async () => {
    const current = orderRef.current;
    if (!current) return null;
    if (flightRef.current && phaseRef.current === "cancel_requested") return current;

    if (!isOrderCancelable(current.status) && current.status !== "pending_cancel") {
      setError(`Cannot cancel order in status ${current.status}`);
      return current;
    }

    flightRef.current = true;
    clearAbort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    transition("cancel_requested", { order: current, detail: "DELETE requested" });

    try {
      await cancelOrder(current.id);
      transition("cancel_pending", { order: { ...current, status: "pending_cancel" } });
      startStatusPoll(current.id);

      const final = await waitForOrderCanceled(current.id, {
        signal: ctrl.signal,
        timeoutMs: 45_000,
      });

      if (isOrderCanceled(final.status)) {
        stopPolling();
        transition("canceled", { order: final, detail: "cancel confirmed" });
        // Unlock after confirmed cancel
        transition("idle", { clearOrder: true, clientOrderId: final.client_order_id });
        tradeUpdatesStream.untrack(final.id, final.client_order_id);
        return final;
      }

      if (isOrderFilled(final.status)) {
        transition("filled", {
          order: final,
          detail: "filled before cancel confirmed",
        });
        setError("Cancel failed — order filled before cancel confirmed");
        return final;
      }

      transition("cancel_pending", {
        order: final,
        detail: `cancel not confirmed status=${final.status}`,
      });
      setError(`Cancel not confirmed yet (status=${final.status})`);
      return final;
    } catch (e) {
      if (ctrl.signal.aborted) return null;
      transition("working", {
        order: current,
        detail: e instanceof Error ? e.message : "Cancel failed",
      });
      setError(e instanceof Error ? e.message : "Cancel failed");
      startStatusPoll(current.id);
      throw e;
    } finally {
      flightRef.current = false;
    }
  }, [clearAbort, transition, startStatusPoll, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    clearAbort();
    const prev = orderRef.current;
    if (prev) tradeUpdatesStream.untrack(prev.id, prev.client_order_id);
    transition("idle", { clearOrder: true, detail: "dismissed" });
    setError(null);
    flightRef.current = false;
  }, [stopPolling, clearAbort, transition]);

  const canCancel =
    order != null &&
    (isOrderCancelable(order.status) || order.status === "pending_cancel") &&
    phase !== "filled";

  return {
    order,
    phase,
    error,
    clientOrderId,
    locked,
    canCancel,
    place,
    cancel,
    reset,
    refresh: order ? () => refreshOrder(order.id) : async () => null,
    /** Mark validating/confirming for blotter without placing. */
    setDeskPhase: (p: PendingOrderPhase, detail?: string) => {
      if (p === "validating" || p === "confirming" || p === "idle") {
        transition(p, { detail });
      }
    },
  };
}
