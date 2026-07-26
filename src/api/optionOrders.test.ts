import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

import {
  __mockOrders,
  buildOsiSymbol,
  cancelOrder,
  getOrder,
  getOrderByClientId,
  isOrderAccepted,
  isOrderCancelable,
  isOrderCanceled,
  isOrderFilled,
  isOrderOpen,
  newClientOrderId,
  optionUnderlying,
  parseOsiSymbol,
  placeOptionOrder,
  reconcileSubmission,
  roundOptionLimit,
  waitForOrderAcceptance,
  waitForOrderCanceled,
} from "./optionOrders";

describe("optionOrders status helpers", () => {
  it("treats accepted as working (not filled) and cancelable", () => {
    expect(isOrderOpen("accepted")).toBe(true);
    expect(isOrderAccepted("accepted")).toBe(true);
    expect(isOrderFilled("accepted")).toBe(false);
    expect(isOrderCancelable("accepted")).toBe(true);
    expect(isOrderCancelable("new")).toBe(true);
    expect(isOrderCancelable("partially_filled")).toBe(true);
  });

  it("only filled/done_for_day block cancel", () => {
    expect(isOrderFilled("filled")).toBe(true);
    expect(isOrderCancelable("filled")).toBe(false);
    expect(isOrderCancelable("done_for_day")).toBe(false);
    expect(isOrderCancelable("pending_cancel")).toBe(false);
  });

  it("unlocks only after terminal cancel statuses", () => {
    expect(isOrderCanceled("canceled")).toBe(true);
    expect(isOrderCanceled("rejected")).toBe(true);
    expect(isOrderCanceled("pending_cancel")).toBe(false);
    expect(isOrderOpen("pending_cancel")).toBe(true);
  });

  it("treats unfilled done_for_day as not filled", () => {
    expect(isOrderFilled({ status: "done_for_day", filled_qty: "0", qty: "1" })).toBe(
      false,
    );
    expect(isOrderFilled({ status: "done_for_day", filled_qty: "1", qty: "1" })).toBe(
      true,
    );
    expect(isOrderCancelable("done_for_day")).toBe(false);
  });

  it("parses underlying from OSI symbols", () => {
    expect(optionUnderlying("SPCX  260724P00102000")).toBe("SPCX");
    expect(optionUnderlying("AAPL250117C00150000")).toBe("AAPL");
  });

  it("builds OSI symbols", () => {
    expect(buildOsiSymbol("SPCX", "2026-07-24", "put", 102)).toBe(
      "SPCX  260724P00102000",
    );
    expect(buildOsiSymbol("AAPL", "2025-01-17", "call", 150)).toBe(
      "AAPL  250117C00150000",
    );
  });

  it("parses padded and compact OSI symbols", () => {
    expect(parseOsiSymbol("SPCX  260724P00102000")).toEqual({
      underlying: "SPCX",
      expiration: "2026-07-24",
      type: "put",
      strike: 102,
    });
    expect(parseOsiSymbol("SPCX260724P00102000")).toEqual({
      underlying: "SPCX",
      expiration: "2026-07-24",
      type: "put",
      strike: 102,
    });
    expect(parseOsiSymbol("AAPL  250117C00150000")).toEqual({
      underlying: "AAPL",
      expiration: "2025-01-17",
      type: "call",
      strike: 150,
    });
  });
});

describe("roundOptionLimit", () => {
  it("uses penny ticks below $3 and nickel ticks at or above", () => {
    expect(roundOptionLimit(2.47, "sell")).toBe(2.47);
    expect(roundOptionLimit(2.471, "sell")).toBe(2.48);
    expect(roundOptionLimit(3.12, "sell")).toBe(3.15);
    expect(roundOptionLimit(3.12, "buy")).toBe(3.1);
  });
});

describe("optionOrders idempotency (mock)", () => {
  beforeEach(() => {
    __mockOrders.clear();
  });

  it("sends and reuses client_order_id", async () => {
    const cid = newClientOrderId();
    const a = await placeOptionOrder({
      contractSymbol: "SPCX  260724P00102000",
      qty: 1,
      limitPrice: 0.3,
      side: "sell",
      clientOrderId: cid,
    });
    expect(a.client_order_id).toBe(cid);

    const b = await placeOptionOrder({
      contractSymbol: "SPCX  260724P00102000",
      qty: 1,
      limitPrice: 0.3,
      side: "sell",
      clientOrderId: cid,
    });
    expect(b.id).toBe(a.id);
    expect(__mockOrders.all()).toHaveLength(1);
  });

  it("reconcileSubmission adopts an existing order by client id", async () => {
    const cid = "test-client-orphan-1";
    const created = await placeOptionOrder({
      contractSymbol: "SPCX  260724P00110000",
      qty: 2,
      limitPrice: 0.5,
      clientOrderId: cid,
    });
    const found = await reconcileSubmission(cid);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(await getOrderByClientId("missing-id")).toBeNull();
  });

  it("waitForOrderAcceptance advances pending_new to accepted", async () => {
    const created = await placeOptionOrder({
      contractSymbol: "AAPL  260731P00150000",
      qty: 1,
      limitPrice: 1.0,
    });
    expect(created.status).toBe("pending_new");
    const accepted = await waitForOrderAcceptance(created.id, { timeoutMs: 5_000 });
    expect(accepted.status).toBe("accepted");
  });

  it("cancelOrder + waitForOrderCanceled reaches canceled", async () => {
    const created = await placeOptionOrder({
      contractSymbol: "AAPL  260731P00150000",
      qty: 1,
      limitPrice: 1.0,
    });
    await getOrder(created.id); // pending_new → accepted
    await cancelOrder(created.id);
    const final = await waitForOrderCanceled(created.id, { timeoutMs: 5_000 });
    expect(final.status).toBe("canceled");
  });
});
