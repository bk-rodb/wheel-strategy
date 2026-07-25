import type { CatalystEvent, NewsItem } from "../types";

/** Static macro events (FOMC, CPI) — update quarterly. */
export const MACRO_EVENTS: CatalystEvent[] = [
  { id: "fomc-jul-2026", type: "macro", scope: "market", date: "2026-07-29", title: "FOMC rate decision", detail: "Federal Reserve policy announcement" },
  { id: "cpi-aug-2026", type: "macro", scope: "market", date: "2026-08-12", title: "CPI release", detail: "Consumer Price Index (Jul)" },
  { id: "jobs-aug-2026", type: "macro", scope: "market", date: "2026-08-07", title: "Nonfarm payrolls", detail: "US employment report" },
  { id: "fomc-sep-2026", type: "macro", scope: "market", date: "2026-09-16", title: "FOMC rate decision", detail: "Federal Reserve policy announcement" },
];

const MOCK_EVENTS: Record<string, CatalystEvent[]> = {
  NVDA: [
    {
      id: "nvda-earnings",
      type: "earnings",
      scope: "symbol",
      date: "2026-08-20",
      title: "Q2 earnings",
      detail: "After market close",
      timing: "amc",
      conflictsWithExpiry: false,
    },
    {
      id: "nvda-div",
      type: "ex_dividend",
      scope: "symbol",
      date: "2026-09-04",
      title: "Ex-dividend",
      detail: "Est. yield 0.03%",
      yieldPct: 0.03,
    },
  ],
  AAPL: [
    {
      id: "aapl-earnings",
      type: "earnings",
      scope: "symbol",
      date: "2026-07-31",
      title: "Q3 earnings",
      detail: "After market close",
      timing: "amc",
      conflictsWithExpiry: true,
    },
  ],
  AMZN: [
    {
      id: "amzn-earnings",
      type: "earnings",
      scope: "symbol",
      date: "2026-08-01",
      title: "Q2 earnings",
      detail: "After market close",
      timing: "amc",
    },
  ],
};

const MOCK_NEWS: Record<string, NewsItem[]> = {
  NVDA: [
    {
      id: "nvda-n1",
      headline: "NVIDIA data-center demand remains strong ahead of earnings",
      source: "Reuters",
      url: "https://example.com/nvda-1",
      publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
    {
      id: "nvda-n2",
      headline: "Analysts raise price targets on AI chip momentum",
      source: "Bloomberg",
      url: "https://example.com/nvda-2",
      publishedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
    },
  ],
  AAPL: [
    {
      id: "aapl-n1",
      headline: "Apple services revenue growth in focus ahead of report",
      source: "CNBC",
      url: "https://example.com/aapl-1",
      publishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    },
  ],
};

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: "generic-n1",
    headline: "Markets steady as investors await Fed commentary",
    source: "WSJ",
    url: "https://example.com/market-1",
    publishedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
  },
];

export function mockCatalystEvents(symbol: string): CatalystEvent[] {
  const sym = symbol.toUpperCase();
  const symbolEvents = MOCK_EVENTS[sym] ?? [
    {
      id: `${sym.toLowerCase()}-earnings`,
      type: "earnings" as const,
      scope: "symbol" as const,
      date: offsetDate(21),
      title: "Next earnings (est.)",
      detail: "Date approximate in mock mode",
      timing: "amc" as const,
    },
  ];
  return [...symbolEvents, ...upcomingMacroEvents(90)];
}

export function mockTickerNews(symbol: string): NewsItem[] {
  return MOCK_NEWS[symbol.toUpperCase()] ?? DEFAULT_NEWS;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Macro events within `withinDays` of today. */
export function upcomingMacroEvents(withinDays = 14): CatalystEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + withinDays);
  return MACRO_EVENTS.filter((e) => {
    const d = new Date(`${e.date}T12:00:00`);
    return d >= today && d <= end;
  });
}
