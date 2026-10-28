/**
 * Tiny in-memory TTL cache for expensive read queries (per process).
 * Every cache registered here is emptied by clearTtlCaches(), which the public-cache middleware calls after any
 * successful write request, so edits made in the admin area show up on the site immediately.
 */
const stores = new Set<Map<string, { at: number; value: unknown }>>();

export function ttlCache<T>(ttlMs: number, max = 200) {
  const store = new Map<string, { at: number; value: unknown }>();
  stores.add(store);
  const pending = new Map<string, Promise<T>>();
  return async (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    // concurrent misses for the same key share one query
    let p = pending.get(key);
    if (!p) {
      p = load()
        .then((value) => {
          if (store.size >= max) store.delete(store.keys().next().value as string);
          store.set(key, { at: Date.now(), value });
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, p);
    }
    return p;
  };
}

export function clearTtlCaches() {
  for (const s of stores) s.clear();
}
