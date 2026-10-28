import { NextFunction, Request, Response } from 'express';
import { clearTtlCaches } from '../utils/ttl-cache';

/**
 * Micro-cache for the anonymous, read-only public API (home, lists, menus, settings, galleries ...).
 * A burst of visitors hitting the same page costs ONE database round-trip per TTL instead of one per visitor.
 *
 *  - only GET, only visitors without a token (logged-in users may see members-only records and are never cached)
 *  - only 200 responses, only the routes in CACHEABLE (not the article page: it counts views; not /home: it shuffles
 *    its random sections on every load, so its queries are cached in the service instead, see ttl-cache.ts)
 *  - the key includes the language header, so Arabic and English never mix
 *  - the whole cache is dropped as soon as ANY write request succeeds, so admin edits show up immediately
 *    (the TTL only covers scheduled publishing and other instances)
 *  - bounded in entries and bytes; the cached body is the final JSON the client would have received
 */
const CACHEABLE = /^\/api\/public\/(settings|news|categories|search|sections\/[^/]+|cities|countries|ads|gallery(\/\d+)?|occasions(\/\d+)?)\/?$/;
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_ENTRIES = 500;
const MAX_BODY_BYTES = 512 * 1024;

interface Entry {
  at: number;
  body: string;
  type: string;
}

export function createPublicCache(ttlMs = Number(process.env.PUBLIC_CACHE_TTL_MS ?? 15_000)) {
  const store = new Map<string, Entry>();
  const enabled = ttlMs > 0;

  return function publicCache(req: Request, res: Response, next: NextFunction) {
    if (!enabled) return next();

    if (WRITE.has(req.method)) {
      // after a successful write nothing cached may be older than the change
      res.on('finish', () => {
        if (res.statusCode < 400) {
          store.clear();
          clearTtlCaches();
        }
      });
      return next();
    }
    if (req.method !== 'GET') return next();

    const path = req.path;
    const hasToken = !!req.headers.authorization || !!(req as any).cookies?.access_token;
    // /api/public/news is the list; /api/public/news/:id (view counter) is deliberately not in the pattern
    if (hasToken || !CACHEABLE.test(path)) return next();

    const key = `${req.originalUrl}|${String(req.headers['x-lang'] ?? '').toLowerCase()}|${String(req.headers['accept-language'] ?? '').slice(0, 2).toLowerCase()}`;
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      res.setHeader('X-Cache', 'HIT');
      res.type(hit.type);
      res.send(hit.body); // express adds the ETag and answers 304 itself when the client already has it
      return;
    }

    // capture the final body of this response
    const send = res.send.bind(res);
    res.send = ((body?: any) => {
      if (res.statusCode === 200 && typeof body === 'string' && Buffer.byteLength(body) <= MAX_BODY_BYTES) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
        store.set(key, { at: Date.now(), body, type: String(res.getHeader('Content-Type') ?? 'application/json') });
      }
      res.setHeader('X-Cache', 'MISS');
      return send(body);
    }) as Response['send'];
    next();
  };
}
