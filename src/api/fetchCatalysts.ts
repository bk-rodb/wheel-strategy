import { API_BASE, IS_MOCK } from "../config";
import { mockCatalystEvents } from "../data/mockCatalysts";
import { DEFAULT_TIMEOUT_MS } from "./alpacaClient";
import { inflightDeduped } from "./inflightCache";
import type { TickerCatalystsResult } from "../types";

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

async function fetchCatalystsOnce(
  symbol: string,
  signal?: AbortSignal,
): Promise<TickerCatalystsResult> {
  const sym = symbol.toUpperCase();

  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 250));
    if (signal?.aborted) return { symbol: sym, events: [], warnings: [] };
    return { symbol: sym, events: mockCatalystEvents(sym), warnings: [] };
  }

  const url = new URL(`${API_BASE}/api/catalysts`);
  url.searchParams.set("symbol", sym);

  const res = await fetch(url.toString(), { signal: requestSignal(signal) });
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
  const raw = (await res.json()) as TickerCatalystsResult;
  return {
    symbol: raw.symbol ?? sym,
    events: Array.isArray(raw.events) ? raw.events : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

export async function fetchCatalysts(
  symbol: string,
  signal?: AbortSignal,
): Promise<TickerCatalystsResult> {
  const sym = symbol.toUpperCase();
  // Deduped GETs are not tied to one caller's abort signal (see fetchWheelAnalysis).
  void signal;
  return inflightDeduped(`catalysts|${sym}`, () => fetchCatalystsOnce(sym));
}
