import { fetchWheelAnalysis } from "./fetchWheelAnalysis";
import { mockWheelAnalysis } from "../test/mockWheelAnalysis";
import { __clearInflightCache } from "./inflightCache";

describe("fetchWheelAnalysis", () => {
  beforeEach(() => {
    __clearInflightCache();
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
    __clearInflightCache();
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

  it("passes an abort signal to fetch on refresh (merged with timeout)", async () => {
    const ctrl = new AbortController();
    await fetchWheelAnalysis({ symbol: "NVDA", granularity: "daily", refresh: true }, ctrl.signal);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("deduped fetch is not cancelled when one subscriber aborts", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockReturnValueOnce(pending);

    const aborted = new AbortController();
    const shared = fetchWheelAnalysis(
      { symbol: "NVDA", dte: 35, granularity: "daily" },
      aborted.signal,
    );
    const peer = fetchWheelAnalysis({ symbol: "NVDA", dte: 35, granularity: "daily" });

    expect(fetch).toHaveBeenCalledTimes(1);

    aborted.abort();
    resolveFetch({
      ok: true,
      json: () => Promise.resolve(mockWheelAnalysis()),
    } as Response);

    await expect(shared).resolves.toEqual(mockWheelAnalysis());
    await expect(peer).resolves.toEqual(mockWheelAnalysis());
  });

  it("throws with API detail on non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ detail: "Upstream failed" }),
    } as Response);

    await expect(
      fetchWheelAnalysis({ symbol: "NVDA", granularity: "daily", refresh: true }),
    ).rejects.toThrow("Analysis API → Upstream failed");
  });
});
