/**
 * Short-TTL in-flight dedupe for identical GETs fired by multiple hooks on one tab.
 * Concurrent callers share one Promise; a successful result is reused for `ttlMs`.
 */

type Entry<T> = { promise: Promise<T>; expiresAt: number };

const cache = new Map<string, Entry<unknown>>();

export function inflightDeduped<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = 2_000,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.promise;

  const promise = factory().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

/** Test helper — clears the module cache. */
export function __clearInflightCache(): void {
  cache.clear();
}
