import type { AccountInfo, WheelPosition } from "../types";
import { fmt, dayChange, dayChangePct } from "../utils/formatters";
import { formatAveragePricePair } from "../utils/priceAverages";
import { SOURCE_BADGE } from "../constants";
import { CatalystsAndNews } from "./CatalystsAndNews";
import { WheelPhaseIndicator } from "./WheelPhaseIndicator";
import { PriceTrendSection } from "./PriceTrendSection";
import { StatRow } from "./StatRow";
import { OpenOptionsSection } from "./OpenOptionsSection";
import { ResearchSection } from "./ResearchSection";
import { TickerHeader } from "./TickerHeader";
import { Card, CardLabel } from "./ui";
import { VolatilityBar } from "./VolatilityBar";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";
import { vars } from "../theme";

export function TickerDetail({
  pos,
  account = null,
  focusOpenOptions = false,
  onFocusOpenOptionsHandled,
  onPositionRefresh,
}: {
  pos: WheelPosition;
  account?: AccountInfo | null;
  focusOpenOptions?: boolean;
  onFocusOpenOptionsHandled?: () => void;
  onPositionRefresh?: () => void;
}) {
  return (
    <div style={{ padding: "0 4px" }}>
      <TickerHeader
        symbol={pos.ticker}
        companyName={pos.companyName}
        badge={
          <span
            style={{
              fontSize: 10,
              color: vars.text.onBrand,
              background: SOURCE_BADGE[pos.dataSource],
              padding: "2px 7px",
              borderRadius: 3,
              fontFamily: vars.font.mono,
              fontWeight: 700,
            }}
          >
            {pos.dataSource.toUpperCase()}
          </span>
        }
        subtitle={pos.sector !== "—" ? pos.sector : undefined}
        price={pos.currentPrice}
        change={dayChange(pos)}
        changePct={dayChangePct(pos)}
      />

      <div style={{ marginBottom: 20 }}>
        <WheelPhaseIndicator phase={pos.phase} />
      </div>

      <Card marginBottom={16}>
        <PriceTrendSection
          data={pos.priceHistory}
          currentPrice={pos.currentPrice}
          costBasis={pos.costBasis}
          strike={pos.activeOption?.strike}
        />
      </Card>

      <Card marginBottom={16}>
        <CatalystsAndNews symbol={pos.ticker} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <CardLabel>STOCK DETAILS</CardLabel>
          <StatRow label="Shares" value={fmt.num(pos.shares)} />
          <StatRow label="Cost Basis" value={pos.costBasis > 0 ? fmt.currency(pos.costBasis) : "—"} />
          <StatRow label="Day High" value={fmt.currency(pos.dayHigh)} />
          <StatRow label="Day Low" value={fmt.currency(pos.dayLow)} />
          <StatRow
            label="Average Price (1W/1M)"
            value={formatAveragePricePair(pos.priceHistory)}
          />
          <StatRow label="Volume" value={fmt.compact(pos.volume)} />
          {pos.marketCap > 0 && (
            <StatRow label="Market Cap" value={fmt.compact(pos.marketCap)} />
          )}
          <VolatilityBar symbol={pos.ticker} />
        </Card>
        <Card>
          <CardLabel>P&amp;L SUMMARY</CardLabel>
          <StatRow label="Cash Deployed" value={fmt.currency(pos.cashDeployed)} />
          <StatRow
            label="Unrealized P&L"
            value={fmt.currency(pos.unrealizedPnL)}
            accent={pos.unrealizedPnL >= 0}
          />
          <StatRow label="Premium Collected" value={fmt.currency(pos.premiumCollectedTotal)} accent />
          <StatRow label="Prev. Close" value={fmt.currency(pos.previousClose)} />
        </Card>
      </div>

      <Card marginBottom={16}>
        <CardLabel marginBottom={12}>RESEARCH</CardLabel>
        <ResearchSection symbol={pos.ticker} />
      </Card>

      <Card marginBottom={16}>
        <OpenOptionsSection
          symbol={pos.ticker}
          shares={pos.shares}
          costBasis={pos.costBasis}
          activeOption={pos.activeOption}
          phase={pos.phase}
          account={account}
          focusSection={focusOpenOptions}
          onFocusHandled={onFocusOpenOptionsHandled}
          onPositionRefresh={onPositionRefresh}
        />
      </Card>

      <Card marginBottom={16}>
        <CardLabel marginBottom={12}>OPTIONS ENTRY SUGGESTIONS</CardLabel>
        <WheelAnalysisPanel symbol={pos.ticker} />
      </Card>

      <div
        style={{
          fontSize: 10,
          color: vars.text.ghost,
          fontFamily: vars.font.mono,
          textAlign: "right",
        }}
      >
        UPDATED {new Date(pos.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
