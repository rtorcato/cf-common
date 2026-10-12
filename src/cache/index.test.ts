import { describe, expect, it } from 'vitest'
import { buildCacheKey, createCache } from './index'

function fakeCache() {
	const store = new Map<string, Response>()
	const url = (k: Request | string) => (typeof k === 'string' ? k : k.url)
	return {
		match: async (k: Request | string) => store.get(url(k)),
		put: async (k: Request | string, r: Response) => void store.set(url(k), r),
		delete: async (k: Request | string) => store.delete(url(k)),
	} as unknown as Cache
}

describe('cache module', () => {
	it('builds order-independent keys', () => {
		const a = buildCacheKey('https://x.test/p', { b: 2, a: 1 })
		const b = buildCacheKey('https://x.test/p', { a: 1, b: 2 })
		expect(a.url).toBe(b.url)
		expect(a.url).toBe('https://x.test/p?a=1&b=2')
	})

	it('round-trips and applies ttl as max-age', async () => {
		const cache = createCache(fakeCache())
		const key = buildCacheKey('https://x.test/p')
		await cache.put(key, new Response('hi'), { ttl: 60 })
		const hit = await cache.match(key)
		expect(await hit?.text()).toBe('hi')
		expect(hit?.headers.get('Cache-Control')).toBe('public, max-age=60')
	})

	it('leaves headers alone without ttl and deletes', async () => {
		const cache = createCache(fakeCache())
		await cache.put('https://x.test/q', new Response('a'))
		expect((await cache.match('https://x.test/q'))?.headers.get('Cache-Control')).toBeNull()
		expect(await cache.delete('https://x.test/q')).toBe(true)
		expect(await cache.match('https://x.test/q')).toBeUndefined()
	})
})
