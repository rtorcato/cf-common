import { CloudflareError } from '../errors/index.js'

export interface KvPutOptions {
	/** Seconds until the key expires (maps to KV `expirationTtl`). */
	ttl?: number
	/** Absolute expiry as a unix timestamp in seconds (maps to KV `expiration`). */
	expiration?: number
	/** Arbitrary metadata stored alongside the value. */
	metadata?: Record<string, unknown>
}

/**
 * A typed, JSON-(de)serializing view over a single `KVNamespace` binding.
 * Values are stored as JSON; `get` returns `null` for a missing key.
 */
export interface KvStore<T> {
	get(key: string): Promise<T | null>
	put(key: string, value: T, options?: KvPutOptions): Promise<void>
	delete(key: string): Promise<void>
	list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown, string>>
}

/**
 * Wrap a `KVNamespace` binding as a typed JSON store.
 *
 * @example
 * const users = createKvStore<User>(env.USERS)
 * await users.put(id, user, { ttl: 3600 })
 * const user = await users.get(id) // User | null
 */
export function createKvStore<T = unknown>(namespace: KVNamespace): KvStore<T> {
	return {
		async get(key) {
			const raw = await namespace.get(key, 'text')
			if (raw === null) return null
			try {
				return JSON.parse(raw) as T
			} catch (cause) {
				throw new CloudflareError(`KV value for "${key}" is not valid JSON`, {
					code: 'KV_PARSE_FAILED',
					cause,
				})
			}
		},
		async put(key, value, options = {}) {
			const putOptions: KVNamespacePutOptions = {}
			if (options.ttl !== undefined) putOptions.expirationTtl = options.ttl
			if (options.expiration !== undefined) putOptions.expiration = options.expiration
			if (options.metadata !== undefined) putOptions.metadata = options.metadata
			await namespace.put(key, JSON.stringify(value), putOptions)
		},
		delete: (key) => namespace.delete(key),
		list: (options) => namespace.list(options),
	}
}
