import { useState, useEffect, useCallback, useRef } from "react";
import type { AccountInfo, BrokerType } from "../types";
import { fetchAlpacaAccount } from "../api/fetchAccountDetails";
import { MOCK_ACCOUNT } from "../data/mockAccount";
import { IS_MOCK } from "../config";

export function useAccountDetails(broker: BrokerType) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
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
      let next: AccountInfo | null;
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        next = { ...MOCK_ACCOUNT, broker: brokerAtStart };
      } else if (brokerAtStart === "alpaca-paper" || brokerAtStart === "alpaca-live") {
        next = await fetchAlpacaAccount(brokerAtStart);
      } else {
        // E*TRADE — OAuth not yet implemented
        next = null;
      }
      if (seq !== seqRef.current) return;
      setAccount(next);
      if (!background) setError(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (!background) {
        setError(e instanceof Error ? e.message : "Failed to load account");
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

  return { account, loading, error };
}
