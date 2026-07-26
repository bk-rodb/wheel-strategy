import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchExpirationPicker,
  fetchFridayOptions,
  type FridayOptionsBundle,
  type OptionSide,
} from "../api/fetchFridayOptions";
import { nextFriday, toDateString } from "../utils/nextFriday";

/** Re-fetch ladder quotes when older than this (ms). */
const QUOTE_STALE_MS = 60_000;

export function useFridayOptionSuggestions(opts: {
  symbol: string;
  side: OptionSide;
  shares: number;
  expiration?: string | null;
  enabled?: boolean;
}) {
  const { symbol, side, shares, expiration, enabled = true } = opts;
  const [data, setData] = useState<FridayOptionsBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [defaultExpiration, setDefaultExpiration] = useState<string>(() =>
    toDateString(nextFriday()),
  );
  const [expirationsLoading, setExpirationsLoading] = useState(false);
  const fetchedAtRef = useRef<number | null>(null);

  const effectiveExpiration = expiration ?? defaultExpiration;

  const loadExpirations = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      setExpirationsLoading(true);
      try {
        const picker = await fetchExpirationPicker(symbol, side, signal);
        if (!signal?.aborted) {
          setExpirations(picker.dates);
          setDefaultExpiration(picker.defaultExpiration);
        }
      } catch {
        if (!signal?.aborted) {
          const fallback = toDateString(nextFriday());
          setExpirations([fallback]);
          setDefaultExpiration(fallback);
        }
      } finally {
        if (!signal?.aborted) setExpirationsLoading(false);
      }
    },
    [symbol, side, enabled],
  );

  const load = useCallback(
    async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
      if (!enabled || !effectiveExpiration) return;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
        setData(null);
      }
      try {
        const bundle = await fetchFridayOptions({
          symbol,
          side,
          shares,
          expiration: effectiveExpiration,
          signal,
        });
        if (!signal?.aborted) {
          setData(bundle);
          fetchedAtRef.current = Date.now();
        }
      } catch (e) {
        if (!signal?.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load Friday options");
          setData(null);
        }
      } finally {
        if (!signal?.aborted && !opts?.silent) setLoading(false);
      }
    },
    [symbol, side, shares, effectiveExpiration, enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      setExpirations([]);
      setExpirationsLoading(false);
      fetchedAtRef.current = null;
      return;
    }
    const ctrl = new AbortController();
    void loadExpirations(ctrl.signal);
    return () => ctrl.abort();
  }, [loadExpirations, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, enabled]);

  // Refresh stale quotes while the ladder is visible.
  useEffect(() => {
    if (!enabled || !data) return;
    const id = window.setInterval(() => {
      const age = fetchedAtRef.current ? Date.now() - fetchedAtRef.current : Infinity;
      if (age >= QUOTE_STALE_MS) {
        const ctrl = new AbortController();
        void load(ctrl.signal, { silent: true });
      }
    }, QUOTE_STALE_MS);
    return () => window.clearInterval(id);
  }, [enabled, data, load]);

  return {
    data,
    loading: loading || expirationsLoading,
    error,
    refresh: () => {
      void loadExpirations();
      void load();
    },
    expirations,
    defaultExpiration,
    quotedAt: data?.quotedAt ?? null,
  };
}
