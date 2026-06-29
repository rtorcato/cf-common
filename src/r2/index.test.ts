import { describe, expect, it, vi } from 'vitest'
import { CloudflareError } from '../errors/index'
import { createR2Store, multipartUpload } from './index'

// Minimal in-memory R2Bucket fake — real binding tests land with #22.
function fakeR2() {
	const store = new Map<string, string>()
	const put = vi.fn(async (key: string, value: string) => {
		store.set(key, value)
		return { key } as R2Object
	})
	const bucket = {
		get: async (key: string) => {
			if (!store.has(key)) return null
			const raw = store.get(key) as string
			return { key, json: async <T>() => JSON.parse(raw) as T } as unknown as R2ObjectBody
		},
		put,
		head: async (key: string) => (store.has(key) ? ({ key } as R2Object) : null),
		delete: async () => undefined,
		list: async () => ({ objects: [], truncated: false }) as unknown as R2Objects,
	} as unknown as R2Bucket
	return { bucket, put }
}

describe('r2 module', () => {
	it('round-trips JSON and sets content type', async () => {
		const { bucket, put } = fakeR2()
		const docs = createR2Store<{ a: number }>(bucket)
		await docs.putJSON('d.json', { a: 1 })
		expect(put).toHaveBeenCalledWith('d.json', '{"a":1}', {
			httpMetadata: { contentType: 'application/json' },
		})
		expect(await docs.getJSON('d.json')).toEqual({ a: 1 })
	})

	it('getJSON returns null for a missing object', async () => {
		const { bucket } = fakeR2()
		expect(await createR2Store(bucket).getJSON('missing')).toBeNull()
	})

	it('multipartUpload completes parts in order', async () => {
		const complete = vi.fn(async () => ({ key: 'big' }) as R2Object)
		const uploadPart = vi.fn(
			async (n: number) => ({ partNumber: n, etag: `e${n}` }) as R2UploadedPart
		)
		const bucket = {
			createMultipartUpload: async () => ({ uploadPart, complete, abort: async () => {} }),
		} as unknown as R2Bucket
		await multipartUpload(bucket, 'big', ['a', 'b'])
		expect(uploadPart).toHaveBeenNthCalledWith(1, 1, 'a')
		expect(uploadPart).toHaveBeenNthCalledWith(2, 2, 'b')
		expect(complete).toHaveBeenCalledWith([
			{ partNumber: 1, etag: 'e1' },
			{ partNumber: 2, etag: 'e2' },
		])
	})

	it('multipartUpload aborts and wraps the error on failure', async () => {
		const abort = vi.fn(async () => {})
		const bucket = {
			createMultipartUpload: async () => ({
				uploadPart: async () => {
					throw new Error('part failed')
				},
				complete: async () => ({}) as R2Object,
				abort,
			}),
		} as unknown as R2Bucket
		await expect(multipartUpload(bucket, 'big', ['a'])).rejects.toMatchObject({
			constructor: CloudflareError,
			code: 'R2_MULTIPART_FAILED',
		})
		expect(abort).toHaveBeenCalled()
	})
})
