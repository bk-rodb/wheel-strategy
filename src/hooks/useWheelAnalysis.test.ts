import { renderHook, waitFor } from "@testing-library/react";
import { useWheelAnalysis } from "./useWheelAnalysis";
import { fetchWheelAnalysis } from "../api/fetchWheelAnalysis";
import { mockWheelAnalysis } from "../test/mockWheelAnalysis";
import type { AnalysisGranularity } from "../types";

vi.mock("../api/fetchWheelAnalysis");

describe("useWheelAnalysis", () => {
  beforeEach(() => {
    vi.mocked(fetchWheelAnalysis).mockResolvedValue(mockWheelAnalysis());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes granularity to fetchWheelAnalysis on load", async () => {
    renderHook(() => useWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "daily" }));

    await waitFor(() => {
      expect(fetchWheelAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "NVDA", dte: 35, granularity: "daily", refresh: false }),
        expect.any(AbortSignal),
      );
    });
  });

  it("refetches when granularity changes", async () => {
    const { rerender } = renderHook(
      ({ granularity }: { granularity: AnalysisGranularity }) =>
        useWheelAnalysis({ symbol: "NVDA", dte: 35, granularity }),
      { initialProps: { granularity: "weekly" satisfies AnalysisGranularity } },
    );

    await waitFor(() => expect(fetchWheelAnalysis).toHaveBeenCalled());
    const callsBefore = vi.mocked(fetchWheelAnalysis).mock.calls.length;

    rerender({ granularity: "daily" });

    await waitFor(() => {
      expect(vi.mocked(fetchWheelAnalysis).mock.calls.length).toBeGreaterThan(callsBefore);
    });
    expect(fetchWheelAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: "daily", refresh: false }),
      expect.any(AbortSignal),
    );
  });

  it("passes refresh=true when refresh is invoked", async () => {
    const { result } = renderHook(() =>
      useWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "daily" }),
    );

    await waitFor(() => expect(fetchWheelAnalysis).toHaveBeenCalled());
    vi.mocked(fetchWheelAnalysis).mockClear();

    result.current.refresh();

    await waitFor(() => expect(fetchWheelAnalysis).toHaveBeenCalledTimes(1));
    expect(fetchWheelAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: "daily", refresh: true }),
      undefined,
    );
  });

  it("stores fetched data and clears loading", async () => {
    const analysis = mockWheelAnalysis({ granularity: "daily", sampleCount: 476 });
    vi.mocked(fetchWheelAnalysis).mockResolvedValue(analysis);

    const { result } = renderHook(() =>
      useWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "daily" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(analysis);
    expect(result.current.error).toBeNull();
  });
});
