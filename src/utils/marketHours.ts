// US equities regular session: 9:30 AM – 4:00 PM ET, Monday–Friday
export function isMarketOpen(): boolean {
  const etString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etString);
  const day = et.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** Poll open orders every 5s during regular session; off-hours ticks are skipped. */
export const ORDER_STATUS_POLL_MS = 5000;

/** Background position refresh while desk orders are working (same cadence). */
export const PENDING_ORDER_POSITION_POLL_MS = 5000;

/** Default refresh when no working orders. */
export const POSITIONS_POLL_MS = 5 * 60 * 1000;
