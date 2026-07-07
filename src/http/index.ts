import { toCloudflareError } from '../errors/index.js'

/**
 * The boilerplate every Worker repeats: a consistent JSON error envelope, CORS
 * headers, and a `fetch` wrapper that turns a thrown {@link CloudflareError}
 * into a `Response`. Deliberately not a router — pick your own for that.
 *
 * `json()` is omitted on purpose: workerd's native `Response.json(data, init)`
 * already is it.
 */

/** JSON error response with the shape `{ error }`, matching {@link errorResponse}. */
export function error(status: number, message: string): Response {
	return Response.json({ error: message }, { status })
}

/**
 * Turn any thrown value into a `Response`. {@link CloudflareError} keeps its
 * `status`/`code`; a 5xx (or non-exposed error) hides its message so internals
 * don't leak. This is the `catch` block every Worker would otherwise copy.
 */
export function errorResponse(err: unknown): Response {
	const e = toCloudflareError(err)
	return Response.json(
		{ error: e.expose ? e.message : 'Internal error', code: e.code },
		{ status: e.status }
	)
}

/** CORS configuration. Defaults are permissive (`*`) — tighten `origin` in prod. */
export interface CorsOptions {
	/** `Access-Control-Allow-Origin`. Default `*`. */
	origin?: string
	/** `Access-Control-Allow-Methods`. Default `GET,POST,OPTIONS`. */
	methods?: string
	/** `Access-Control-Allow-Headers`. Default `Content-Type`. */
	headers?: string
	/** `Access-Control-Max-Age` in seconds, for caching the preflight. */
	maxAge?: number
}

/** Build the `Access-Control-*` headers for {@link CorsOptions}. */
export function corsHeaders(options: CorsOptions = {}): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Origin': options.origin ?? '*',
		'Access-Control-Allow-Methods': options.methods ?? 'GET,POST,OPTIONS',
		'Access-Control-Allow-Headers': options.headers ?? 'Content-Type',
	}
	if (options.maxAge !== undefined) headers['Access-Control-Max-Age'] = String(options.maxAge)
	return headers
}

/** Copy `res` with CORS headers added. */
export function withCors(res: Response, options?: CorsOptions): Response {
	const merged = new Headers(res.headers)
	for (const [key, value] of Object.entries(corsHeaders(options))) merged.set(key, value)
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers: merged })
}

/** A `204` preflight response for `OPTIONS` requests. */
export function preflight(options?: CorsOptions): Response {
	return new Response(null, { status: 204, headers: corsHeaders(options) })
}

/**
 * Wrap a fetch handler so any thrown error becomes a `Response` via
 * {@link errorResponse}. Returns an `ExportedHandler` you can `export default`.
 *
 * @example
 * export default defineFetch((req, env) => {
 *   const id = requireEnv(env, 'ID') // throws CloudflareError -> mapped to a Response
 *   return Response.json({ id })
 * })
 */
export function defineFetch<Env = unknown>(
	handler: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>
): ExportedHandler<Env> {
	return {
		async fetch(request, env, ctx) {
			try {
				return await handler(request, env, ctx)
			} catch (err) {
				return errorResponse(err)
			}
		},
	}
}
