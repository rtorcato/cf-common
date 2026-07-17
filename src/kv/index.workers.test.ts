import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createKvStore } from './index'

// The reference binding test: runs on the workers pool (vitest.workers.config.ts)
// against a real Miniflare-backed KVNamespace, so it exercises the actual
// put/get/list/delete semantics rather than a mock. Each binding module (r2, d1)
// should copy this shape for its realistic coverage.
describe('kv store (workers pool)', () => {
	it('round-trips a JSON value through a real KV binding', async () => {
		const store = createKvStore<{ hits: number }>(env.TEST_KV)
		expect(await store.get('missing')).toBeNull()
		await store.put('counter', { hits: 1 })
		expect(await store.get('counter')).toEqual({ hits: 1 })
	})

	it('lists keys and deletes them', async () => {
		const store = createKvStore<number>(env.TEST_KV)
		await store.put('a', 1)
		await store.put('b', 2)
		const { keys } = await store.list()
		expect(keys.map((k) => k.name)).toEqual(expect.arrayContaining(['a', 'b']))
		await store.delete('a')
		expect(await store.get('a')).toBeNull()
	})
})
