import { API_BASE, IS_MOCK } from "../config";
import { mockCatalystEvents } from "../data/mockCatalysts";
import type { TickerCatalystsResult } from "../types";

export async function fetchCatalysts(
  symbol: string,
  signal?: AbortSignal,
): Promise<TickerCatalystsResult> {
  const sym = symbol.toUpperCase();

  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 250));
    if (signal?.aborted) return { symbol: sym, events: [] };
    return { symbol: sym, events: mockCatalystEvents(sym) };
  }

  const url = new URL(`${API_BASE}/api/catalysts`);
  url.searchParams.set("symbol", sym);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.title ?? detail;
    } catch {
      // non-JSON
    }
    throw new Error(`Catalysts API → ${detail}`);
  }
  return res.json() as Promise<TickerCatalystsResult>;
}
