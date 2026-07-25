import type { BalanceActivity } from "../api/fetchAccountActivities";

export const MOCK_ACCOUNT_ACTIVITIES: BalanceActivity[] = [
  {
    id: "mock-1",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    activityType: "FILL",
    label: "Sell NVDA Put 180",
    symbol: "NVDA260220P00180000",
    amount: 285,
  },
  {
    id: "mock-2",
    timestamp: new Date(Date.now() - 26 * 3600000).toISOString(),
    activityType: "DIV",
    label: "Dividend · AAPL",
    symbol: "AAPL",
    amount: 42.5,
  },
  {
    id: "mock-3",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    activityType: "FILL",
    label: "Sell AMD Call 165",
    symbol: "AMD260117C00165000",
    amount: 190,
  },
  {
    id: "mock-4",
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    activityType: "FEE",
    label: "Regulatory fee",
    amount: -0.12,
  },
  {
    id: "mock-5",
    timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
    activityType: "CSD",
    label: "Cash deposit",
    amount: 25000,
  },
];
