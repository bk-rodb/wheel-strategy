import { useState, useEffect, useCallback } from "react";
import type { WheelPosition } from "../types";
import { fetchWheelPositions } from "../api/fetchWheelPositions";
import { MOCK_POSITIONS } from "../data/mockPositions";
import { IS_MOCK } from "../config";

export function useWheelPositions() {
  const [positions, setPositions] = useState<WheelPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = IS_MOCK
        ? await new Promise<WheelPosition[]>((r) => setTimeout(() => r(MOCK_POSITIONS), 600))
        : await fetchWheelPositions();
      setPositions(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return { positions, loading, error, lastRefresh, refresh: fetchPositions, isMock: IS_MOCK };
}
