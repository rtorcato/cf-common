import { describe, expect, it, vi } from 'vitest'
import { type CloudflareError, isCloudflareError } from '../errors/index'
import { createVectorStore } from './index'

// A stand-in for the Vectorize binding: every method is a spy.
function fakeIndex() {
	return {
		upsert: vi.fn(),
		query: vi.fn(async () => ({ matches: [{ id: 'a', score: 0.9 }], count: 1 })),
		queryById: vi.fn(async () => ({ matches: [], count: 0 })),
		getByIds: vi.fn(async () => [{ id: 'a', values: [0.1] }]),
		deleteByIds: vi.fn(async () => ({ mutationId: 'del-1' })),
	}
}

// Resolves with the rejection, and fails the test if the promise resolves.
async function caught(promise: Promise<unknown>): Promise<CloudflareError> {
	const err = await promise.then(
		() => {
			throw new Error('expected a rejection')
		},
		(e: unknown) => e
	)
	if (!isCloudflareError(err)) throw new Error(`expected a CloudflareError, got ${String(err)}`)
	return err
}

describe('vectorize module', () => {
	it('upsert splits 2,500 vectors into 1000, 1000 and 500, and returns the mutation ids in order', async () => {
		const index = fakeIndex()
		index.upsert
			.mockResolvedValueOnce({ mutationId: 'm1' })
			.mockResolvedValueOnce({ mutationId: 'm2' })
			.mockResolvedValueOnce({ mutationId: 'm3' })
		const store = createVectorStore(index as unknown as Vectorize)
		const vectors = Array.from({ length: 2500 }, (_, i) => ({ id: `v${i}`, values: [i] }))

		const ids = await store.upsert(vectors)

		expect(ids).toEqual(['m1', 'm2', 'm3'])
		expect(index.upsert.mock.calls.map(([batch]) => batch.length)).toEqual([1000, 1000, 500])
	})

	it('upsert of an empty list returns [] and never calls the binding', async () => {
		const index = fakeIndex()
		const store = createVectorStore(index as unknown as Vectorize)

		expect(await store.upsert([])).toEqual([])
		expect(index.upsert).not.toHaveBeenCalled()
	})

	it('upsert stops at the first failed chunk, so the third chunk is never sent', async () => {
		const index = fakeIndex()
		const upstream = new Error('vectorize unavailable')
		index.upsert.mockResolvedValueOnce({ mutationId: 'm1' }).mockRejectedValueOnce(upstream)
		const store = createVectorStore(index as unknown as Vectorize)
		const vectors = Array.from({ length: 2500 }, (_, i) => ({ id: `v${i}`, values: [i] }))

		const err = await caught(store.upsert(vectors))

		expect(err.status).toBe(502)
		expect(err.expose).toBe(false)
		expect(err.code).toBe('VECTORIZE_FAILED')
		expect(err.cause).toBe(upstream)
		expect(index.upsert).toHaveBeenCalledTimes(2)
	})

	it('query and queryById forward their arguments and return the matches', async () => {
		const index = fakeIndex()
		const store = createVectorStore(index as unknown as Vectorize)
		const options = { topK: 5, returnMetadata: 'all' as const }

		const byVector = await store.query([0.1, 0.2], options)
		const byId = await store.queryById('a', options)

		expect(index.query).toHaveBeenCalledWith([0.1, 0.2], options)
		expect(byVector).toEqual({ matches: [{ id: 'a', score: 0.9 }], count: 1 })
		expect(index.queryById).toHaveBeenCalledWith('a', options)
		expect(byId).toEqual({ matches: [], count: 0 })
	})

	it('getByIds passes the ids through, and deleteByIds returns the mutation id', async () => {
		const index = fakeIndex()
		const store = createVectorStore(index as unknown as Vectorize)

		expect(await store.getByIds(['a'])).toEqual([{ id: 'a', values: [0.1] }])
		expect(index.getByIds).toHaveBeenCalledWith(['a'])
		expect(await store.deleteByIds(['a'])).toBe('del-1')
		expect(index.deleteByIds).toHaveBeenCalledWith(['a'])
	})

	it.each([
		['upsert', (s: ReturnType<typeof createVectorStore>) => s.upsert([{ id: 'a', values: [1] }])],
		['query', (s: ReturnType<typeof createVectorStore>) => s.query([1])],
		['queryById', (s: ReturnType<typeof createVectorStore>) => s.queryById('a')],
		['getByIds', (s: ReturnType<typeof createVectorStore>) => s.getByIds(['a'])],
		['deleteByIds', (s: ReturnType<typeof createVectorStore>) => s.deleteByIds(['a'])],
	])('%s maps a rejection to a non-exposed VECTORIZE_FAILED 502', async (method, call) => {
		const index = fakeIndex()
		for (const fn of Object.values(index)) fn.mockRejectedValue(new Error('boom'))
		const store = createVectorStore(index as unknown as Vectorize)

		const err = await caught(call(store))

		expect(err.message).toBe(`Vectorize ${method} failed`)
		expect(err.status).toBe(502)
		expect(err.expose).toBe(false)
		expect(err.code).toBe('VECTORIZE_FAILED')
	})
})
