import { CloudflareError } from '../errors/index.js'

/** Value types accepted by the R2 binding's `put`/`uploadPart`. */
export type R2PutValue = ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null

/**
 * A typed view over a single `R2Bucket` binding. Raw object methods pass
 * straight through; the `*JSON` helpers (de)serialize and set the content type.
 *
 * Note: presigned URLs are intentionally not here — they require the S3-compatible
 * API with account credentials and SigV4 signing, which is a separate concern.
 */
export interface R2Store<T> {
	get(key: string): Promise<R2ObjectBody | null>
	getJSON(key: string): Promise<T | null>
	put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<R2Object | null>
	putJSON(key: string, value: T, options?: R2PutOptions): Promise<R2Object | null>
	head(key: string): Promise<R2Object | null>
	delete(keys: string | string[]): Promise<void>
	list(options?: R2ListOptions): Promise<R2Objects>
}

/**
 * Wrap an `R2Bucket` binding as a typed store with JSON convenience helpers.
 *
 * @example
 * const docs = createR2Store<Doc>(env.DOCS)
 * await docs.putJSON('a.json', doc)
 * const doc = await docs.getJSON('a.json') // Doc | null
 */
export function createR2Store<T = unknown>(bucket: R2Bucket): R2Store<T> {
	return {
		get: (key) => bucket.get(key),
		async getJSON(key) {
			const object = await bucket.get(key)
			if (object === null) return null
			try {
				return await object.json<T>()
			} catch (cause) {
				throw new CloudflareError(`R2 object "${key}" is not valid JSON`, {
					code: 'R2_PARSE_FAILED',
					cause,
				})
			}
		},
		put: (key, value, options) => bucket.put(key, value, options),
		putJSON: (key, value, options) =>
			bucket.put(key, JSON.stringify(value), {
				httpMetadata: { contentType: 'application/json' },
				...options,
			}),
		head: (key) => bucket.head(key),
		delete: (keys) => bucket.delete(keys),
		list: (options) => bucket.list(options),
	}
}

/**
 * Drive a complete multipart upload: create → upload each part → complete,
 * aborting the upload if any part fails. Parts must be pre-chunked by the
 * caller (every part except the last must be ≥ 5 MiB, per R2's limits).
 */
export async function multipartUpload(
	bucket: R2Bucket,
	key: string,
	parts: Array<Exclude<R2PutValue, null>>,
	options?: R2MultipartOptions
): Promise<R2Object> {
	const upload = await bucket.createMultipartUpload(key, options)
	try {
		const uploaded = await Promise.all(parts.map((part, i) => upload.uploadPart(i + 1, part)))
		return await upload.complete(uploaded)
	} catch (cause) {
		await upload.abort().catch(() => {})
		throw new CloudflareError(`R2 multipart upload failed for "${key}"`, {
			code: 'R2_MULTIPART_FAILED',
			cause,
		})
	}
}
