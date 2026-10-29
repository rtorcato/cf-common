---
name: cf-common
description: Use when writing a Cloudflare Worker in a project that depends on @rtorcato/cf-common — reading bindings/vars from env, typed KV/R2/D1 access, D1 migrations, JSON error responses and CORS, parsing request bodies, bearer tokens or client IP, cron triggers, Queues producers and consumers, Durable Objects with typed storage, or Turnstile verification. Triggers on "Cloudflare Worker", "workerd", "KV namespace", "R2 bucket", "D1 query", "D1 migration", "getBinding", "defineFetch", "CloudflareError", "scheduled handler", "Queue consumer", "Durable Object", "Turnstile siteverify", or "/cf-common".
---

# Using @rtorcato/cf-common

`@rtorcato/cf-common` is a set of thin, typed helpers over Cloudflare Workers bindings and APIs. Each Cloudflare concern is its own subpath module. It is not a framework or a router.

```sh
pnpm add @rtorcato/cf-common
pnpm add -D @cloudflare/workers-types   # KVNamespace, R2Bucket, D1Database, … are ambient types
```

## Rules

1. **Import from a subpath, never the root.** The `.` entry is intentionally empty. Use `@rtorcato/cf-common/<module>`:
   ```ts
   import { getBinding, requireEnv } from '@rtorcato/cf-common/env'
   import { createKvStore } from '@rtorcato/cf-common/kv'
   ```
   Subpaths: `errors`, `env`, `kv`, `r2`, `r2-presign`, `cache`, `d1`, `http`, `request`, `ratelimit`, `turnstile`, `cron`, `queues`, `do`, `ai`, `ai-gateway`, `vectorize`, `access`, `hyperdrive`, `rpc`, `api`, `email`, `analytics`, `workflows`. Don't import from `dist/`.

2. **Throw `CloudflareError`, map it once at the edge.** Every helper throws `CloudflareError` (`status`, `expose`, optional `code`). Wrap the handler in `defineFetch` so a thrown error becomes `{ error, code }` JSON with the right status. `expose` defaults to `true` for 4xx and `false` for 5xx, and a non-exposed message is sent as `'Internal error'`, so internal details don't leak.
   ```ts
   import { defineFetch } from '@rtorcato/cf-common/http'
   import { CloudflareError } from '@rtorcato/cf-common/errors'

   export default defineFetch(async (request, env) => {
     if (request.method !== 'GET') throw new CloudflareError('Method not allowed', { status: 405 })
     return Response.json({ ok: true })
   })
   ```
   Use `isCloudflareError(e)` rather than `instanceof` to check for one. Each subpath is bundled separately, so `instanceof` can fail across modules. `toCloudflareError(e)` coerces any thrown value (a non-exposed 500 by default).

3. **Get bindings through `env`, not by trusting `env.X`.** `getBinding<T>(env, 'NAME')` throws a non-exposed 500 when the binding is missing, since that is a deploy misconfiguration and not a client error. `requireEnv(env, 'NAME')` does the same for a required string var or secret. `getEnv(env, 'NAME', fallback?)` is for optional vars.

4. **Use the native APIs where they already work.** There is no `json()` helper: use `Response.json(data, init)`. There is no router: bring your own (or a `switch` on `URL.pathname`). The R2 binding can't presign URLs, so `r2-presign` signs them over the S3 API with an R2 API token.

5. **Validation is bring-your-own-schema.** `parseJson(request, schema)` accepts anything with a `parse(input): T` method (a Zod schema works as is). Malformed JSON and failed validation both throw an exposed `400` with code `INVALID_BODY`.

## Module map

