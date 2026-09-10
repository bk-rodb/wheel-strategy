import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  cycleClientOrderId,
  isOrderCancelable,
  isOrderCanceled,
  isOrderDoneUnfilled,
  isOrderFilled,
  pollUntilDone,
} from "./orders.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("pollUntilDone", () => {
  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("returns the still-open order once a past deadline is reached, without canceling", async () => {
    let getCalls = 0;
    let deleteCalls = 0;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "DELETE") {
        deleteCalls++;
        return new Response(null, { status: 204 });
      }
      getCalls++;
      return jsonResponse({ id: "o1", client_order_id: "c1", symbol: "NVDA240101P00100000", qty: "1", filled_qty: "0", side: "sell", type: "limit", status: "accepted" });
    }) as typeof fetch;

    const order = await pollUntilDone({ orderId: "o1", pollMs: 5, deadlineMs: Date.now() - 1 });
    assert.equal(order.status, "accepted");
    assert.equal(getCalls, 1);
    assert.equal(deleteCalls, 0);
  });

  it("short-circuits on a terminal status before checking the deadline", async () => {
    let getCalls = 0;
    globalThis.fetch = (async () => {
      getCalls++;
      return jsonResponse({ id: "o1", client_order_id: "c1", symbol: "NVDA240101P00100000", qty: "1", filled_qty: "1", side: "sell", type: "limit", status: "filled" });
    }) as typeof fetch;

    const order = await pollUntilDone({ orderId: "o1", pollMs: 5, deadlineMs: Date.now() + 3_600_000 });
    assert.equal(order.status, "filled");
    assert.equal(getCalls, 1);
  });

  it("behaves the same when deadlineMs is omitted", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ id: "o1", client_order_id: "c1", symbol: "NVDA240101P00100000", qty: "1", filled_qty: "1", side: "sell", type: "limit", status: "filled" })) as typeof fetch;

    const order = await pollUntilDone({ orderId: "o1", pollMs: 5 });
    assert.equal(order.status, "filled");
  });
});

describe("order status predicates", () => {
  it("isOrderFilled", () => {
    assert.equal(isOrderFilled({ status: "filled", filled_qty: "1", qty: "1" }), true);
    assert.equal(isOrderFilled({ status: "done_for_day", filled_qty: "1", qty: "1" }), true);
    assert.equal(isOrderFilled({ status: "done_for_day", filled_qty: "0", qty: "1" }), false);
    assert.equal(isOrderFilled({ status: "accepted", filled_qty: "0", qty: "1" }), false);
  });

  it("isOrderCanceled", () => {
    for (const s of ["canceled", "expired", "rejected", "replaced"]) {
      assert.equal(isOrderCanceled(s), true);
    }
    assert.equal(isOrderCanceled("accepted"), false);
  });

  it("isOrderDoneUnfilled", () => {
    assert.equal(isOrderDoneUnfilled({ status: "done_for_day", filled_qty: "0" }), true);
    assert.equal(isOrderDoneUnfilled({ status: "done_for_day", filled_qty: "1" }), false);
    assert.equal(isOrderDoneUnfilled({ status: "filled", filled_qty: "0" }), false);
  });

  it("isOrderCancelable", () => {
    assert.equal(isOrderCancelable("accepted"), true);
    assert.equal(isOrderCancelable("pending_new"), true);
    assert.equal(isOrderCancelable("filled"), false);
    assert.equal(isOrderCancelable("canceled"), false);
    assert.equal(isOrderCancelable("done_for_day"), false);
    assert.equal(isOrderCancelable("pending_cancel"), false);
  });
});

describe("cycleClientOrderId", () => {
  it("builds the base id with no retry suffix", () => {
    assert.equal(cycleClientOrderId("NVDA", "2026-09-11", "put", "2026-09-08"), "bot-nvda-20260911-p-20260908");
  });

  it("appends a retry suffix when retryIndex > 0", () => {
    assert.equal(cycleClientOrderId("NVDA", "2026-09-11", "put", "2026-09-08", 2), "bot-nvda-20260911-p-20260908-r2");
  });

  it("truncates to 48 characters", () => {
    const id = cycleClientOrderId("VERYLONGTICKERSYMBOL", "2026-09-11", "call", "2026-09-08", 12);
    assert.ok(id.length <= 48);
  });
});
