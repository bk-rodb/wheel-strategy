/** True when `fetch` (or similar) was cancelled via AbortController / AbortSignal. */
export function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

/** Skip state updates when this caller was aborted or a shared in-flight request was. */
export function shouldIgnoreFetchError(signal?: AbortSignal, e?: unknown): boolean {
  return signal?.aborted === true || isAbortError(e);
}
