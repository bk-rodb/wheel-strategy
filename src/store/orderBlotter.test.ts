import { beforeEach, describe, expect, it } from "vitest";
import { orderBlotter } from "./orderBlotter";

describe("orderBlotter", () => {
  beforeEach(() => {
    orderBlotter.clear();
  });

  it("appends transitions and tracks open order per underlying", () => {
    orderBlotter.append({
      clientOrderId: "c1",
      orderId: "o1",
      symbol: "SPCX  260724P00102000",
      underlying: "SPCX",
      fromState: "idle",
      toState: "submitting",
      status: null,
    });
    orderBlotter.append({
      clientOrderId: "c1",
      orderId: "o1",
      symbol: "SPCX  260724P00102000",
      underlying: "SPCX",
      fromState: "submitting",
      toState: "working",
      status: "accepted",
    });

    const open = orderBlotter.getOpenForUnderlying("SPCX");
    expect(open).not.toBeNull();
    expect(open!.clientOrderId).toBe("c1");
    expect(open!.deskState).toBe("working");
    expect(orderBlotter.transitions("c1")).toHaveLength(2);
  });

  it("lists all open desk orders newest first", () => {
    orderBlotter.upsertOrder({
      clientOrderId: "c-old",
      orderId: "o-old",
      underlying: "AAPL",
      symbol: "AAPL  260724P00100000",
      deskState: "working",
      status: "accepted",
    });
    // Force older timestamp
    const storeKey = "wheel-order-blotter";
    const raw = JSON.parse(localStorage.getItem(storeKey) ?? "{}");
    if (raw.orders?.["c-old"]) raw.orders["c-old"].updatedAt = "2020-01-01T00:00:00.000Z";
    localStorage.setItem(storeKey, JSON.stringify(raw));

    orderBlotter.upsertOrder({
      clientOrderId: "c-new",
      orderId: "o-new",
      underlying: "SPCX",
      symbol: "SPCX  260724P00102000",
      deskState: "ack_pending",
      status: "pending_new",
    });

    const open = orderBlotter.listOpen();
    expect(open.map((o) => o.clientOrderId)).toEqual(["c-new", "c-old"]);
  });

  it("does not return terminal desk states as open", () => {
    orderBlotter.upsertOrder({
      clientOrderId: "c2",
      orderId: "o2",
      underlying: "NVDA",
      symbol: "NVDA  260724P00100000",
      deskState: "filled",
      status: "filled",
    });
    expect(orderBlotter.getOpenForUnderlying("NVDA")).toBeNull();
  });
});