| Subpath | Exports | Notes |
|---|---|---|
| `errors` | `CloudflareError`, `isCloudflareError`, `toCloudflareError` | `new CloudflareError(msg, { status?, expose?, code?, cause? })`, default status 500 |
| `env` | `getBinding<T>`, `requireEnv`, `getEnv`, type `Env` | Missing binding or var → non-exposed 500 |
| `kv` | `createKvStore<T>(ns)` → `get`/`put`/`delete`/`list` | Values are JSON. `get` returns `null` when missing. `put(key, value, { ttl?, expiration?, metadata? })`. Invalid JSON throws `KV_PARSE_FAILED` |
| `r2` | `createR2Store<T>(bucket)` → `get`/`getJSON`/`put`/`putJSON`/`head`/`delete`/`list`. `multipartUpload(bucket, key, parts, options?)` | `putJSON` sets `application/json`. `getJSON` on invalid JSON throws `R2_PARSE_FAILED`. Multipart aborts on failure (`R2_MULTIPART_FAILED`), and every part except the last must be ≥ 5 MiB |
| `r2-presign` | `presignR2Url({ accountId, accessKeyId, secretAccessKey, bucket, key, method?, expiresIn? })` | `GET` (default) or `PUT`, `expiresIn` 1 to 604800 s (default 3600). Only `host` is signed. Bad `accountId`/`expiresIn` throws a 500 `R2_PRESIGN_INVALID`; an empty key or a `.`/`..` segment throws an exposed 400 `R2_PRESIGN_INVALID_KEY`. Keep the secret in `wrangler secret put` |
| `cache` | `createCache(cache)` → `match`/`put`/`delete`, `buildCacheKey(url, params?)` | Wrap `caches.default` or a named cache. `put(key, res, { ttl? })` sets `Cache-Control: public, max-age=<ttl>`. `put` doesn't clone, so `.clone()` a response you also return. The cache is per data center |
| `d1` | `query<T>`, `queryFirst<T>`, `execute`, `batch`, `runMigrations` | Parameters are variadic: `query(db, sql, ...params)`. `batch(db, [{ sql, params }])` is atomic. A failing migration throws `D1_MIGRATION_FAILED` |
| `http` | `defineFetch`, `errorResponse`, `error`, `corsHeaders`, `withCors`, `preflight` | CORS defaults are permissive (`*`), so set `origin` in production |
| `request` | `cf`, `parseJson`, `bearerToken`, `clientIp` | `cf(request)` is `undefined` in local dev without `--remote` and in tests. `bearerToken` returns `null` if the header is missing or malformed |
| `ratelimit` | `rateLimit(binding)` → `limit({ key })`/`limitByIp(request)`/`limitBy(id, prefix?)` | Wraps the `ratelimits` binding (limit and 10 or 60 s period live in wrangler config). Each returns `{ success }`; `false` means over the limit. `limitByIp` keys on `CF-Connecting-IP`, falling back to one shared `'unknown'` key. Counts are per location and approximate |
| `turnstile` | `verifyTurnstile`, `assertTurnstile` | `verify…` returns the result, so check `.success`. `assert…` throws a 403 whose `code` is Turnstile's first error code. A failed HTTP call throws 502 `TURNSTILE_HTTP_ERROR` |
| `access` | `verifyAccessJwt(token, { teamDomain, aud })`, `accessJwt(request)` | Checks the RS256 signature against the team JWKS (cached an hour, refetched at most once a minute for an unknown key), plus issuer, `aud`, `exp` and `nbf`. Any bad token throws a 401 `ACCESS_JWT_INVALID`; an unreachable certs endpoint throws a non-exposed 502 `ACCESS_JWKS_HTTP_ERROR`. `accessJwt` returns `null` when the `Cf-Access-Jwt-Assertion` header is missing |
| `cron` | `defineScheduled({ '<cron>': job })` | Keys must match the `crons` in your wrangler config. An unmatched trigger throws `CRON_NO_MATCH` |
| `queues` | `createProducer<T>(queue)` → `send`/`sendBatch`. `defineQueue(handler, { retryDelay? })` | `sendBatch` splits into chunks of 100 and throws `QUEUE_SEND_FAILED` (502). `defineQueue` runs `handler(body, message, env, ctx)` per message: returns → `ack()`, throws → `retry()` for that message only. `retryDelay` is seconds or `(attempts) => seconds` |
| `do` | `BaseDurableObject<Env, Schema>`, `typedStorage<Schema>(storage)` → `get`/`put`/`delete` | Extends `DurableObject` from `cloudflare:workers` (RPC, `fetch`, `alarm` still work) and adds a typed `this.storage`. `get(key, fallback?)` returns `undefined` (or `fallback`) for a key never written. Only loads under workerd. Use `this.ctx.storage` for `list`, transactions, alarms and SQL |
| `rpc` | `getService<typeof Entrypoint>(env, 'NAME')`, `callService(label, () => svc.method())` | `getService` is `getBinding` typed as the callee's `Service<…>`, so its public methods are typed RPC calls. Import the callee class as a type only. `callService` maps any failure (callee threw, binding down) to a non-exposed 502 `RPC_CALL_FAILED` with the original as `cause`; a callee's own status doesn't cross RPC, so return a result for expected failures |
| `workflows` | `createWorkflow<Params, Result>(binding)` → `create(params, { id? })`/`get(id)`/`status(id)` | Caller's side of a Workflow binding. `create` takes typed params and returns the `WorkflowInstance` handle (`pause`, `resume`, `terminate`, `sendEvent`); `status` returns the status with `output` typed as `Result`. Any failure (missing or duplicate instance, binding down) throws a non-exposed 502 `WORKFLOW_FAILED` with the original as `cause`. The Workflow class is `WorkflowEntrypoint` from `cloudflare:workers`, already typed by workers-types |
| `ai` | `runAi(ai, model, inputs, options?)` | Typed `run()` over the Workers AI binding; input and output types follow the model name. A failed call throws a non-exposed 502 `AI_RUN_FAILED` with the original error as `cause`. Use the binding directly for streaming |
| `ai-gateway` | `createAiGateway({ accountId, gatewayId, token? })` → `url(provider?)`/`fetch(provider, path, init?, options?)`/`json<T>(provider, path, body, options?)`, `gatewayUrl(config, provider?)`, `gatewayHeaders(options?, token?)` | Provider calls (OpenAI, Anthropic, Workers AI over REST, …) through `gateway.ai.cloudflare.com`. Options are the Workers AI `gateway` option minus `id` (`cacheTtl`, `skipCache`, `cacheKey`, `metadata`, `collectLog`, `eventId`, `requestTimeoutMs`, `retries`), sent as `cf-aig-*` headers; `token` goes in `cf-aig-authorization` for an authenticated gateway. `fetch` returns the `Response` (streams work); `json` POSTs JSON and asserts `T`. Network error, non-2xx or non-JSON throws a non-exposed 502 `AI_GATEWAY_FAILED` (status and body on `cause`). An empty or `.`/`..` id, provider or path segment throws a non-exposed 500 `AI_GATEWAY_INVALID`. With an AI binding, pass `{ gateway: { id, … } }` to `runAi` instead |
| `api` | `createCloudflareApi({ token })` → `zones.list`/`get`, `dns.list`/`create`/`update`/`delete`, `cache.purge`, raw `request`/`requestPage` | REST API v4 with an API token (`wrangler secret put`). Lists return one page `{ result, resultInfo }`; no auto-pagination or retries. Any failure throws a non-exposed 502 `CF_API_ERROR`; the upstream status and `errors` are on `cause`. The named helpers reject a `.`/`..` id with an exposed 400 `CF_API_INVALID_ID`. For other endpoints use `request`, or the official `cloudflare` SDK |
| `vectorize` | `createVectorStore<M>(index)` → `upsert`/`query`/`queryById`/`getByIds`/`deleteByIds` | Typed metadata `M` (asserted, not validated). `upsert` chunks at 1000 and returns the `mutationId`s in order, stopping at the first failed chunk. Every method maps a failure to a non-exposed 502 `VECTORIZE_FAILED`. Mutations are async |
| `hyperdrive` | `withHyperdrive(hd, { connect, close, ctx? }, work)` | Opens one client per call over the Hyperdrive binding and always closes it, also when `work` throws. `connect` and `close` are yours, so no driver is bundled. A failed connect throws a non-exposed 502 `HYPERDRIVE_CONNECT_FAILED`. Errors from `work` pass through unchanged |
| `email` | `sendEmail(binding, message)` | Over the `send_email` binding. `message` is fields (`from`, `to`/`cc`/`bcc`, `subject`, `text`/`html`, `attachments`; the runtime builds the MIME) or an `EmailMessage` from `cloudflare:email` with raw MIME. Returns `{ messageId }`. A failed send throws a non-exposed 502 `EMAIL_SEND_FAILED` with the original as `cause`. Senders and recipients must be allowed by the binding config |
| `analytics` | `writeDataPoint(dataset, point)`, `createDataset(dataset, { blobs?, doubles?, index? })` → `write(fields)`/`columns` | Over the Analytics Engine binding, fire-and-forget (returns `void`). `createDataset` names the slots in order (`blobs[0]` → `blob1`, `index` → `index1`); missing blobs are written as `null`, doubles and the index are required. `columns` maps each name to its SQL API column. Only append to a schema, since reordering moves data between columns. A point the runtime rejects throws a non-exposed 500 `ANALYTICS_WRITE_FAILED` with the original as `cause` |

