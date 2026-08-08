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
import { fetchOrderJournal, reconcileOrderJournal } from "../api/fetchOrderJournal";
import { tradeUpdatesStream } from "../api/tradeUpdatesStream";
import type { AlpacaOrder } from "../api/alpacaTypes";
import { orderBlotter, type DeskOrderState } from "../store/orderBlotter";
import { isMarketOpen, ORDER_STATUS_POLL_MS } from "../utils/marketHours";
import { IS_MOCK } from "../config";

export type PendingOrderPhase = DeskOrderState;

interface UsePendingOptionOrderOptions {
  underlying: string;
  enabled?: boolean;
}

function orderFilledQty(order: AlpacaOrder): number {
  return Number(order.filled_qty ?? 0);
}

function toDeskState(order: AlpacaOrder): DeskOrderState {
  if (isOrderFilled(order)) return "filled";
  if (order.status === "done_for_day") {
    return orderFilledQty(order) > 0 ? "partial_filled" : "canceled";
  }
  if (isOrderCanceled(order.status)) {
    return order.status === "rejected" ? "rejected" : "canceled";
  }
  if (order.status === "pending_cancel") return "cancel_pending";
  if (order.status === "pending_new") return "ack_pending";
  if (isOrderOpen(order.status)) return "working";
  return "working";
}

/**
 * Formal desk order state machine: place → ack → working → cancel confirm.
 * Single-flight lock prevents double-submit. Blotter persists transitions.
 * Server journal is durable resume SoT; trade-updates stream applies status
 * immediately when available; polling is the fallback.
 */
