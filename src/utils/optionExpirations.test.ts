import { describe, expect, it } from "vitest";
import { buildExpirationPickerList } from "./optionExpirations";

describe("buildExpirationPickerList", () => {
  const from = new Date("2026-07-22T10:00:00"); // Wednesday

  it("includes default Friday, up to 5 prior, and 5 future expirations", () => {
    const listed = [
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-27",
      "2026-07-29",
      "2026-07-31",
      "2026-08-07",
      "2026-08-14",
      "2026-08-21",
      "2026-08-28",
      "2026-09-04",
      "2026-09-11",
    ];
    const { dates, defaultExpiration } = buildExpirationPickerList(listed, from);
    expect(defaultExpiration).toBe("2026-07-24");
    expect(dates).toEqual([
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-27",
      "2026-07-29",
      "2026-07-31",
      "2026-08-07",
      "2026-08-14",
    ]);
  });

  it("caps at 11 dates and always includes default Friday", () => {
    const listed = Array.from({ length: 30 }, (_, i) => {
      const d = new Date("2026-07-22T12:00:00");
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const { dates, defaultExpiration } = buildExpirationPickerList(listed, from);
    expect(defaultExpiration).toBe("2026-07-24");
    expect(dates.length).toBeLessThanOrEqual(11);
    expect(dates).toContain("2026-07-24");
  });

  it("includes default Friday when not in listed chain", () => {
    const { dates, defaultExpiration } = buildExpirationPickerList(
      ["2026-07-31", "2026-08-07"],
      from,
    );
    expect(defaultExpiration).toBe("2026-07-24");
    expect(dates).toContain("2026-07-24");
  });
});