## Recipes

**KV-backed JSON API with CORS:**
```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { defineFetch, error, preflight, withCors } from '@rtorcato/cf-common/http'

interface User { id: string; name: string }
const cors = { origin: 'https://app.example.com' }

export default defineFetch(async (request, env: Record<string, unknown>) => {
  if (request.method === 'OPTIONS') return preflight(cors)
  const users = createKvStore<User>(getBinding<KVNamespace>(env, 'USERS'))
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return withCors(error(400, 'Missing id'), cors)
  const user = await users.get(id)
  return withCors(user ? Response.json(user) : error(404, 'Not found'), cors)
})
```

**Authenticated JSON body:**
```ts
import { z } from 'zod'
import { bearerToken, parseJson } from '@rtorcato/cf-common/request'
import { CloudflareError } from '@rtorcato/cf-common/errors'

const token = bearerToken(request)
if (!token) throw new CloudflareError('Missing token', { status: 401 })
const body = await parseJson(request, z.object({ email: z.string().email() }))
```

**D1 with migrations.** `runMigrations` is forward-only and idempotent. It records applied names in `_cf_migrations` and returns the names it ran on this call. It does not wrap a migration in a transaction, so keep each one small.
```ts
import { execute, query, runMigrations } from '@rtorcato/cf-common/d1'

await runMigrations(env.DB, [
  { name: '001_users', sql: 'CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL)' },
])
await execute(env.DB, 'INSERT INTO users (id, name) VALUES (?, ?)', id, name)
const rows = await query<{ id: string; name: string }>(env.DB, 'SELECT * FROM users WHERE name = ?', name)
```

