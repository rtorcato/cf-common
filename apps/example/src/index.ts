/**
 * A minimal Worker exercising every `@rtorcato/cf-common` subpath in one
 * `fetch` handler. It doubles as a copy-paste starter and a smoke test that
 * the published exports resolve and run under workerd.
 *
 * Run it with `pnpm --filter @rtorcato/cf-common-example dev`, then hit the
 * routes listed at `/`. `/`, `/env`, `/whoami`, and `/echo` work out of the
 * box; `/kv`, `/r2`, and `/d1` need their binding uncommented in
 * `wrangler.jsonc`.
 */
import { queryFirst } from '@rtorcato/cf-common/d1'
import { getEnv, requireEnv } from '@rtorcato/cf-common/env'
import { defineFetch, preflight, withCors } from '@rtorcato/cf-common/http'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { createR2Store } from '@rtorcato/cf-common/r2'
import { bearerToken, cf, clientIp, parseJson } from '@rtorcato/cf-common/request'

interface Env {
	// Index signature so the whole object is assignable to cf-common's
	// `Env` (`Record<string, unknown>`) while keeping the bindings typed.
	[key: string]: unknown
	GREETING: string
	KV?: KVNamespace
	R2?: R2Bucket
	D1?: D1Database
}

const ROUTES = ['/', '/env', '/whoami', '/echo', '/kv', '/r2', '/d1'] as const

// parseJson only needs a `.parse`, so any validator works. In a real Worker
// swap this for a Zod schema: `z.object({ name: z.string() })`.
const echoSchema = {
	parse(input: unknown): { name: string } {
		if (typeof input !== 'object' || input === null) throw new Error('body must be an object')
		if (typeof (input as { name?: unknown }).name !== 'string') {
			throw new Error('`name` (string) is required')
		}
		return input as { name: string }
	},
}

// defineFetch wraps the handler: anything that throws a CloudflareError — a
// missing var via requireEnv, a bad body via parseJson — becomes a clean JSON
// Response with the right status. No try/catch to repeat.
export default defineFetch<Env>(async (req, env) => {
	const { pathname } = new URL(req.url)

	// CORS preflight in one line (permissive defaults; tighten `origin` in prod).
	if (req.method === 'OPTIONS') return preflight()

	switch (pathname) {
		case '/':
			return Response.json({ routes: ROUTES })

		case '/env':
			// requireEnv throws a 500 if unset — `GREETING` is set in wrangler.jsonc.
			return Response.json({
				greeting: requireEnv(env, 'GREETING'),
				optional: getEnv(env, 'NOT_SET', 'fallback'),
			})

		case '/whoami':
			// Typed request.cf geo/TLS metadata + the Cloudflare client-IP header.
			// (null under `wrangler dev` local mode — real values need `--remote`.)
			return Response.json({
				ip: clientIp(req),
				country: cf(req)?.country ?? null,
				tlsVersion: cf(req)?.tlsVersion ?? null,
			})

		case '/echo': {
			// POST a JSON body: parseJson validates it (a bad body throws a 400 that
			// defineFetch maps). bearerToken reads `Authorization: Bearer <token>`.
			const body = await parseJson(req, echoSchema)
			return withCors(Response.json({ hello: body.name, token: bearerToken(req) }))
		}

		case '/kv': {
			// `getBinding` would throw a non-exposed 500; here we return a
			// friendlier hint so the demo is self-documenting.
			if (!env.KV) return missingBinding('KV', 'kv_namespaces')
			const store = createKvStore<{ hits: number }>(env.KV)
			const prev = (await store.get('demo'))?.hits ?? 0
			const hits = prev + 1
			await store.put('demo', { hits }, { ttl: 3600 })
			return Response.json({ hits })
		}

		case '/r2': {
			if (!env.R2) return missingBinding('R2', 'r2_buckets')
			const docs = createR2Store<{ at: string }>(env.R2)
			await docs.putJSON('demo.json', { at: new Date().toISOString() })
			return Response.json({ demo: await docs.getJSON('demo.json') })
		}

		case '/d1': {
			if (!env.D1) return missingBinding('D1', 'd1_databases')
			const row = await queryFirst<{ now: string }>(env.D1, "SELECT datetime('now') AS now")
			return Response.json(row)
		}

		default:
			return Response.json({ error: 'Not found', routes: ROUTES }, { status: 404 })
	}
})

/** A 500 explaining which `wrangler.jsonc` binding a route needs. */
function missingBinding(binding: string, configKey: string): Response {
	return Response.json(
		{ error: `Missing binding: ${binding}. Uncomment "${configKey}" in wrangler.jsonc.` },
		{ status: 500 }
	)
}
