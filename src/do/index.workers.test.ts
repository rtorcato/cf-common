import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

// Runs on the workers pool against a real Durable Object (TestCounter in
// ./fixture.workers.ts, bound as TEST_DO), so the typed storage reads and
// writes the actual ctx.storage over RPC.
describe('BaseDurableObject (workers pool)', () => {
	it('reads undefined, then the fallback, for a key never written', async () => {
		const counter = env.TEST_DO.getByName('fresh')
		expect(await counter.peek()).toBeUndefined()
		expect(await counter.increment()).toBe(1)
	})

	it('persists writes across calls on the same object', async () => {
		const counter = env.TEST_DO.getByName('persist')
		await counter.increment(2)
		expect(await counter.increment(3)).toBe(5)
		expect(await counter.peek()).toBe(5)
	})

	it('keeps each object to its own storage', async () => {
		await env.TEST_DO.getByName('a').increment(4)
		expect(await env.TEST_DO.getByName('b').peek()).toBeUndefined()
	})

	it('reports whether delete removed the key', async () => {
		const counter = env.TEST_DO.getByName('delete')
		await counter.increment()
		expect(await counter.reset()).toBe(true)
		expect(await counter.reset()).toBe(false)
		expect(await counter.peek()).toBeUndefined()
	})
})
