import { renderHook, waitFor } from "@testing-library/react";
import { fetchCatalysts } from "../api/fetchCatalysts";
import { fetchTickerNews } from "../api/fetchTickerNews";
import { useTickerCatalysts } from "./useTickerCatalysts";

vi.mock("../api/fetchCatalysts");
vi.mock("../api/fetchTickerNews");

describe("useTickerCatalysts", () => {
  beforeEach(() => {
    vi.mocked(fetchCatalysts).mockResolvedValue({
      symbol: "NVDA",
      events: [],
      warnings: [],
    });
    vi.mocked(fetchTickerNews).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not surface AbortError when two instances share a deduped fetch", async () => {
    vi.mocked(fetchCatalysts).mockRejectedValueOnce(
      new DOMException("signal is aborted without reason", "AbortError"),
    );

    const { result: a } = renderHook(() => useTickerCatalysts("NVDA"));
    const { result: b } = renderHook(() => useTickerCatalysts("NVDA"));

    await waitFor(() => expect(a.current.loading).toBe(false));
    await waitFor(() => expect(b.current.loading).toBe(false));

    expect(a.current.error).toBeNull();
    expect(b.current.error).toBeNull();
  });
});
