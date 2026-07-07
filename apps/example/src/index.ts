/**
 * A minimal Worker exercising every `@rtorcato/cf-common` subpath in one
 * `fetch` handler. It doubles as a copy-paste starter and a smoke test that
 * the published exports resolve and run under workerd.
 *
 * Run it with `pnpm --filter @rtorcato/cf-common-example dev`, then hit the
 * routes listed at `/`. `/` and `/env` work out of the box; `/kv`, `/r2`, and
 * `/d1` need their binding uncommented in `wrangler.jsonc`.
 */
import { getEnv, requireEnv } from '@rtorcato/cf-common/env'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { createR2Store } from '@rtorcato/cf-common/r2'
import { queryFirst } from '@rtorcato/cf-common/d1'
import { toCloudflareError } from '@rtorcato/cf-common/errors'

interface Env {
	// Index signature so the whole object is assignable to cf-common's
	// `Env` (`Record<string, unknown>`) while keeping the bindings typed.
	[key: string]: unknown
	GREETING: string
	KV?: KVNamespace
	R2?: R2Bucket
	D1?: D1Database
}

const ROUTES = ['/', '/env', '/kv', '/r2', '/d1'] as const

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(req.url)
		try {
			switch (pathname) {
				case '/':
					return Response.json({ routes: ROUTES })

				case '/env':
					// requireEnv throws a 500 if unset — `GREETING` is set in wrangler.jsonc.
					return Response.json({
						greeting: requireEnv(env, 'GREETING'),
						optional: getEnv(env, 'NOT_SET', 'fallback'),
					})

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
		} catch (err) {
			const e = toCloudflareError(err)
			return Response.json(
				{ error: e.expose ? e.message : 'Internal error', code: e.code },
				{ status: e.status }
			)
		}
	},
}

/** A 500 explaining which `wrangler.jsonc` binding a route needs. */
function missingBinding(binding: string, configKey: string): Response {
	return Response.json(
		{ error: `Missing binding: ${binding}. Uncomment "${configKey}" in wrangler.jsonc.` },
		{ status: 500 }
	)
}
