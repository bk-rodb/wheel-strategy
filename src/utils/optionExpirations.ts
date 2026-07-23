import { nextFriday, toDateString } from "./nextFriday";

/** Build the expiration picker list (max 11): default Friday, +5 after, +up to 5 prior. */
export function buildExpirationPickerList(
  listed: string[],
  from: Date = new Date(),
): { dates: string[]; defaultExpiration: string } {
  const today = toDateString(from);
  const defaultExpiration = toDateString(nextFriday(from));

  const available = [...new Set(listed.filter((d) => d >= today))].sort();

  const prior = available.filter((d) => d < defaultExpiration).slice(-5);
  const afterDefault = available.filter((d) => d > defaultExpiration).slice(0, 5);

  const dates = [...new Set([...prior, defaultExpiration, ...afterDefault])].sort();
  return { dates: dates.slice(0, 11), defaultExpiration };
}

/** Mock listed expirations for dev without Alpaca keys. */
export function mockListedExpirations(from: Date = new Date()): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    // Weeklies plus Mon/Wed dailies (common for liquid names like NVDA).
    if (dow === 5 || dow === 1 || dow === 3) {
      dates.push(toDateString(d));
    }
  }
  return dates;
}
