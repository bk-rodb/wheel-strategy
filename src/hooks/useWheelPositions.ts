import { useState, useEffect, useCallback, useRef } from "react";
import type { WheelPosition } from "../types";
import { fetchWheelPositions } from "../api/fetchWheelPositions";
import { MOCK_POSITIONS } from "../data/mockPositions";
import { IS_MOCK } from "../config";
import { orderBlotter } from "../store/orderBlotter";
import {
  isMarketOpen,
  PENDING_ORDER_POSITION_POLL_MS,
  POSITIONS_POLL_MS,
} from "../utils/marketHours";

function hasWorkingDeskOrders(): boolean {
  return orderBlotter.listOpen().length > 0;
}

export function useWheelPositions() {
  const [positions, setPositions] = useState<WheelPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [staleSince, setStaleSince] = useState<Date | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const seqRef = useRef(0);
  const coalesceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPositions = useCallback(async (background = false) => {
    const seq = ++seqRef.current;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = IS_MOCK
        ? await new Promise<WheelPosition[]>((r) => setTimeout(() => r(MOCK_POSITIONS), 600))
        : await fetchWheelPositions();
      if (seq !== seqRef.current) return;
      setPositions(data);
      setLastRefresh(new Date());
      setLastError(null);
      setStaleSince(null);
      if (!background) setError(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      const msg = e instanceof Error ? e.message : "Failed to load positions";
      setLastError(msg);
      setStaleSince((prev) => prev ?? new Date());
      if (!background) {
        setError(msg);
      }
    } finally {
      if (seq === seqRef.current && !background) setLoading(false);
    }
  }, []);

  const scheduleBackgroundRefresh = useCallback(() => {
    if (coalesceRef.current) return;
    coalesceRef.current = setTimeout(() => {
      coalesceRef.current = null;
      void fetchPositions(true);
    }, 250);
  }, [fetchPositions]);

  useEffect(() => {
    void fetchPositions();

    const slow = setInterval(() => {
      if (!hasWorkingDeskOrders() || !isMarketOpen()) {
        scheduleBackgroundRefresh();
      }
    }, POSITIONS_POLL_MS);

    const fast = setInterval(() => {
      if (hasWorkingDeskOrders() && isMarketOpen()) {
        scheduleBackgroundRefresh();
      }
    }, PENDING_ORDER_POSITION_POLL_MS);

    const unsub = orderBlotter.subscribe(() => {
      if (hasWorkingDeskOrders() && isMarketOpen()) {
        scheduleBackgroundRefresh();
      }
    });

    return () => {
      clearInterval(slow);
      clearInterval(fast);
      if (coalesceRef.current) clearTimeout(coalesceRef.current);
      unsub();
      seqRef.current += 1;
    };
  }, [fetchPositions, scheduleBackgroundRefresh]);

  return {
    positions,
    loading,
    error,
    lastError,
    staleSince,
    lastRefresh,
    refresh: fetchPositions,
    isMock: IS_MOCK,
  };
}
