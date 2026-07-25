/**
 * Wheel-strategy candidates screened from QQQM and SCHD holdings (Jul 22, 2026).
 *
 * Multi-source validation:
 * - IV: Alpaca live ATM put quotes (~9–30 DTE; prefers 21–45 DTE when listed)
 * - Dividends: DRIPCalc SCHD holdings table + Slickcharts cross-check (VZ/MO/CMCSA within 0.1%)
 * - Realized vol: WheelStrategy.Api 2yr weekly realizedVolAnnual (VRP = IV − RV)
 * - IV rank context: ApexVol / Barchart screeners (ORCL, PLTR, COIN elevated in Jul 2026)
 *
 * Score within each ETF universe: 60% IV + 40% forward dividend yield.
 */
export const TARGET_WATCHLIST_NAME = "target";

export const TARGET_WATCHLIST: { symbol: string; notes?: string }[] = [
  // QQQM top 10 — validated high-IV growth/tech (Alpaca IV, Jul 2026)
  { symbol: "QCOM", notes: "QQQM+SCHD · 96% IV · 2.1% yield · RV 44%" },
  { symbol: "LRCX", notes: "QQQM · 121% IV · semi equip" },
  { symbol: "AMAT", notes: "QQQM · 132% IV · semi equip" },
  { symbol: "MRVL", notes: "QQQM · 142% IV · semi" },
  { symbol: "KLAC", notes: "QQQM · 98% IV · RV 47% (VRP +51%)" },
  { symbol: "DXCM", notes: "QQQM · 93% IV · healthcare tech" },
  { symbol: "COIN", notes: "QQQM · 92% IV · crypto proxy (Tier 2 risk)" },
  { symbol: "MSTR", notes: "QQQM · 87% IV · BTC proxy (Tier 2 risk)" },
  { symbol: "ORCL", notes: "QQQM · 81% IV · RV 54% · Barchart IV%ile >80" },
  { symbol: "CRWD", notes: "QQQM · 79% IV · cybersecurity" },
  // SCHD top 10 — validated dividend + elevated IV (DRIPCalc + Slickcharts yields)
  { symbol: "TXN", notes: "SCHD · 126% IV · 1.9% yield · RV 39%" },
  { symbol: "LMT", notes: "SCHD · 87% IV · 2.7% yield · defense" },
  { symbol: "CMCSA", notes: "SCHD · 57% IV · 5.6% yield (Slick 5.61%)" },
  { symbol: "UPS", notes: "SCHD · 51% IV · 5.7% yield" },
  { symbol: "IBM", notes: "SCHD · 106% IV · legacy tech/dividend" },
  { symbol: "MO", notes: "SCHD · 39% IV · 5.9% yield (Slick 5.88%)" },
  { symbol: "ACN", notes: "SCHD · 42% IV · 4.7% yield" },
  { symbol: "BX", notes: "SCHD · 47% IV · 3.8% yield · alt mgr" },
  { symbol: "VZ", notes: "SCHD · 33% IV · 6.4% yield (Slick 6.31%)" },
  { symbol: "BMY", notes: "SCHD · 42% IV · 4.2% yield · pharma" },
];
