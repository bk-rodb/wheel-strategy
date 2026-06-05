import { useState, useEffect, useCallback } from "react";
import type { AccountInfo, BrokerType } from "../types";
import { fetchAlpacaAccount } from "../api/fetchAccountDetails";
import { MOCK_ACCOUNT } from "../data/mockAccount";
import { IS_MOCK } from "../config";

export function useAccountDetails(broker: BrokerType) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        setAccount({ ...MOCK_ACCOUNT, broker });
      } else if (broker === "alpaca-paper" || broker === "alpaca-live") {
        setAccount(await fetchAlpacaAccount(broker));
      } else {
        // E*TRADE — OAuth not yet implemented
        setAccount(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [broker]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { account, loading, error };
}
