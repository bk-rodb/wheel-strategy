import { useTickerSnapshot } from "../hooks/useTickerSnapshot";
import { signColor } from "../constants";
import type { AccountInfo } from "../types";
import { fmt } from "../utils/formatters";
import { formatAveragePricePair } from "../utils/priceAverages";
import { OpenOptionsSection } from "./OpenOptionsSection";
import { PriceTrendSection } from "./PriceTrendSection";
import { StatRow } from "./StatRow";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";
import { ResearchSection } from "./ResearchSection";
import { TickerHeader } from "./TickerHeader";
import { CatalystsAndNews } from "./CatalystsAndNews";
import { Banner, Card, CardLabel, EmptyState, LoadingState } from "./ui";
import { VolatilityBar } from "./VolatilityBar";
import { vars } from "../theme";

export function WatchlistTickerDetail({
  symbol,
  account = null,
  focusOpenOptions = false,
  onFocusOpenOptionsHandled,
  onPositionRefresh,
}: {
  symbol: string;
  account?: AccountInfo | null;
  focusOpenOptions?: boolean;
  onFocusOpenOptionsHandled?: () => void;
  onPositionRefresh?: () => void;
}) {
  const snap = useTickerSnapshot(symbol);

  if (snap.loading) {
    return <LoadingState label={`LOADING ${symbol}...`} />;
  }

  if (snap.error) {
    return <Banner tone="error">✗ {snap.error}</Banner>;
  }

  return (
    <div style={{ padding: "0 4px" }}>
      <TickerHeader
        symbol={symbol}
        companyName={snap.companyName}
        badge={
          <span
            style={{
              fontSize: 10,
              color: vars.text.tertiary,
              background: vars.border.default,
              border: `1px solid ${vars.border.emphasis}`,
              padding: "2px 7px",
              borderRadius: 3,
              fontFamily: vars.font.mono,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            WATCHLIST
          </span>
        }
        subtitle="Not currently held · research view"
        price={snap.lastPrice}
        change={snap.change}
        changePct={snap.changePct}
      />

      <Card marginBottom={16}>
        <PriceTrendSection
          data={snap.priceHistory}
          currentPrice={snap.lastPrice}
          costBasis={0}
        />
      </Card>

      <Card marginBottom={16}>
        <CatalystsAndNews symbol={symbol} />
      </Card>

      {/* 2-col: stock details + current balance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <CardLabel>STOCK DETAILS</CardLabel>
          <StatRow
            label="Last Price"
            value={
              <>
                {fmt.currency(snap.lastPrice)}{" "}
                <span style={{ color: signColor(snap.change) }}>
                  ({snap.change >= 0 ? "+" : ""}
                  {fmt.currency(snap.change)})
                </span>
              </>
            }
          />
          <StatRow label="Prev. Close" value={fmt.currency(snap.prevClose)} />
          <StatRow
            label="Day High/Low"
            value={`${fmt.currency(snap.dayHigh)}/${fmt.currency(snap.dayLow)}`}
          />
          <StatRow
            label="52 Week Range"
            value={`${fmt.currency(snap.week52High)}/${fmt.currency(snap.week52Low)}`}
          />
          <StatRow
            label="Average Price (1W/1M)"
            value={formatAveragePricePair(snap.priceHistory)}
          />
          <StatRow label="Volume" value={fmt.compact(snap.volume)} />
          <VolatilityBar symbol={symbol} />
        </Card>
        <Card>
          <CardLabel>CURRENT BALANCE</CardLabel>
          <EmptyState hint="NOT IN THIS ACCOUNT">NO SHARES HELD</EmptyState>
        </Card>
      </div>

      {/* Open options — Friday put ladder + sell-to-open when flat */}
      <Card marginBottom={16}>
        <OpenOptionsSection
          symbol={symbol}
          shares={0}
          account={account}
          focusSection={focusOpenOptions}
          onFocusHandled={onFocusOpenOptionsHandled}
          onPositionRefresh={onPositionRefresh}
        />
      </Card>

      {/* Research — HMM regime analysis and trend forecast */}
      <Card marginBottom={16}>
        <CardLabel marginBottom={12}>RESEARCH</CardLabel>
        <ResearchSection symbol={symbol} />
      </Card>

      {/* Options entry suggestions — data-driven CSP / covered-call strikes */}
      <Card marginBottom={16}>
        <CardLabel marginBottom={12}>OPTIONS ENTRY SUGGESTIONS</CardLabel>
        <WheelAnalysisPanel symbol={symbol} />
      </Card>
    </div>
  );
}
