import { describe, expect, it } from "vitest";
import { isAbortError, shouldIgnoreFetchError } from "./abort";

describe("isAbortError", () => {
  it("detects DOMException AbortError", () => {
    const err = new DOMException("signal is aborted without reason", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });

  it("detects Error named AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("rejects ordinary errors", () => {
    expect(isAbortError(new Error("network"))).toBe(false);
    expect(isAbortError("aborted")).toBe(false);
  });
});

describe("shouldIgnoreFetchError", () => {
  it("ignores when the local signal was aborted", () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(shouldIgnoreFetchError(ctrl.signal)).toBe(true);
  });

  it("ignores AbortError even without a local signal", () => {
    const err = new DOMException("signal is aborted without reason", "AbortError");
    expect(shouldIgnoreFetchError(undefined, err)).toBe(true);
  });

  it("does not ignore real failures", () => {
    expect(shouldIgnoreFetchError(undefined, new Error("Analysis API → 500"))).toBe(false);
  });
});