export function usePendingOptionOrder({ underlying, enabled = true }: UsePendingOptionOrderOptions) {
  const [order, setOrder] = useState<AlpacaOrder | null>(null);
  const [phase, setPhase] = useState<PendingOrderPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clientOrderId, setClientOrderId] = useState<string | null>(null);
  const [partialFillQty, setPartialFillQty] = useState<number | null>(null);
  const [multiOpenCount, setMultiOpenCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Owned by place()/cancel() only — never aborted from effect cleanup. */
  const flightAbortRef = useRef<AbortController | null>(null);
  /** Synchronous single-flight — blocks double-click before React state settles. */
  const flightRef = useRef(false);
  const orderRef = useRef<AlpacaOrder | null>(null);
  const phaseRef = useRef<PendingOrderPhase>("idle");
  const clientOrderIdRef = useRef<string | null>(null);
  const underlyingRef = useRef(underlying.toUpperCase());

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
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
      if (to === from && opts.order === undefined && !opts.clearOrder) return;

      const nextOrder = opts.clearOrder ? null : (opts.order !== undefined ? opts.order : orderRef.current);
      const cid =
        opts.clientOrderId ??
        nextOrder?.client_order_id ??
        clientOrderIdRef.current ??
        "unknown";

      if (opts.clientOrderId !== undefined) {
        clientOrderIdRef.current = opts.clientOrderId;
        setClientOrderId(opts.clientOrderId);
      } else if (nextOrder?.client_order_id) {
        clientOrderIdRef.current = nextOrder.client_order_id;
        setClientOrderId(nextOrder.client_order_id);
      } else if (opts.clearOrder) {
        clientOrderIdRef.current = null;
        setClientOrderId(null);
      }

      phaseRef.current = to;
      setPhase(to);
      orderRef.current = nextOrder;
      setOrder(nextOrder);

      if (to !== from) {
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
      }
    },
    [underlying],
  );

  const applyBrokerOrder = useCallback(
    (next: AlpacaOrder) => {
      const desk = toDeskState(next);
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
        // Off-hours: still poll ~every 30s for day-TIF / cancel confirms.
        if (!isMarketOpen()) {
          const bucket = Math.floor(Date.now() / ORDER_STATUS_POLL_MS);
          if (bucket % 6 !== 0) return;
        }
        void refreshOrder(orderId).catch((e) => {
          setError(e instanceof Error ? e.message : "Order status check failed");
        });
      };

      void refreshOrder(orderId).catch((e) => {
        setError(e instanceof Error ? e.message : "Order status check failed");
      });

      pollRef.current = setInterval(tick, ORDER_STATUS_POLL_MS);
    },
    [refreshOrder, stopPolling],
  );

  const clearLocalState = useCallback(() => {
    stopPolling();
    orderRef.current = null;
    phaseRef.current = "idle";
    clientOrderIdRef.current = null;
    setOrder(null);
    setPhase("idle");
    setClientOrderId(null);
    setPartialFillQty(null);
    setMultiOpenCount(0);
    setError(null);
  }, [stopPolling]);

  // Resume open order: journal → blotter → broker open list.
  useEffect(() => {
    if (!enabled) return;

    const u = underlying.toUpperCase();
    if (underlyingRef.current !== u) {
      const prev = orderRef.current;
      if (prev) tradeUpdatesStream.untrack(prev.id, prev.client_order_id);
      clearLocalState();
      underlyingRef.current = u;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!IS_MOCK) {
          try {
            const journalOpen = await fetchOrderJournal({ underlying: u, openOnly: true, limit: 5 });
            if (cancelled) return;
            const primary = journalOpen[0] ?? null;
            if (primary) {
              orderBlotter.upsertOrder({
                clientOrderId: primary.clientOrderId,
                orderId: primary.alpacaOrderId,
                underlying: primary.underlying,
                symbol: primary.symbol,
                side: primary.side,
                qty: primary.qty,
                limitPrice: primary.limitPrice,
                status: primary.brokerStatus,
                deskState: (primary.deskState as DeskOrderState) || "working",
              });

              if (primary.alpacaOrderId) {
                try {
                  const latest = await getOrder(primary.alpacaOrderId);
                  if (cancelled) return;
                  if (isOrderOpen(latest.status) || latest.status === "pending_new") {
                    applyBrokerOrder(latest);
                    startStatusPoll(latest.id);
                    return;
                  }
                } catch {
                  // fall through to reconcile
                }
              }

              if (primary.clientOrderId) {
                try {
                  const recon = await reconcileOrderJournal(primary.clientOrderId);
                  if (cancelled) return;
                  if (recon.alpacaOrderId) {
                    const latest = await getOrder(recon.alpacaOrderId);
                    if (cancelled) return;
                    if (isOrderOpen(latest.status) || latest.status === "pending_new") {
                      applyBrokerOrder(latest);
                      startStatusPoll(latest.id);
                      return;
                    }
                  }
                  if (
                    recon.deskState === "submitting" ||
                    recon.deskState === "orphan_check" ||
                    recon.deskState === "ack_pending"
                  ) {
                    transition(recon.deskState as DeskOrderState, {
                      clientOrderId: recon.clientOrderId,
                      order: null,
                      detail: recon.lastError ?? "journal resume — awaiting broker id",
                    });
                    setError(recon.lastError ?? "Unacked order — reconciling with broker");
                    return;
                  }
                } catch {
                  // fall through
                }
              }
            }
          } catch {
            // Journal unavailable — blotter / broker list still apply.
          }
        }

        const blotterOpen = orderBlotter.getOpenForUnderlying(u);
        if (blotterOpen?.orderId) {
          try {
            const latest = await getOrder(blotterOpen.orderId);
            if (cancelled) return;
            if (isOrderOpen(latest.status) || latest.status === "pending_new") {
              applyBrokerOrder(latest);
              startStatusPoll(latest.id);
              return;
            }
            orderBlotter.upsertOrder({
              clientOrderId: blotterOpen.clientOrderId,
              deskState: toDeskState(latest),
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
          orderBlotter.upsertOrder({
            clientOrderId: blotterOpen.clientOrderId,
            deskState: "error",
            status: null,
          });
        }

        const open = await listOpenOptionOrdersForUnderlying(u);
        if (cancelled) return;
        setMultiOpenCount(open.length);
        if (open.length > 1) {
          setError(
            `${open.length} open option orders for ${u} — cancel extras before placing another`,
          );
        }
        const first = open[0] ?? null;
        if (first) {
          applyBrokerOrder(first);
          startStatusPoll(first.id);
        }
      } catch {
        // Non-fatal
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [underlying, enabled, applyBrokerOrder, startStatusPoll, stopPolling, clearLocalState, transition]);

  // Refresh on tab focus (covers throttled background timers).
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      const current = orderRef.current;
      if (!current) return;
      if (document.visibilityState !== "visible") return;
      if (!isOrderOpen(current.status) && current.status !== "pending_new") return;
      void refreshOrder(current.id).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [enabled, refreshOrder]);

  // Trade-updates stream — separate from resume so callback identity changes don't abort place().
  useEffect(() => {
    if (!enabled) return;

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
    });

    return unsub;
  }, [underlying, enabled, applyBrokerOrder]);

  const locked =
    phase === "submitting" ||
    phase === "orphan_check" ||
    phase === "ack_pending" ||
    phase === "working" ||
    phase === "cancel_requested" ||
    phase === "cancel_pending" ||
    phase === "filled" ||
    phase === "partial_filled" ||
    multiOpenCount > 1;

  const place = useCallback(
    async (params: Omit<PlaceOptionOrderParams, "clientOrderId"> & { clientOrderId?: string }) => {
      if (flightRef.current) {
        throw new Error("Order in flight — wait for acknowledgement");
      }
      if (orderRef.current && isOrderOpen(orderRef.current.status)) {
        throw new Error("An order is already pending — cancel it before placing another");
      }
      if (multiOpenCount > 1) {
        throw new Error("Multiple open orders for this symbol — resolve before placing");
      }

      const blotterOpen = orderBlotter.getOpenForUnderlying(underlying);
      if (blotterOpen) {
        throw new Error(
          `An order for ${underlying.toUpperCase()} is already open in another tab — cancel it first`,
        );
      }

      if (!IS_MOCK) {
        try {
          const journalOpen = await fetchOrderJournal({
            underlying: underlying.toUpperCase(),
            openOnly: true,
            limit: 1,
          });
          if (journalOpen.length > 0) {
            throw new Error(
              `An order for ${underlying.toUpperCase()} is already open in the journal — cancel it first`,
            );
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes("already open")) throw e;
          // Journal down — continue; proxy still enforces lock when live.
        }
      }

      flightRef.current = true;
      flightAbortRef.current?.abort();
      const ctrl = new AbortController();
      flightAbortRef.current = ctrl;
      setError(null);
      setPartialFillQty(null);

      const cid = params.clientOrderId ?? newClientOrderId();
      clientOrderIdRef.current = cid;
      setClientOrderId(cid);

      try {
        transition("submitting", {
          clientOrderId: cid,
          order: null,
          detail: `place ${params.side ?? "sell"} ${params.contractSymbol} x${params.qty}`,
        });

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
            if (!IS_MOCK) {
              try {
                await reconcileOrderJournal(cid);
              } catch {
                // advisory
              }
            }
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
        if (isOrderFilled(accepted)) {
          transition("filled", { order: accepted });
          return accepted;
        }
        if (accepted.status === "pending_new") {
          transition("ack_pending", {
            order: accepted,
            detail: "still pending_new after acceptance wait — keep monitoring",
          });
          setError("Unacked — reconciling with venue");
          startStatusPoll(accepted.id);
          return accepted;
        }
        if (!isOrderOpen(accepted.status)) {
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
            order: orderRef.current,
            detail: e instanceof Error ? e.message : "Failed to place order",
          });
          setError(e instanceof Error ? e.message : "Failed to place order");
        }
        throw e;
      } finally {
        flightRef.current = false;
        if (flightAbortRef.current === ctrl) flightAbortRef.current = null;
      }
    },
    [underlying, transition, startStatusPoll, multiOpenCount],
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
    flightAbortRef.current?.abort();
    const ctrl = new AbortController();
    flightAbortRef.current = ctrl;
    setError(null);
    stopPolling();
    transition("cancel_requested", { order: current, detail: "DELETE requested" });

    try {
      await cancelOrder(current.id);
      transition("cancel_pending", { order: { ...current, status: "pending_cancel" } });

      const final = await waitForOrderCanceled(current.id, {
        signal: ctrl.signal,
        timeoutMs: 45_000,
      });

      if (isOrderCanceled(final.status)) {
        const filledQty = orderFilledQty(final);
        if (filledQty > 0) {
          setPartialFillQty(filledQty);
          transition("partial_filled", {
            order: final,
            detail: `cancel confirmed with ${filledQty} filled`,
          });
        } else {
          transition("canceled", { order: final, detail: "cancel confirmed" });
        }
        transition("idle", { clearOrder: true, clientOrderId: final.client_order_id });
        tradeUpdatesStream.untrack(final.id, final.client_order_id);
        return final;
      }

      if (isOrderFilled(final)) {
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
      startStatusPoll(current.id);
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
      if (flightAbortRef.current === ctrl) flightAbortRef.current = null;
    }
  }, [transition, startStatusPoll, stopPolling]);

  const reset = useCallback(() => {
    const current = orderRef.current;
    if (current && (isOrderOpen(current.status) || current.status === "pending_new")) {
      setError("Cannot dismiss while order is still open — cancel it first");
      return false;
    }
    const blotterOpen = orderBlotter.getOpenForUnderlying(underlying);
    if (blotterOpen && !current) {
      setError("Cannot dismiss — an open order exists for this symbol");
      return false;
    }

    stopPolling();
    if (current) tradeUpdatesStream.untrack(current.id, current.client_order_id);
    transition("idle", { clearOrder: true, detail: "dismissed" });
    setError(null);
    setPartialFillQty(null);
    flightRef.current = false;
    return true;
  }, [underlying, stopPolling, transition]);

  const canCancel =
    order != null &&
    (isOrderCancelable(order.status) || order.status === "pending_cancel") &&
    phase !== "filled" &&
    phase !== "partial_filled";

  return {
    order,
    phase,
    error,
    clientOrderId,
    partialFillQty,
    multiOpenCount,
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
