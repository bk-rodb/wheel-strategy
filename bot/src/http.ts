import { config } from "./config.js";

export class BotHttpError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(path: string, status: number, body: string) {
    super(`HTTP ${path} → ${status}: ${body}`);
    this.name = "BotHttpError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

function requestSignal(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  return signal;
}

function qs(params?: Record<string, string>): string {
  if (!params) return "";
  const sp = new URLSearchParams(params);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function parseBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function request<T>(
  method: string,
  path: string,
  opts?: {
    params?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
    /** When true, empty/204 responses return null. */
    allowEmpty?: boolean;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const url = `${config.apiBase}${path}${qs(opts?.params)}`;
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: requestSignal(opts?.signal),
  });

  if (res.status === 204 || (opts?.allowEmpty && res.status === 200 && res.headers.get("content-length") === "0")) {
    return null as T;
  }

  const text = await parseBody(res);
  if (!res.ok) {
    throw new BotHttpError(path, res.status, text);
  }
  if (!text) {
    if (opts?.allowEmpty) return null as T;
    throw new BotHttpError(path, res.status, "empty body");
  }
  return JSON.parse(text) as T;
}

/** Analysis endpoint (not under /api/alpaca). */
export function analysisGet<T>(
  path: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>("GET", path, { params, signal });
}

/** Alpaca trading proxy. */
export const trading = {
  get<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T> {
    return request<T>("GET", `/api/alpaca/trading${path}`, { params, signal });
  },
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>("POST", `/api/alpaca/trading${path}`, {
      body,
      signal,
      headers: { "X-Wheel-Order-Source": "bot" },
    });
  },
  delete(path: string, signal?: AbortSignal): Promise<void> {
    return request<void>("DELETE", `/api/alpaca/trading${path}`, {
      signal,
      allowEmpty: true,
      headers: { "X-Wheel-Order-Source": "bot" },
    });
  },
};

/** Alpaca market-data proxy. */
export const marketData = {
  get<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T> {
    return request<T>("GET", `/api/alpaca/data${path}`, { params, signal });
  },
};

/** Quick liveness check against the analysis API host. */
export async function pingApi(signal?: AbortSignal): Promise<void> {
  const url = `${config.apiBase}/health`;
  const res = await fetch(url, { signal: requestSignal(signal, 5_000) });
  if (!res.ok) {
    throw new BotHttpError("/health", res.status, await parseBody(res));
  }
}
