import { act, renderHook, waitFor } from "@testing-library/react";
import {
  fetchExpirationPicker,
  fetchFridayOptions,
  type FridayOptionsBundle,
} from "../api/fetchFridayOptions";
import { useFridayOptionSuggestions } from "./useFridayOptionSuggestions";

vi.mock("../api/fetchFridayOptions");

const mockBundle = (): FridayOptionsBundle => ({
  symbol: "NVDA",
  side: "put",
  expiration: "2026-07-31",
  dte: 6,
  spot: 170,
  contracts: 1,
  rows: [],
  warnings: [],
  quotedAt: null,
});

describe("useFridayOptionSuggestions", () => {
  beforeEach(() => {
    vi.mocked(fetchExpirationPicker).mockResolvedValue({
      dates: ["2026-07-31"],
      defaultExpiration: "2026-07-31",
    });
    vi.mocked(fetchFridayOptions).mockResolvedValue(mockBundle());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads Friday options on mount", async () => {
    const { result } = renderHook(() =>
      useFridayOptionSuggestions({ symbol: "NVDA", side: "put", shares: 0 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockBundle());
    expect(result.current.error).toBeNull();
  });

  it("passes an abort signal when refresh is invoked", async () => {
    const { result } = renderHook(() =>
      useFridayOptionSuggestions({ symbol: "NVDA", side: "put", shares: 0 }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    vi.mocked(fetchFridayOptions).mockClear();

    result.current.refresh();

    await waitFor(() => expect(fetchFridayOptions).toHaveBeenCalled());
    expect(fetchFridayOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not surface AbortError from a deduped fetch aborted elsewhere", async () => {
    const { result } = renderHook(() =>
      useFridayOptionSuggestions({ symbol: "NVDA", side: "put", shares: 0 }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    vi.mocked(fetchFridayOptions).mockRejectedValueOnce(
      new DOMException("signal is aborted without reason", "AbortError"),
    );

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetchFridayOptions.mock.calls.length).toBeGreaterThan(1);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(mockBundle());
  });
});
