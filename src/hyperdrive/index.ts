import { CloudflareError } from '../errors/index.js'

export interface HyperdriveOptions<C> {
	/** Open a client from the connection string, e.g. `(cs) => postgres(cs)` or `async (cs) => { const c = new Client({ connectionString: cs }); await c.connect(); return c }`. */
	connect: (connectionString: string) => C | Promise<C>
	/** Close the client, e.g. `(sql) => sql.end()`. */
	close: (client: C) => unknown
	/** When passed, `close` runs in `ctx.waitUntil` after `work` settles instead of being awaited. */
	ctx?: ExecutionContext
}

/**
 * Open a per-request client over a Hyperdrive binding, run `work`, and always
 * close the client, whether `work` resolves or throws. Hyperdrive pools the
 * connections, so don't cache the client across requests. The driver is yours:
 * this module doesn't bundle one.
 *
 * A failed connect throws a non-exposed 502 with code `HYPERDRIVE_CONNECT_FAILED`.
 * Errors from `work` pass through unchanged.
 *
 * @example
 * const hd = getBinding<Hyperdrive>(env, 'HYPERDRIVE')
 * const rows = await withHyperdrive(hd, { connect: (cs) => postgres(cs), close: (sql) => sql.end(), ctx },
 *   (sql) => sql`SELECT * FROM users WHERE id = ${id}`)
 */
export async function withHyperdrive<C, R>(
	hyperdrive: Hyperdrive,
	options: HyperdriveOptions<C>,
	work: (client: C) => Promise<R>
): Promise<R> {
	let client: C
	try {
		client = await options.connect(hyperdrive.connectionString)
	} catch (cause) {
		throw new CloudflareError('Hyperdrive connect failed', {
			status: 502,
			expose: false,
			code: 'HYPERDRIVE_CONNECT_FAILED',
			cause,
		})
	}
	try {
		return await work(client)
	} finally {
		if (options.ctx) {
			options.ctx.waitUntil(
				Promise.resolve()
					.then(() => options.close(client))
					.catch(() => {})
			)
		} else {
			try {
				await options.close(client)
			} catch {
				// ponytail: a failed close is dropped on purpose, so it can't replace work's result or error.
			}
		}
	}
}
