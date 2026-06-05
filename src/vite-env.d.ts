/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALPACA_API_KEY_ID: string;
  readonly VITE_ALPACA_API_SECRET_KEY: string;
  readonly VITE_ALPACA_BASE_URL: string;
  readonly VITE_ALPACA_DATA_URL: string;
  readonly VITE_POLYGON_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
