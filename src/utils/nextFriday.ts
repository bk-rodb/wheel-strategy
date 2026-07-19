/** Format a Date as YYYY-MM-DD in local calendar time. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Upcoming Friday expiration (equity options). If today is Friday, returns today
 * (same-day expiry is still the front weekly until the close).
 */
export function nextFriday(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 5=Fri
  const add = (5 - day + 7) % 7;
  d.setDate(d.getDate() + add);
  return d;
}

/** Whole calendar days until `expiration` (YYYY-MM-DD), floored at 1 for pricing. */
export function dteUntil(expiration: string, from: Date = new Date()): number {
  const exp = new Date(`${expiration}T16:00:00`);
  const ms = exp.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
