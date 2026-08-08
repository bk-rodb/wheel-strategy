import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

vi.mock("./alpacaClient", async () => {
  const actual = await vi.importActual<typeof import("./alpacaClient")>("./alpacaClient");
  return {
    ...actual,
    DEFAULT_TIMEOUT_MS: 5_000,
  };
});

import { fetchOrderJournal } from "./fetchOrderJournal";

describe("fetchOrderJournal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            entries: [
              {
                clientOrderId: "cid-1",
                alpacaOrderId: "alp-1",
                underlying: "NVDA",
                symbol: "NVDA250801P00150000",
                side: "sell",
                qty: "1",
                filledQty: "0",
                limitPrice: "1.25",
                deskState: "working",
                brokerStatus: "accepted",
                source: "desk",
                lastError: null,
                createdAt: "2026-08-08T00:00:00Z",
                updatedAt: "2026-08-08T00:00:00Z",
                terminalAt: null,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  it("GETs journal with underlying and openOnly", async () => {
    const rows = await fetchOrderJournal({ underlying: "NVDA", openOnly: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientOrderId).toBe("cid-1");
    const call = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(String(call)).toContain("/api/orders/journal");
    expect(String(call)).toContain("underlying=NVDA");
    expect(String(call)).toContain("openOnly=true");
  });
});
