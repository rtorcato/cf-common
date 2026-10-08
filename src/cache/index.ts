/**
 * Build a stable cache-key `Request` from a URL and optional query params.
 * The Cache API only keys on GET requests with absolute URLs; params are sorted
 * so `{a,b}` and `{b,a}` hit the same entry.
 *
 * @example
 * const key = buildCacheKey('https://cache.internal/users', { id: 7 })
 */
export function buildCacheKey(
	url: string | URL,
	params: Record<string, string | number | boolean> = {},
): Request {
	const u = new URL(url)
	for (const k of Object.keys(params).sort()) u.searchParams.set(k, String(params[k]))
	return new Request(u.toString(), { method: 'GET' })
}

export interface CachePutOptions {
	/** Seconds the entry stays fresh (sets `Cache-Control: max-age`). */
	ttl?: number
}

/** A thin view over one `Cache` instance with TTL support. */
export interface CacheStore {
	match(key: Request | string): Promise<Response | undefined>
	put(key: Request | string, response: Response, options?: CachePutOptions): Promise<void>
	delete(key: Request | string): Promise<boolean>
}

/**
 * Wrap a `Cache` (e.g. `caches.default` or `await caches.open('name')`).
 * `put` clones nothing: pass a fresh Response, or `.clone()` it first if you
 * also return it to the client.
 *
 * @example
 * const cache = createCache(caches.default)
 * await cache.put(buildCacheKey(url), res.clone(), { ttl: 300 })
 */
export function createCache(cache: Cache): CacheStore {
	return {
		match: (key) => cache.match(key),
		async put(key, response, { ttl } = {}) {
			let res = response
			if (ttl !== undefined) {
				// Response headers may be immutable, so rebuild with the TTL applied.
				res = new Response(response.body, response)
				res.headers.set('Cache-Control', `public, max-age=${Math.max(0, Math.floor(ttl))}`)
			}
			await cache.put(key, res)
		},
		delete: (key) => cache.delete(key),
	}
}
