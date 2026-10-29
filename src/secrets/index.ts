import { type Env, getBinding } from '../env/index.js'
import { CloudflareError } from '../errors/index.js'

/**
 * Read a secret from a Cloudflare Secrets Store binding by name.
 *
 * A Secrets Store binding (`secrets_store_secrets` in wrangler config) is one
 * secret, read with an async `get()`. This looks the binding up like
 * {@link getBinding} (a missing one is a non-exposed 500) and returns the
 * secret as a string.
 *
 * A failed read (the secret was deleted, the store is unreachable) throws a
 * non-exposed 500 with code `SECRET_GET_FAILED` and the original error as
 * `cause`. The message names the binding, never the value. Nothing is cached:
 * every call reads the store, so keep the result in a variable if you need it
 * more than once per request.
 *
 * @example
 * const apiKey = await getSecret(env, 'STRIPE_KEY')
 */
export async function getSecret(env: Env, name: string): Promise<string> {
	const secret = getBinding<SecretsStoreSecret>(env, name)
	try {
		return await secret.get()
	} catch (cause) {
		throw new CloudflareError(`Failed to read secret: ${name}`, {
			status: 500,
			expose: false,
			code: 'SECRET_GET_FAILED',
			cause,
		})
	}
}
