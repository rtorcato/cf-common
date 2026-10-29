import { CloudflareError } from '../errors/index.js'

/** Metadata shape for one index. Values follow Vectorize's rules (string | number | boolean | string[]). */
export type VectorMetadata = Record<string, VectorizeVectorMetadata>

export type TypedVector<M extends VectorMetadata> = Omit<VectorizeVector, 'metadata'> & {
	metadata?: M
}
export type TypedMatch<M extends VectorMetadata> = Omit<VectorizeMatch, 'metadata'> & {
	metadata?: M
}
export interface TypedMatches<M extends VectorMetadata> {
	matches: TypedMatch<M>[]
	count: number
}

/** A typed store over one Vectorize index. */
export interface VectorStore<M extends VectorMetadata> {
	/**
	 * Upsert in chunks of 1000 (the Workers binding limit). Returns each chunk's `mutationId`, in order.
	 * Chunks are sent in order and sending stops at the first failure, so earlier chunks stay upserted.
	 * Throws `VECTORIZE_FAILED`.
	 */
	upsert(vectors: TypedVector<M>[]): Promise<string[]>
	query(
		vector: VectorFloatArray | number[],
		options?: VectorizeQueryOptions
	): Promise<TypedMatches<M>>
	queryById(id: string, options?: VectorizeQueryOptions): Promise<TypedMatches<M>>
	getByIds(ids: string[]): Promise<TypedVector<M>[]>
	/** Returns the `mutationId`. */
	deleteByIds(ids: string[]): Promise<string>
}

/** Cloudflare's Vectorize binding accepts at most 1000 vectors per `upsert` call. */
const MAX_UPSERT = 1000

/**
 * Wrap a Vectorize index with typed metadata, chunked upserts, and failures
 * surfaced as a {@link CloudflareError}. The `M` metadata type is asserted by
 * the caller, as with `createKvStore<T>`. Nothing is validated at runtime.
 *
 * @example
 * const docs = createVectorStore<{ url: string; title: string }>(getBinding<Vectorize>(env, 'DOCS'))
 * await docs.upsert([{ id: 'a', values, metadata: { url, title } }])
 * const { matches } = await docs.query(values, { topK: 5, returnMetadata: 'all' })
 * matches[0]?.metadata?.title // string | undefined
 */
export function createVectorStore<M extends VectorMetadata = VectorMetadata>(
	index: Vectorize
): VectorStore<M> {
	return {
		async upsert(vectors) {
			const ids: string[] = []
			for (let i = 0; i < vectors.length; i += MAX_UPSERT) {
				try {
					const { mutationId } = await index.upsert(vectors.slice(i, i + MAX_UPSERT))
					ids.push(mutationId)
				} catch (cause) {
					throw failed('upsert', cause)
				}
			}
			return ids
		},
		async query(vector, options) {
			try {
				return (await index.query(vector, options)) as TypedMatches<M>
			} catch (cause) {
				throw failed('query', cause)
			}
		},
		async queryById(id, options) {
			try {
				return (await index.queryById(id, options)) as TypedMatches<M>
			} catch (cause) {
				throw failed('queryById', cause)
			}
		},
		async getByIds(ids) {
			try {
				return (await index.getByIds(ids)) as TypedVector<M>[]
			} catch (cause) {
				throw failed('getByIds', cause)
			}
		},
		async deleteByIds(ids) {
			try {
				const { mutationId } = await index.deleteByIds(ids)
				return mutationId
			} catch (cause) {
				throw failed('deleteByIds', cause)
			}
		},
	}
}

// The index is upstream of the client, so details stay in logs (like `ai`).
function failed(method: string, cause: unknown): CloudflareError {
	return new CloudflareError(`Vectorize ${method} failed`, {
		status: 502,
		expose: false,
		code: 'VECTORIZE_FAILED',
		cause,
	})
}
