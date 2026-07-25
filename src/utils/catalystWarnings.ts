import type { CatalystEvent } from "../types";

/**
 * Warnings derived from upcoming catalysts relative to an option expiration.
 */
export function catalystWarningsForExpiry(
  events: CatalystEvent[],
  expiration: string,
  optionType: "call" | "put",
): string[] {
  const warnings: string[] = [];
  if (!expiration) return warnings;

  const exp = new Date(`${expiration}T16:00:00`);
  if (Number.isNaN(exp.getTime())) return warnings;

  for (const e of events) {
    const d = new Date(`${e.date}T12:00:00`);
    if (Number.isNaN(d.getTime()) || d > exp) continue;

    if (e.type === "earnings") {
      warnings.push(
        `Earnings on ${e.date}${e.timing ? ` (${e.timing.toUpperCase()})` : ""} before expiration — gap / vol crush risk`,
      );
    }
    if (e.type === "ex_dividend" && optionType === "call") {
      warnings.push(
        `Ex-dividend on ${e.date} before expiration — early assignment risk on ITM calls`,
      );
    }
  }

  return warnings;
}
