const ET = "America/New_York";
const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function etWallClock(now: Date): { day: number; mins: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const day = WEEKDAY[get("weekday")] ?? 0;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return { day, mins: hour * 60 + minute };
}

// US equities regular session: 9:30 AM – 4:00 PM ET, Monday–Friday (no holiday calendar)
export function isMarketOpen(now: Date = new Date()): boolean {
  const { day, mins } = etWallClock(now);
  if (day === 0 || day === 6) return false;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** Poll open orders every 5s during regular session; off-hours ticks are skipped. */
export const ORDER_STATUS_POLL_MS = 5000;

/** Background position refresh while desk orders are working (same cadence). */
export const PENDING_ORDER_POSITION_POLL_MS = 5000;

/** Default refresh when no working orders. */
export const POSITIONS_POLL_MS = 5 * 60 * 1000;
