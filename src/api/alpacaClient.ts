const TRADING_URL = import.meta.env.VITE_ALPACA_BASE_URL;
const DATA_URL = import.meta.env.VITE_ALPACA_DATA_URL;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

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

function authHeaders(withJson = false): HeadersInit {
  // No Content-Type on GET: it isn't needed (no body) and adding it triggers a
  // CORS preflight that Alpaca's data API rejects
  // ("content-type is not allowed by Access-Control-Allow-Headers").
  const headers: Record<string, string> = {
    "APCA-API-KEY-ID": import.meta.env.VITE_ALPACA_API_KEY_ID,
    "APCA-API-SECRET-KEY": import.meta.env.VITE_ALPACA_API_SECRET_KEY,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

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
    await sleep(backoffMs(i));
  }
  return lastRes!;
}

async function get<T>(baseUrl: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await withRetry(
    () => fetch(url.toString(), { headers: authHeaders() }),
    true,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
  return res.json() as Promise<T>;
}

async function post<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  // NEVER auto-retry POST — callers use client_order_id + reconcile instead.
  const res = await withRetry(
    () =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(body),
      }),
    false,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
  return res.json() as Promise<T>;
}

async function del(baseUrl: string, path: string): Promise<void> {
  const res = await withRetry(
    () =>
      fetch(`${baseUrl}${path}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
    true,
  );
  // 204 = cancel accepted; 404 already gone — treat as success for UI unlock path.
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new AlpacaHttpError(path, res.status, text);
  }
}

export const trading = {
  get: <T>(path: string, params?: Record<string, string>) =>
    get<T>(TRADING_URL, path, params),
  post: <T>(path: string, body: unknown) => post<T>(TRADING_URL, path, body),
  delete: (path: string) => del(TRADING_URL, path),
};

export const marketData = {
  get: <T>(path: string, params?: Record<string, string>) =>
    get<T>(DATA_URL, path, params),
};
