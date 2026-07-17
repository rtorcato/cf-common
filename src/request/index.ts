import { CloudflareError } from '../errors/index.js'

/**
 * The request-side boilerplate every Worker repeats: reading the typed
 * `request.cf` geo/TLS metadata, validating a JSON body, and pulling the bearer
 * token / client IP out of the headers. Thin helpers — no request wrapper.
 */

/**
 * Cloudflare's per-request metadata (`country`, `colo`, `tlsVersion`, …).
 * `undefined` when unavailable — e.g. `wrangler dev` without `--remote`, or a
 * synthetic `Request` in a test.
 *
 * @example
 * const country = cf(request)?.country ?? 'unknown'
 */
export function cf(request: Request): IncomingRequestCfProperties | undefined {
	// The global `Request.cf` is typed as the broad `CfProperties` union; on an
	// inbound Worker request it is always the incoming shape, so narrow it.
	return request.cf as IncomingRequestCfProperties | undefined
}

/**
 * The minimal shape `parseJson` needs from a schema: a `parse` that returns the
 * validated value or throws. A Zod schema (`z.object({...})`) satisfies this as
 * is, as does any validator exposing the same method.
 */
export interface SchemaLike<T> {
	parse(input: unknown): T
}

/**
 * Read and validate a JSON request body. Reuses the caller's schema (bring your
 * own Zod schema) and turns both malformed JSON and a failed validation into an
 * exposed 400 {@link CloudflareError}, so `defineFetch` maps it to a clean
 * `400` without leaking internals.
 *
 * @example
 * const body = await parseJson(request, z.object({ email: z.string().email() }))
 * //    ^? { email: string }
 */
export async function parseJson<T>(request: Request, schema: SchemaLike<T>): Promise<T> {
	let raw: unknown
	try {
		raw = await request.json()
	} catch (cause) {
		throw new CloudflareError('Invalid JSON body', { status: 400, code: 'INVALID_BODY', cause })
	}
	try {
		return schema.parse(raw)
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Body failed validation'
		throw new CloudflareError(message, { status: 400, code: 'INVALID_BODY', cause })
	}
}

/**
 * Extract the token from an `Authorization: Bearer <token>` header, or `null` if
 * the header is absent or not a well-formed bearer credential. Case-insensitive
 * on the `Bearer` scheme, per RFC 6750.
 *
 * @example
 * const token = bearerToken(request)
 * if (!token) throw new CloudflareError('Missing token', { status: 401 })
 */
export function bearerToken(request: Request): string | null {
	const header = request.headers.get('Authorization')
	if (!header) return null
	const match = /^Bearer\s+(\S+)$/i.exec(header)
	return match ? match[1]! : null
}

/**
 * The client's IP from the `CF-Connecting-IP` header Cloudflare sets on every
 * request, or `null` when absent (e.g. a test without the header).
 *
 * @example
 * const ip = clientIp(request) ?? 'unknown'
 */
export function clientIp(request: Request): string | null {
	return request.headers.get('CF-Connecting-IP')
}
