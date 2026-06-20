import { fetchWheelAnalysis } from "./fetchWheelAnalysis";
import { mockWheelAnalysis } from "../test/mockWheelAnalysis";

describe("fetchWheelAnalysis", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWheelAnalysis()),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes granularity=daily in the query string when requested", async () => {
    await fetchWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "daily" });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("granularity=daily");
  });

  it("includes granularity=weekly when explicitly set", async () => {
    await fetchWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "weekly" });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("granularity=weekly");
  });

  it("omits granularity when not provided", async () => {
    await fetchWheelAnalysis({ symbol: "NVDA", dte: 35 });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("granularity=");
  });

  it("passes abort signal to fetch", async () => {
    const ctrl = new AbortController();
    await fetchWheelAnalysis({ symbol: "NVDA", granularity: "daily" }, ctrl.signal);

    expect(fetch).toHaveBeenCalledWith(expect.any(String), { signal: ctrl.signal });
  });

  it("throws with API detail on non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ detail: "Upstream failed" }),
    } as Response);

    await expect(fetchWheelAnalysis({ symbol: "NVDA", granularity: "daily" })).rejects.toThrow(
      "Analysis API → Upstream failed",
    );
  });
});
