/** Format a Date as YYYY-MM-DD in local calendar time. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function etWallClock(from: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(from);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAY[get("weekday")] ?? 0,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** 4:00 PM ET on `dateStr` (YYYY-MM-DD) as a UTC instant. */
export function marketCloseEt(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);

  for (let utcHour = 19; utcHour <= 22; utcHour++) {
    for (const utcMinute of [0, 30]) {
      const candidate = new Date(Date.UTC(y, m - 1, d, utcHour, utcMinute, 0));
      const et = etWallClock(candidate);
      if (et.year === y && et.month === m && et.day === d && et.hour === 16 && et.minute === 0) {
        return candidate;
      }
    }
  }

  return new Date(Date.UTC(y, m - 1, d, 21, 0, 0));
}

function addCalendarDays(year: number, month: number, day: number, days: number): Date {
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12, 0, 0, 0);
}

/**
 * Upcoming Friday expiration (equity options). Uses America/New_York: same-day
 * Friday before 4 PM ET; after the close, rolls to the following Friday.
 */
export function nextFriday(from: Date = new Date()): Date {
  const et = etWallClock(from);
  let daysToAdd = (5 - et.weekday + 7) % 7;

  const afterClose = et.hour > 16 || (et.hour === 16 && et.minute >= 0);
  if (daysToAdd === 0 && afterClose) daysToAdd = 7;

  return addCalendarDays(et.year, et.month, et.day, daysToAdd);
}

/** Whole calendar days until `expiration` (YYYY-MM-DD) at 4 PM ET, floored at 1. */
export function dteUntil(expiration: string, from: Date = new Date()): number {
  const exp = marketCloseEt(expiration);
  const ms = exp.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
