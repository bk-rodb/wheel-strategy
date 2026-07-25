import { useState, useEffect, useCallback } from "react";
import type { BrokerType } from "../types";
import { fetchAccountActivities, type BalanceActivity } from "../api/fetchAccountActivities";
import { MOCK_ACCOUNT_ACTIVITIES } from "../data/mockAccountActivities";
import { IS_MOCK } from "../config";

export function useAccountActivities(broker: BrokerType) {
  const [activities, setActivities] = useState<BalanceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 200));
        setActivities(MOCK_ACCOUNT_ACTIVITIES);
      } else if (broker === "alpaca-paper" || broker === "alpaca-live") {
        setActivities(await fetchAccountActivities());
      } else {
        setActivities([]);
      }
    } catch (e) {
      if (!background) {
        setError(e instanceof Error ? e.message : "Failed to load account activity");
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [broker]);

  useEffect(() => {
    void fetch();
    const interval = setInterval(() => void fetch(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { activities, loading, error, refresh: fetch };
}
