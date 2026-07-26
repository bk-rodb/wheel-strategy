/**
 * Alpaca access goes through the backend proxy, never straight to Alpaca.
 *
 * Vite inlines every VITE_-prefixed variable into the bundle as a literal string,
 * so a browser-held key — one that also authorizes POST /v2/orders — shipped in
 * every dist/ build. WheelStrategy.Api attaches the APCA-* headers server-side
 * from user-secrets; nothing here is a credential.
 */
import { API_BASE } from "../config";

const TRADING_URL = `${API_BASE}/api/alpaca/trading`;
const DATA_URL = `${API_BASE}/api/alpaca/data`;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;
export const DEFAULT_TIMEOUT_MS = 15_000;

export class AlpacaHttpError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(path: string, status: number, body: string) {
    super(`Alpaca ${path} → ${status}: ${body}`);
    this.name = "AlpacaHttpError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export type AlpacaRequestOpts = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(attempt: number): number {
  const jitter = Math.random() * 200;
  return BASE_DELAY_MS * 2 ** attempt + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse Retry-After as seconds or HTTP-date; null if missing/invalid. */
export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(60_000, seconds * 1000);
  }
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    return Math.min(60_000, Math.max(0, when - Date.now()));
  }
  return null;
}

function requestSignal(opts?: AlpacaRequestOpts): AbortSignal {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!opts?.signal) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([opts.signal, timeout]);
  }
  return opts.signal;
}

async function drainBody(res: Response): Promise<void> {
  try {
    if (res.body) await res.body.cancel();
  } catch {
    // already consumed / locked
  }
}

async function withRetry(
  exec: () => Promise<Response>,
  /** Only GET/DELETE are auto-retried; POST never is. */
  allowRetry: boolean,
): Promise<Response> {
  let lastRes: Response | null = null;
  const attempts = allowRetry ? MAX_RETRIES : 1;
  for (let i = 0; i < attempts; i++) {
    lastRes = await exec();
    if (lastRes.ok || lastRes.status === 204 || lastRes.status === 404) return lastRes;
    if (!allowRetry || !isRetryable(lastRes.status) || i === attempts - 1) return lastRes;
    const retryAfter = parseRetryAfterMs(lastRes.headers.get("Retry-After"));
    await drainBody(lastRes);
    await sleep(retryAfter ?? backoffMs(i));
  }
  return lastRes!;
}

async function get<T>(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
  opts?: AlpacaRequestOpts,
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const signal = requestSignal(opts);
  // No Content-Type on a GET: there is no body, and adding one would provoke a
  // CORS preflight for nothing.
  const res = await withRetry(() => fetch(url.toString(), { signal }), true);
  if (!res.ok) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
  return res.json() as Promise<T>;
}

async function post<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  opts?: AlpacaRequestOpts,
): Promise<T> {
  // NEVER auto-retry POST — callers use client_order_id + reconcile instead.
  const signal = requestSignal(opts);
  const res = await withRetry(
    () =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
        signal,
      }),
    false,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
  return res.json() as Promise<T>;
}

async function del(baseUrl: string, path: string, opts?: AlpacaRequestOpts): Promise<void> {
  const signal = requestSignal(opts);
  const res = await withRetry(
    () => fetch(`${baseUrl}${path}`, { method: "DELETE", signal }),
    true,
  );
  // 204 = cancel accepted; 404 already gone — treat as success for UI unlock path.
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
}

export const trading = {
  get: <T>(path: string, params?: Record<string, string>, opts?: AlpacaRequestOpts) =>
    get<T>(TRADING_URL, path, params, opts),
  post: <T>(path: string, body: unknown, opts?: AlpacaRequestOpts) =>
    post<T>(TRADING_URL, path, body, opts),
  delete: (path: string, opts?: AlpacaRequestOpts) => del(TRADING_URL, path, opts),
};

export const marketData = {
  get: <T>(path: string, params?: Record<string, string>, opts?: AlpacaRequestOpts) =>
    get<T>(DATA_URL, path, params, opts),
};
