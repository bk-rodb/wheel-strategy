import { useState, useEffect, useCallback, useRef } from "react";
import type { BrokerType } from "../types";
import { fetchAccountActivities, type BalanceActivity } from "../api/fetchAccountActivities";
import { MOCK_ACCOUNT_ACTIVITIES } from "../data/mockAccountActivities";
import { IS_MOCK } from "../config";

export function useAccountActivities(broker: BrokerType) {
  const [activities, setActivities] = useState<BalanceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const fetch = useCallback(async (background = false) => {
    const seq = ++seqRef.current;
    const brokerAtStart = broker;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      let next: BalanceActivity[];
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 200));
        next = MOCK_ACCOUNT_ACTIVITIES;
      } else if (brokerAtStart === "alpaca-paper" || brokerAtStart === "alpaca-live") {
        next = await fetchAccountActivities();
      } else {
        next = [];
      }
      if (seq !== seqRef.current) return;
      setActivities(next);
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (!background) {
        setError(e instanceof Error ? e.message : "Failed to load account activity");
      }
    } finally {
      if (seq === seqRef.current && !background) setLoading(false);
    }
  }, [broker]);

  useEffect(() => {
    void fetch();
    const interval = setInterval(() => void fetch(true), 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      seqRef.current += 1;
    };
  }, [fetch]);

  return { activities, loading, error, refresh: fetch };
}
