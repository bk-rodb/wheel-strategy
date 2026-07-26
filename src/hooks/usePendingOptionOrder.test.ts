import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

vi.mock("../utils/marketHours", async () => {
  const actual = await vi.importActual<typeof import("../utils/marketHours")>(
    "../utils/marketHours",
  );
  return {
    ...actual,
    isMarketOpen: () => true,
  };
});

import { __mockOrders } from "../api/optionOrders";
import { orderBlotter } from "../store/orderBlotter";
import { usePendingOptionOrder } from "./usePendingOptionOrder";

describe("usePendingOptionOrder", () => {
  beforeEach(() => {
    __mockOrders.clear();
    orderBlotter.clear();
  });

  it("starts idle and unlocked", () => {
    const { result } = renderHook(() =>
      usePendingOptionOrder({ underlying: "NVDA" }),
    );
    expect(result.current.phase).toBe("idle");
    expect(result.current.locked).toBe(false);
    expect(result.current.order).toBeNull();
  });

  it("place() reaches working and locks the underlying", async () => {
    const { result } = renderHook(() =>
      usePendingOptionOrder({ underlying: "NVDA" }),
    );

    await act(async () => {
      await result.current.place({
        contractSymbol: "NVDA  260731P00150000",
        qty: 1,
        limitPrice: 1.25,
        side: "sell",
      });
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("working");
      expect(result.current.locked).toBe(true);
      expect(result.current.order).not.toBeNull();
    });
  });

  it("cancel() unlocks after venue confirms", async () => {
    const { result } = renderHook(() =>
      usePendingOptionOrder({ underlying: "AAPL" }),
    );

    await act(async () => {
      await result.current.place({
        contractSymbol: "AAPL  260731P00150000",
        qty: 1,
        limitPrice: 0.9,
        side: "sell",
      });
    });

    await waitFor(() => expect(result.current.phase).toBe("working"));

    await act(async () => {
      await result.current.cancel();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("idle");
      expect(result.current.locked).toBe(false);
      expect(result.current.order).toBeNull();
    });
  });

  it("clears state when underlying changes", async () => {
    const { result, rerender } = renderHook(
      ({ underlying }: { underlying: string }) =>
        usePendingOptionOrder({ underlying }),
      { initialProps: { underlying: "NVDA" } },
    );

    await act(async () => {
      await result.current.place({
        contractSymbol: "NVDA  260731P00150000",
        qty: 1,
        limitPrice: 1.1,
        side: "sell",
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("working"));

    rerender({ underlying: "TSLA" });

    await waitFor(() => {
      expect(result.current.phase).toBe("idle");
      expect(result.current.order).toBeNull();
      expect(result.current.locked).toBe(false);
    });
  });
});