**Several cron triggers in one Worker:**
```ts
import { defineScheduled } from '@rtorcato/cf-common/cron'

export default {
  scheduled: defineScheduled<Env>({
    '0 * * * *': async (_controller, env) => rollupHourly(env),
    '0 0 * * *': async (_controller, env) => rollupDaily(env),
  }),
}
```

**Queue producer and consumer:**
```ts
import { createProducer, defineQueue } from '@rtorcato/cf-common/queues'

await createProducer<EmailJob>(env.EMAILS).send({ to })

export default {
  queue: defineQueue<EmailJob, Env>(async (job, _message, env) => sendEmail(env, job), {
    retryDelay: (attempts) => 2 ** attempts * 10,
  }),
}
```

**Turnstile on a form post:**
```ts
import { assertTurnstile } from '@rtorcato/cf-common/turnstile'
import { requireEnv } from '@rtorcato/cf-common/env'
import { clientIp } from '@rtorcato/cf-common/request'

await assertTurnstile(token, requireEnv(env, 'TURNSTILE_SECRET'), {
  remoteip: clientIp(request) ?? undefined,
})
```

## Testing

Test pure logic in Node with a synthetic `Request` and mocked `fetch`. Test code that touches real KV, R2 or D1 with `@cloudflare/vitest-plugin` (workerd + Miniflare), using `env` from `cloudflare:test`.

For the full API, see the [docs site](https://docs.torcato.dev/cf-common/) or the JSDoc in `src/<module>/index.ts`.
