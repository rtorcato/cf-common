import { DurableObject } from 'cloudflare:workers'

/** Maps each storage key a Durable Object uses to the type of its value. */
export type StorageSchema = Record<string, unknown>

/**
 * Key-checked access to a Durable Object's storage: each key only accepts and
 * returns the value type its schema gives it. For `list`, transactions, alarms
 * or SQL, use `ctx.storage` directly.
 */
export interface TypedStorage<S extends StorageSchema> {
	/** Read a key. Resolves to `undefined` if it has never been written. */
	get<K extends keyof S & string>(key: K): Promise<S[K] | undefined>
	/** Read a key, or `fallback` if it has never been written. */
	get<K extends keyof S & string>(key: K, fallback: S[K]): Promise<S[K]>
	/** Write a key. The value is stored with structured clone, not JSON. */
	put<K extends keyof S & string>(key: K, value: S[K]): Promise<void>
	/** Delete a key. Resolves to `true` if it existed. */
	delete(key: keyof S & string): Promise<boolean>
}

/**
 * Wrap a `DurableObjectStorage` so reads and writes are checked against a
 * schema of key → value types.
 *
 * @example
 * const storage = typedStorage<{ count: number; owner: string }>(ctx.storage)
 * const count = await storage.get('count', 0)
 * await storage.put('count', count + 1)
 */
export function typedStorage<S extends StorageSchema>(
	storage: DurableObjectStorage
): TypedStorage<S> {
	return {
		async get(key: string, ...fallback: unknown[]) {
			const value = await storage.get(key)
			return value === undefined && fallback.length > 0 ? fallback[0] : value
		},
		put: (key, value) => storage.put(key, value),
		delete: (key) => storage.delete(key),
	} as TypedStorage<S>
}

/**
 * A `DurableObject` base class whose `this.storage` is a {@link TypedStorage}
 * over `ctx.storage`. It extends the runtime's `DurableObject`, so RPC methods,
 * `fetch`, `alarm` and WebSocket handlers work as usual, and `this.ctx` and
 * `this.env` are still there.
 *
 * @example
 * export class Counter extends BaseDurableObject<Env, { count: number }> {
 *   async increment(): Promise<number> {
 *     const count = (await this.storage.get('count', 0)) + 1
 *     await this.storage.put('count', count)
 *     return count
 *   }
 * }
 */
export abstract class BaseDurableObject<
	Env = Cloudflare.Env,
	S extends StorageSchema = StorageSchema,
> extends DurableObject<Env> {
	protected readonly storage: TypedStorage<S>

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.storage = typedStorage<S>(ctx.storage)
	}
}
