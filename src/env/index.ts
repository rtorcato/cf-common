import { CloudflareError } from '../errors'

/**
 * A Workers `env` object: the bindings + vars record passed to `fetch`,
 * `scheduled`, `queue`, etc. Each binding's type is unknown until you name it.
 */
export type Env = Record<string, unknown>

/**
 * Read a binding (KV, R2, D1, queue, service, Durable Object, …) from `env` by
 * name. Throws a non-exposed 500 when it's missing — a missing binding is a
 * deploy-time misconfiguration (a forgotten `wrangler.toml` entry), never a
 * client error.
 *
 * @example
 * const kv = getBinding<KVNamespace>(env, 'SESSIONS')
 */
export function getBinding<T>(env: Env, name: string): T {
	const value = env[name]
	if (value === undefined || value === null) {
		throw new CloudflareError(`Missing Cloudflare binding: ${name}`, {
			status: 500,
			expose: false,
		})
	}
	return value as T
}

/**
 * Read a required string var/secret from `env`. Throws a non-exposed 500 when
 * it is unset or empty.
 */
export function requireEnv(env: Env, name: string): string {
	const value = env[name]
	if (typeof value !== 'string' || value === '') {
		throw new CloudflareError(`Missing or empty env var: ${name}`, {
			status: 500,
			expose: false,
		})
	}
	return value
}

/**
 * Read an optional string var from `env`, returning `fallback` (default
 * `undefined`) when it is unset or empty.
 */
export function getEnv(env: Env, name: string, fallback?: string): string | undefined {
	const value = env[name]
	return typeof value === 'string' && value !== '' ? value : fallback
}
