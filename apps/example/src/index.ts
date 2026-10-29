/**
 * A minimal Worker exercising every `@rtorcato/cf-common` subpath in one
 * `fetch` handler. It doubles as a copy-paste starter and a smoke test that
 * the published exports resolve and run under workerd.
 *
 * Run it with `pnpm --filter @rtorcato/cf-common-example dev`, then hit the
 * routes listed at `/`. `/`, `/env`, `/whoami`, `/echo`, `/cache`, `/ratelimit`
 * and `/turnstile` work out of the box; `/kv`, `/r2`, `/d1`, `/queue`, and `/ai`
 * need their binding uncommented in `wrangler.jsonc`, and `/api` needs a
 * `CLOUDFLARE_API_TOKEN` secret. The `scheduled` handler
 * runs under `wrangler dev --test-scheduled`.
 */
import { runAi } from '@rtorcato/cf-common/ai'
import { createCloudflareApi } from '@rtorcato/cf-common/api'
import { buildCacheKey, createCache } from '@rtorcato/cf-common/cache'
import { defineScheduled } from '@rtorcato/cf-common/cron'
import { queryFirst } from '@rtorcato/cf-common/d1'
import { getEnv, requireEnv } from '@rtorcato/cf-common/env'
import { defineFetch, preflight, withCors } from '@rtorcato/cf-common/http'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { createProducer, defineQueue } from '@rtorcato/cf-common/queues'
import { createR2Store } from '@rtorcato/cf-common/r2'
import { presignR2Url } from '@rtorcato/cf-common/r2-presign'
import { type RateLimitBinding, rateLimit } from '@rtorcato/cf-common/ratelimit'
import { bearerToken, cf, clientIp, parseJson } from '@rtorcato/cf-common/request'
import { assertTurnstile } from '@rtorcato/cf-common/turnstile'

interface Env {
	// Index signature so the whole object is assignable to cf-common's
	// `Env` (`Record<string, unknown>`) while keeping the bindings typed.
	[key: string]: unknown
	GREETING: string
	KV?: KVNamespace
	R2?: R2Bucket
	D1?: D1Database
	// Only for /presign: an R2 API token, set with `wrangler secret put`.
	R2_ACCOUNT_ID?: string
	R2_ACCESS_KEY_ID?: string
	R2_SECRET_ACCESS_KEY?: string
	QUEUE?: Queue<{ at: string }>
	AI?: Ai
	// Only for /api: a Cloudflare API token with Zone Read, set with `wrangler secret put`.
	CLOUDFLARE_API_TOKEN?: string
	LIMITER?: RateLimitBinding
	// Cloudflare's always-pass test secret in wrangler.jsonc; `wrangler secret put` a real one.
	TURNSTILE_SECRET: string
}

