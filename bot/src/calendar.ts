/**
 * ET calendar helpers for the weekly entry window.
 *
 * Mon (at/after open) or Tue → sell-to-open for this week's Friday.
 * Wed–Fri (before that Friday's close) → wait until next Monday open
 *   (then target the following Friday).
 * Weekend / Mon pre-open → wait until Monday 9:30 ET.
 */

export const ET = "America/New_York";

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface EtClock {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

export function etWallClock(from: Date = new Date()): EtClock {
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

/** Format YYYY-MM-DD from ET calendar fields (not local machine TZ). */
export function toEtDateString(et: Pick<EtClock, "year" | "month" | "day">): string {
  const m = String(et.month).padStart(2, "0");
  const d = String(et.day).padStart(2, "0");
  return `${et.year}-${m}-${d}`;
}

export function toDateString(d: Date): string {
  return toEtDateString(etWallClock(d));
}

function addCalendarDays(year: number, month: number, day: number, days: number): {
  year: number;
  month: number;
  day: number;
} {
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** 9:30 AM ET on the given calendar date as a UTC instant. */
export function marketOpenEt(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  for (let utcHour = 12; utcHour <= 15; utcHour++) {
    for (const utcMinute of [0, 30]) {
      const candidate = new Date(Date.UTC(y, m - 1, d, utcHour, utcMinute, 0));
      const et = etWallClock(candidate);
      if (
        et.year === y &&
        et.month === m &&
        et.day === d &&
        et.hour === 9 &&
        et.minute === 30
      ) {
        return candidate;
      }
    }
  }
  return new Date(Date.UTC(y, m - 1, d, 13, 30, 0));
}

/** 4:00 PM ET on `dateStr` as a UTC instant. */
export function marketCloseEt(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  for (let utcHour = 19; utcHour <= 22; utcHour++) {
    for (const utcMinute of [0, 30]) {
      const candidate = new Date(Date.UTC(y, m - 1, d, utcHour, utcMinute, 0));
      const et = etWallClock(candidate);
      if (
        et.year === y &&
        et.month === m &&
        et.day === d &&
        et.hour === 16 &&
        et.minute === 0
      ) {
        return candidate;
      }
    }
  }
  return new Date(Date.UTC(y, m - 1, d, 21, 0, 0));
}

/** Friday of the ET week containing `from` (may be in the past if after Friday). */
export function fridayOfWeek(from: Date = new Date()): string {
  const et = etWallClock(from);
  const daysToFri = (5 - et.weekday + 7) % 7;
  const fri = addCalendarDays(et.year, et.month, et.day, daysToFri);
  return toEtDateString(fri);
}

/** Upcoming Friday expiration: same-day Friday before 4pm ET; else next Friday. */
export function nextFriday(from: Date = new Date()): string {
  const et = etWallClock(from);
  let daysToAdd = (5 - et.weekday + 7) % 7;
  const afterClose = et.hour > 16 || (et.hour === 16 && et.minute >= 0);
  if (daysToAdd === 0 && afterClose) daysToAdd = 7;
  const fri = addCalendarDays(et.year, et.month, et.day, daysToAdd);
  return toEtDateString(fri);
}

/** Whole calendar days until expiration at 4pm ET, floored at 1. */
export function dteUntil(expiration: string, from: Date = new Date()): number {
  const exp = marketCloseEt(expiration);
  const ms = exp.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function isRegularSession(from: Date = new Date()): boolean {
  const et = etWallClock(from);
  if (et.weekday === 0 || et.weekday === 6) return false;
  const mins = et.hour * 60 + et.minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** Next Monday 9:30 ET strictly after `from` if today is already past that open. */
export function nextMondayOpen(from: Date = new Date()): Date {
  const et = etWallClock(from);
  let daysToMon = (1 - et.weekday + 7) % 7;
  if (daysToMon === 0) {
    const open = marketOpenEt(toEtDateString(et));
    if (from.getTime() < open.getTime()) return open;
    daysToMon = 7;
  }
  const mon = addCalendarDays(et.year, et.month, et.day, daysToMon);
  return marketOpenEt(toEtDateString(mon));
}

export type EntryDecision =
  | { action: "run"; targetFriday: string; reason: string }
  | { action: "wait"; until: Date; reason: string };

/**
 * Decide whether to run a sell-to-open cycle now.
 *
 * Mon (session open or later same day) / Tue → this week's Friday.
 * Wed–Fri → wait until next Monday (then following Friday).
 * Weekend / Mon pre-open → wait until Monday open.
 */
export function decideEntry(from: Date = new Date()): EntryDecision {
  const et = etWallClock(from);
  const thisFri = fridayOfWeek(from);

  if (et.weekday === 0 || et.weekday === 6) {
    const until = nextMondayOpen(from);
    return {
      action: "wait",
      until,
      reason: `Weekend — wait until Monday open (${until.toISOString()})`,
    };
  }

  if (et.weekday === 1) {
    const open = marketOpenEt(toEtDateString(et));
    if (from.getTime() < open.getTime()) {
      return {
        action: "wait",
        until: open,
        reason: `Monday pre-open — wait until ${open.toISOString()}`,
      };
    }
    return {
      action: "run",
      targetFriday: thisFri,
      reason: `Monday entry window → target Friday ${thisFri}`,
    };
  }

  if (et.weekday === 2) {
    return {
      action: "run",
      targetFriday: thisFri,
      reason: `Tuesday entry window → target Friday ${thisFri}`,
    };
  }

  // Wed / Thu / Fri — defer to next Monday; that cycle targets the Friday of that week
  const until = nextMondayOpen(from);
  const nextWeekFri = (() => {
    const monEt = etWallClock(until);
    const fri = addCalendarDays(monEt.year, monEt.month, monEt.day, 4);
    return toEtDateString(fri);
  })();

  return {
    action: "wait",
    until,
    reason: `Wed–Fri deferral — wait until Monday open; next target Friday ${nextWeekFri}`,
  };
}

const MAX_SLEEP_CHUNK_MS = 60_000;

/** Sleep until `until`, in interruptible chunks. */
export async function sleepUntil(
  until: Date,
  opts?: { signal?: AbortSignal; onChunk?: (remainingMs: number) => void },
): Promise<void> {
  while (true) {
    if (opts?.signal?.aborted) throw new Error("sleep aborted");
    const remaining = until.getTime() - Date.now();
    if (remaining <= 0) return;
    opts?.onChunk?.(remaining);
    const chunk = Math.min(remaining, MAX_SLEEP_CHUNK_MS);
    await sleep(chunk, opts?.signal);
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}
