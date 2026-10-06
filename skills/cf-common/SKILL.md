---
name: cf-common
description: Use when writing a Cloudflare Worker in a project that depends on @rtorcato/cf-common — reading bindings/vars from env, typed KV/R2/D1 access, D1 migrations, JSON error responses and CORS, parsing request bodies, bearer tokens or client IP, cron triggers, or Turnstile verification. Triggers on "Cloudflare Worker", "workerd", "KV namespace", "R2 bucket", "D1 query", "D1 migration", "getBinding", "defineFetch", "CloudflareError", "scheduled handler", "Turnstile siteverify", or "/cf-common".
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
   Subpaths: `errors`, `env`, `kv`, `r2`, `d1`, `http`, `request`, `turnstile`, `cron`. Don't import from `dist/`.

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

4. **Use the native APIs where they already work.** There is no `json()` helper: use `Response.json(data, init)`. There is no router: bring your own (or a `switch` on `URL.pathname`). There are no R2 presigned URLs: those need the S3 API with SigV4 and are out of scope.

5. **Validation is bring-your-own-schema.** `parseJson(request, schema)` accepts anything with a `parse(input): T` method (a Zod schema works as is). Malformed JSON and failed validation both throw an exposed `400` with code `INVALID_BODY`.

## Module map

| Subpath | Exports | Notes |
|---|---|---|
| `errors` | `CloudflareError`, `isCloudflareError`, `toCloudflareError` | `new CloudflareError(msg, { status?, expose?, code?, cause? })`, default status 500 |
| `env` | `getBinding<T>`, `requireEnv`, `getEnv`, type `Env` | Missing binding or var → non-exposed 500 |
| `kv` | `createKvStore<T>(ns)` → `get`/`put`/`delete`/`list` | Values are JSON. `get` returns `null` when missing. `put(key, value, { ttl?, expiration?, metadata? })`. Invalid JSON throws `KV_PARSE_FAILED` |
| `r2` | `createR2Store<T>(bucket)` → `get`/`getJSON`/`put`/`putJSON`/`head`/`delete`/`list`. `multipartUpload(bucket, key, parts, options?)` | `putJSON` sets `application/json`. `getJSON` on invalid JSON throws `R2_PARSE_FAILED`. Multipart aborts on failure (`R2_MULTIPART_FAILED`), and every part except the last must be ≥ 5 MiB |
| `d1` | `query<T>`, `queryFirst<T>`, `execute`, `batch`, `runMigrations` | Parameters are variadic: `query(db, sql, ...params)`. `batch(db, [{ sql, params }])` is atomic. A failing migration throws `D1_MIGRATION_FAILED` |
| `http` | `defineFetch`, `errorResponse`, `error`, `corsHeaders`, `withCors`, `preflight` | CORS defaults are permissive (`*`), so set `origin` in production |
| `request` | `cf`, `parseJson`, `bearerToken`, `clientIp` | `cf(request)` is `undefined` in local dev without `--remote` and in tests. `bearerToken` returns `null` if the header is missing or malformed |
| `turnstile` | `verifyTurnstile`, `assertTurnstile` | `verify…` returns the result, so check `.success`. `assert…` throws a 403 whose `code` is Turnstile's first error code. A failed HTTP call throws 502 `TURNSTILE_HTTP_ERROR` |
| `cron` | `defineScheduled({ '<cron>': job })` | Keys must match the `crons` in your wrangler config. An unmatched trigger throws `CRON_NO_MATCH` |

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

Test pure logic in Node with a synthetic `Request` and mocked `fetch`. Test code that touches real KV, R2 or D1 with `@cloudflare/vitest-pool-workers` (workerd + Miniflare), using `env` from `cloudflare:test`.

For the full API, see the [docs site](https://rtorcato.github.io/cf-common/) or the JSDoc in `src/<module>/index.ts`.
