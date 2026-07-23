import { useState, useEffect, useCallback } from "react";
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPositions = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = IS_MOCK
        ? await new Promise<WheelPosition[]>((r) => setTimeout(() => r(MOCK_POSITIONS), 600))
        : await fetchWheelPositions();
      setPositions(data);
      setLastRefresh(new Date());
    } catch (e) {
      if (!background) {
        setError(e instanceof Error ? e.message : "Failed to load positions");
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPositions();

    const slow = setInterval(() => {
      if (!hasWorkingDeskOrders() || !isMarketOpen()) {
        void fetchPositions(true);
      }
    }, POSITIONS_POLL_MS);

    const fast = setInterval(() => {
      if (hasWorkingDeskOrders() && isMarketOpen()) {
        void fetchPositions(true);
      }
    }, PENDING_ORDER_POSITION_POLL_MS);

    const unsub = orderBlotter.subscribe(() => {
      if (hasWorkingDeskOrders() && isMarketOpen()) {
        void fetchPositions(true);
      }
    });

    return () => {
      clearInterval(slow);
      clearInterval(fast);
      unsub();
    };
  }, [fetchPositions]);

  return { positions, loading, error, lastRefresh, refresh: fetchPositions, isMock: IS_MOCK };
}
