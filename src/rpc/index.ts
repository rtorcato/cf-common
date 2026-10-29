import { type Env, getBinding } from '../env/index.js'
import { CloudflareError } from '../errors/index.js'

/**
 * What a service binding can point at: a `WorkerEntrypoint` class or instance
 * type, or a plain `export default { fetch }` handler.
 */
export type ServiceTarget =
	| (new (
			...args: any[]
	  ) => Rpc.WorkerEntrypointBranded)
	| Rpc.WorkerEntrypointBranded
	| ExportedHandler<any, any, any>
	| undefined

/**
 * Read a service binding from `env`, typed by the callee's entrypoint. Name the
 * entrypoint class (or instance type) and its public methods become awaitable
 * RPC calls; `fetch` is there too. Throws a non-exposed 500 when the binding is
 * missing (a deploy misconfiguration; see `getBinding`).
 *
 * Import the callee's class as a type only, so its code isn't bundled into the
 * caller:
 *
 * @example
 * import type { AuthService } from '@acme/auth-worker'
 *
 * const auth = getService<typeof AuthService>(env, 'AUTH')
 * const user = await auth.verify(token)
 */
export function getService<T extends ServiceTarget = undefined>(
	env: Env,
	name: string
): Service<T> {
	return getBinding<Service<T>>(env, name)
}

/**
 * Run an RPC call and map any failure (callee threw, binding unreachable,
 * callee exceeded its limits) to a non-exposed 502 with code `RPC_CALL_FAILED`,
 * keeping the original error as `cause`. `label` names the service in the
 * message and logs.
 *
 * A callee's own status doesn't cross the RPC boundary, so a callee that wants
 * to report an expected failure (not found, invalid input) should return a
 * result value rather than throw.
 *
 * @example
 * const user = await callService('AUTH', () => auth.verify(token))
 */
export async function callService<R>(label: string, call: () => Promise<R> | R): Promise<R> {
	try {
		return await call()
	} catch (cause) {
		throw new CloudflareError(`RPC call to ${label} failed`, {
			status: 502,
			expose: false,
			code: 'RPC_CALL_FAILED',
			cause,
		})
	}
}
