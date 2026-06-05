const TRADING_URL = import.meta.env.VITE_ALPACA_BASE_URL;
const DATA_URL = import.meta.env.VITE_ALPACA_DATA_URL;

function authHeaders(): HeadersInit {
  // No Content-Type on these GET requests: it isn't needed (no body) and adding
  // it triggers a CORS preflight that Alpaca's data API rejects
  // ("content-type is not allowed by Access-Control-Allow-Headers").
  return {
    "APCA-API-KEY-ID": import.meta.env.VITE_ALPACA_API_KEY_ID,
    "APCA-API-SECRET-KEY": import.meta.env.VITE_ALPACA_API_SECRET_KEY,
  };
}

async function get<T>(baseUrl: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const trading = {
  get: <T>(path: string, params?: Record<string, string>) =>
    get<T>(TRADING_URL, path, params),
};

export const marketData = {
  get: <T>(path: string, params?: Record<string, string>) =>
    get<T>(DATA_URL, path, params),
};
