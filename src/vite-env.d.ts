/// <reference types="vite/client" />

/**
 * Browser-visible config only. Every VITE_-prefixed value is inlined into the
 * production bundle as a literal string, so nothing secret may be declared here —
 * Alpaca credentials live in backend user-secrets and are attached by the proxy.
 */
interface ImportMetaEnv {
  /** `"false"` opts into live data through the backend proxy; anything else is mock. */
  readonly VITE_USE_MOCK?: string;
  /** Backend base URL — analysis endpoints and the Alpaca proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** Alpaca market-data feed (`iex` | `sip`), forwarded to the proxy. Non-secret. */
  readonly VITE_ALPACA_DATA_FEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
