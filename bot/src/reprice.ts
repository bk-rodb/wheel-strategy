import { isOrderCanceled, isOrderDoneUnfilled, isOrderFilled, type AlpacaOrder } from "./orders.js";

export type RepriceDecision =
  | { action: "done" }
  | { action: "reprice" }
  | { action: "giveUp" };

/**
 * Decides what a cycle should do after a bounded poll window ends.
 * Terminal orders (filled/canceled/done) always end the loop, regardless of reprice settings.
 */
export function decideReprice(opts: {
  final: Pick<AlpacaOrder, "status" | "filled_qty" | "qty">;
  repriceEnabled: boolean;
  attempt: number;
  maxAttempts: number;
}): RepriceDecision {
  const isStillOpen =
    !isOrderFilled(opts.final) &&
    !isOrderCanceled(opts.final.status) &&
    !isOrderDoneUnfilled(opts.final);
  if (!opts.repriceEnabled || !isStillOpen) return { action: "done" };
  if (opts.attempt >= opts.maxAttempts) return { action: "giveUp" };
  return { action: "reprice" };
}
