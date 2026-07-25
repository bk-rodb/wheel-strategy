import type { ReactNode } from "react";

export interface TickerTabLabelProps {
  symbol: string;
  companyName: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
}

export function TickerTabLabel({ symbol, companyName, badge, subtitle }: TickerTabLabelProps) {
  return (
    <div className="ticker-tab-label">
      <div className="ticker-tab-label__symbol-group">
        <h2 className="ticker-tab-label__symbol">{symbol}</h2>
        {badge && <div className="ticker-tab-label__badge">{badge}</div>}
      </div>
      <div className="ticker-tab-label__company">{companyName}</div>
      {subtitle && <div className="ticker-tab-label__subtitle">{subtitle}</div>}
    </div>
  );
}