const ROUTES = [
	'/',
	'/env',
	'/whoami',
	'/echo',
	'/kv',
	'/r2',
	'/presign',
	'/d1',
	'/queue',
	'/ai',
	'/api',
	'/cache',
	'/ratelimit',
	'/turnstile',
] as const

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
const api = defineFetch<Env>(async (req, env, ctx) => {
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

		case '/presign': {
			// Signing is local (no network call), so this works under `wrangler dev`.
			// The URLs only work against a real bucket with a real R2 API token.
			const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
			if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
				return Response.json(
					{
						error:
							'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (wrangler secret put).',
					},
					{ status: 500 }
				)
			}
			const target = {
				accountId: R2_ACCOUNT_ID,
				accessKeyId: R2_ACCESS_KEY_ID,
				secretAccessKey: R2_SECRET_ACCESS_KEY,
				bucket: 'cf-common-example',
				key: 'demo.txt',
				expiresIn: 300,
			}
			return Response.json({
				get: await presignR2Url(target),
				put: await presignR2Url({ ...target, method: 'PUT' }),
			})
		}

		case '/d1': {
			if (!env.D1) return missingBinding('D1', 'd1_databases')
			const row = await queryFirst<{ now: string }>(env.D1, "SELECT datetime('now') AS now")
			return Response.json(row)
		}

		case '/queue': {
			if (!env.QUEUE) return missingBinding('QUEUE', 'queues')
			await createProducer(env.QUEUE).send({ at: new Date().toISOString() })
			return Response.json({ queued: true }, { status: 202 })
		}

		case '/ai': {
			if (!env.AI) return missingBinding('AI', 'ai')
			const { response } = await runAi(env.AI, '@cf/meta/llama-3.2-3b-instruct', {
				prompt: 'Say hello in five words.',
			})
			return Response.json({ response })
		}

		case '/api': {
			// Lists the zones the token can read. Calls the real REST API, so it needs a
			// token even under `wrangler dev`.
			if (!env.CLOUDFLARE_API_TOKEN) {
				return Response.json(
					{ error: 'Set CLOUDFLARE_API_TOKEN (wrangler secret put).' },
					{ status: 500 }
				)
			}
			const cfApi = createCloudflareApi({ token: env.CLOUDFLARE_API_TOKEN })
			const { result, resultInfo } = await cfApi.zones.list({ per_page: 5 })
			return Response.json({
				zones: result.map((z) => z.name),
				total: resultInfo.total_count,
			})
		}

		case '/cache': {
			// Read through the Cache API: the first call misses and stores a 60s entry,
			// later calls in the same data center get `X-Cache: HIT` until it expires.
			const cache = createCache(caches.default)
			const key = buildCacheKey(req.url, { v: 1 })
			const hit = await cache.match(key)
			if (hit) return withHeader(hit, 'X-Cache', 'HIT')
			const res = Response.json({ at: new Date().toISOString() })
			ctx.waitUntil(cache.put(key, res.clone(), { ttl: 60 }))
			return withHeader(res, 'X-Cache', 'MISS')
		}

		case '/ratelimit': {
			// 5 requests per 10s per client IP (see `ratelimits` in wrangler.jsonc).
			if (!env.LIMITER) return missingBinding('LIMITER', 'ratelimits')
			const { success } = await rateLimit(env.LIMITER).limitByIp(req)
			if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })
			return Response.json({ ok: true })
		}

		case '/turnstile': {
			// POST a widget token as `cf-turnstile-response`. The test secret in
			// wrangler.jsonc passes every token; swap in the always-fail one
			// (`2x0000000000000000000000000000000AA`) to see the 403 defineFetch maps.
			const form = await req.formData()
			const result = await assertTurnstile(
				String(form.get('cf-turnstile-response') ?? ''),
				requireEnv(env, 'TURNSTILE_SECRET'),
				{ remoteip: clientIp(req) ?? undefined }
			)
			return Response.json({ ok: true, hostname: result.hostname ?? null })
		}

		default:
			return Response.json({ error: 'Not found', routes: ROUTES }, { status: 404 })
	}
})

// Same Worker consumes the queue it produces to: the handler logs each job, and a
// throw would retry just that message (here after 10s). The `scheduled` keys
// match `triggers.crons` in wrangler.jsonc.
export default {
	...api,
	scheduled: defineScheduled<Env>({
		'*/5 * * * *': (controller) => {
			console.log('cron', controller.cron, new Date(controller.scheduledTime).toISOString())
		},
	}),
	queue: defineQueue<{ at: string }, Env>(
		(job) => {
			console.log('queue job', job.at)
		},
		{ retryDelay: 10 }
	),
}

/** Copy `res` with one extra header (a cached Response's headers are immutable). */
function withHeader(res: Response, name: string, value: string): Response {
	const copy = new Response(res.body, res)
	copy.headers.set(name, value)
	return copy
}

/** A 500 explaining which `wrangler.jsonc` binding a route needs. */
function missingBinding(binding: string, configKey: string): Response {
	return Response.json(
		{ error: `Missing binding: ${binding}. Uncomment "${configKey}" in wrangler.jsonc.` },
		{ status: 500 }
	)
}
