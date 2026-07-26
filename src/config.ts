/**
 * Mock mode. Previously inferred from the presence of a browser-held Alpaca key;
 * since the credentials moved server-side there is no key here to infer from, so
 * it is an explicit flag.
 *
 * Defaults to on: a fresh clone with no `.env` renders mock positions and quotes
 * rather than firing failing requests at an unconfigured backend. Set
 * `VITE_USE_MOCK=false` once the backend holds Alpaca credentials.
 */
export const IS_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

/**
 * Base URL of the .NET backend (WheelStrategy.Api) — analysis endpoints plus the
 * Alpaca proxy that holds the credentials.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5099";
