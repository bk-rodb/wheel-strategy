export const IS_MOCK = !import.meta.env.VITE_ALPACA_API_KEY_ID;

// Base URL of the .NET analysis backend (WheelStrategy.Api).
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5099";
