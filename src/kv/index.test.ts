import { describe, expect, it, vi } from 'vitest'
import { CloudflareError } from '../errors/index'
import { createKvStore } from './index'

// Minimal in-memory KVNamespace fake — real binding tests land with the
// vitest-pool-workers harness (#22).
function fakeKv() {
	const store = new Map<string, string>()
	const put = vi.fn(async (key: string, value: string) => {
		store.set(key, value)
	})
	const ns = {
		get: async (key: string) => store.get(key) ?? null,
		put,
		delete: async (key: string) => {
			store.delete(key)
		},
		list: async () => ({
			keys: [...store.keys()].map((name) => ({ name })),
			list_complete: true,
			cacheStatus: null,
		}),
	} as unknown as KVNamespace
	return { ns, put }
}

describe('kv module', () => {
	it('round-trips JSON values', async () => {
		const { ns } = fakeKv()
		const users = createKvStore<{ name: string }>(ns)
		await users.put('u1', { name: 'ada' })
		expect(await users.get('u1')).toEqual({ name: 'ada' })
	})

	it('returns null for a missing key', async () => {
		const { ns } = fakeKv()
		expect(await createKvStore(ns).get('nope')).toBeNull()
	})

	it('maps ttl to expirationTtl', async () => {
		const { ns, put } = fakeKv()
		await createKvStore(ns).put('k', { a: 1 }, { ttl: 60 })
		expect(put).toHaveBeenCalledWith('k', '{"a":1}', { expirationTtl: 60 })
	})

	it('throws a coded CloudflareError on invalid JSON', async () => {
		const { ns } = fakeKv()
		await ns.put('bad', 'not json{')
		await expect(createKvStore(ns).get('bad')).rejects.toMatchObject({
			constructor: CloudflareError,
			code: 'KV_PARSE_FAILED',
		})
	})
})
