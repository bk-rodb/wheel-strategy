import { useState, useCallback } from "react";
import type { BrokerType } from "./types";
import { useWheelPositions } from "./hooks/useWheelPositions";
import { useAccountDetails } from "./hooks/useAccountDetails";
import { TopBar } from "./components/TopBar";
import { AccountHeader } from "./components/AccountHeader";
import { TabBar } from "./components/TabBar";
import { SummaryDashboard } from "./components/SummaryDashboard";
import { TickerDetail } from "./components/TickerDetail";
import { WatchlistTickerDetail } from "./components/WatchlistTickerDetail";
import { WatchlistPanel } from "./components/WatchlistPanel";

export default function WheelDashboard() {
  const [broker, setBroker] = useState<BrokerType>("alpaca-paper");
  const { positions, loading, error, lastRefresh, refresh, isMock } = useWheelPositions();
  const { account, loading: accountLoading } = useAccountDetails(broker);
  const [activeTab, setActiveTab] = useState<string>("__summary__");
  const [openedTickers, setOpenedTickers] = useState<string[]>([]);

  const handleOpenTicker = useCallback(
    (symbol: string) => {
      const sym = symbol.toUpperCase();
      // Held tickers already have a permanent position tab — just activate it.
      if (!positions.some((p) => p.id === sym)) {
        setOpenedTickers((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
      }
      setActiveTab(sym);
    },
    [positions],
  );

  const handleCloseTicker = useCallback(
    (symbol: string) => {
      setOpenedTickers((prev) => prev.filter((s) => s !== symbol));
      setActiveTab((current) => (current === symbol ? "__summary__" : current));
    },
    [],
  );

  // Opened watchlist tickers that haven't since become positions (avoid dupes).
  const watchlistTabs = openedTickers.filter(
    (sym) => !positions.some((p) => p.id === sym),
  );

  const tabs = [
    { id: "__summary__", label: "DASHBOARD" },
    ...positions.map((p) => ({ id: p.id, label: p.ticker })),
    ...watchlistTabs.map((sym) => ({ id: sym, label: sym, closeable: true })),
  ];

  const activePosition = positions.find((p) => p.id === activeTab);
  const activeWatchlistTicker = watchlistTabs.includes(activeTab) ? activeTab : null;

  return (
    <div style={{ minHeight: "100vh", background: "#030310", padding: "10px", color: "#c0c0e0", fontFamily: "monospace" }}>
      <div
        style={{
          minHeight: "calc(100vh - 20px)",
          background: "#07071a",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 4px 6px #00000040, 0 12px 32px #00000060, 0 32px 64px #00000050, inset 0 1px 0 #ffffff08",
          border: "1px solid #16162e",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar
          broker={broker}
          onBrokerChange={setBroker}
          lastRefresh={lastRefresh}
          loading={loading}
          isMock={isMock}
          onRefresh={refresh}
        />

        <AccountHeader account={account} loading={accountLoading} />

        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          positions={positions}
          onSelect={setActiveTab}
          onClose={handleCloseTicker}
        />

        <div style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
          <div style={{ flex: 1, padding: "24px", minWidth: 0 }}>
            {error && (
              <div
                style={{
                  background: "#1a0808",
                  border: "1px solid #4a1010",
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 12,
                  color: "#f87171",
                  fontFamily: "monospace",
                }}
              >
                ✗ {error}
              </div>
            )}

            {loading && positions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, color: "#2a2a4a", fontFamily: "monospace", fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◌</div>
                LOADING POSITIONS...
              </div>
            ) : activeTab === "__summary__" ? (
              <SummaryDashboard positions={positions} onSelectTicker={setActiveTab} />
            ) : activePosition ? (
              <TickerDetail pos={activePosition} />
            ) : activeWatchlistTicker ? (
              <WatchlistTickerDetail symbol={activeWatchlistTicker} />
            ) : null}
          </div>

          <WatchlistPanel onOpenTicker={handleOpenTicker} />
        </div>
      </div>
    </div>
  );
}
