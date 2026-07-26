import { describe, expect, it } from "vitest";
import { parseRetryAfterMs } from "./alpacaClient";

describe("parseRetryAfterMs", () => {
  it("parses integer seconds", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("caps long waits at 60s", () => {
    expect(parseRetryAfterMs("120")).toBe(60_000);
  });

  it("returns null for missing or invalid", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("")).toBeNull();
    expect(parseRetryAfterMs("not-a-date")).toBeNull();
  });
});
