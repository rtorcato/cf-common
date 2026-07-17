---
title: Example Worker
description: A runnable Worker that exercises every cf-common module locally, with no Cloudflare account.
sidebar_position: 2
---

# Example Worker

The repo ships a runnable sample Worker at
[`apps/example`](https://github.com/rtorcato/cf-common/tree/main/apps/example)
that exercises **every** module (`env`, `http`, `request`, `kv`, `r2`, `d1`,
`errors`) in a single `fetch` handler. It doubles as a copy-paste starter and a
smoke test that the published subpath exports resolve under the Workers runtime.

## Run it

```bash
pnpm --filter @rtorcato/cf-common-example dev
```

`wrangler dev` runs in **local mode** — Miniflare simulates KV, R2, and D1 on
disk using the placeholder ids in `wrangler.jsonc`. `/`, `/env`, `/whoami`, and
`/echo` work with **no Cloudflare account**; `/kv`, `/r2`, and `/d1` need their
binding uncommented in `wrangler.jsonc`. Hit them at `http://localhost:8787`:

| Route     | Method | Shows                                                       |
| --------- | ------ | ----------------------------------------------------------- |
| `/`       | GET    | the list of routes                                          |
| `/env`    | GET    | `requireEnv` / `getEnv` reading a var                       |
| `/whoami` | GET    | `cf` (request.cf country/TLS) + `clientIp`                  |
| `/echo`   | POST   | `parseJson` (400 on a bad body) + `bearerToken`; `withCors` |
| `/kv`     | GET    | `createKvStore` round-tripping a counter (TTL)              |
| `/r2`     | GET    | `createR2Store` `putJSON` / `getJSON`                       |
| `/d1`     | GET    | `queryFirst` against local D1                               |

## The handler

`defineFetch` wraps the handler, so anything that throws a `CloudflareError` — a
missing var from `requireEnv`, a bad body from `parseJson` — becomes a clean JSON
response with the right status. No `try/catch` to repeat:

```ts
import { queryFirst } from '@rtorcato/cf-common/d1'
import { getEnv, requireEnv } from '@rtorcato/cf-common/env'
import { defineFetch, preflight, withCors } from '@rtorcato/cf-common/http'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { bearerToken, cf, clientIp, parseJson } from '@rtorcato/cf-common/request'

interface Env {
  [key: string]: unknown
  GREETING: string
  KV?: KVNamespace
}

// parseJson needs only a `.parse`; a Zod schema (`z.object({ name: z.string() })`)
// fits as is. A failed parse throws a 400 that defineFetch maps for you.
const echoSchema = {
  parse(input: unknown): { name: string } {
    if (typeof (input as { name?: unknown })?.name !== 'string') {
      throw new Error('`name` (string) is required')
    }
    return input as { name: string }
  },
}

export default defineFetch<Env>(async (req, env) => {
  const { pathname } = new URL(req.url)
  if (req.method === 'OPTIONS') return preflight() // CORS, one line

  if (pathname === '/env') {
    return Response.json({ greeting: requireEnv(env, 'GREETING') })
  }
  if (pathname === '/whoami') {
    return Response.json({ ip: clientIp(req), country: cf(req)?.country ?? null })
  }
  if (pathname === '/echo') {
    const body = await parseJson(req, echoSchema) // 400 on a bad body
    return withCors(Response.json({ hello: body.name, token: bearerToken(req) }))
  }
  if (pathname === '/kv' && env.KV) {
    const store = createKvStore<{ hits: number }>(env.KV)
    const hits = ((await store.get('demo'))?.hits ?? 0) + 1
    await store.put('demo', { hits }, { ttl: 3600 })
    return Response.json({ hits })
  }
  return Response.json({ error: 'Not found' }, { status: 404 })
})
```

See the [full source](https://github.com/rtorcato/cf-common/tree/main/apps/example/src/index.ts)
for the `/r2` and `/d1` routes and the friendly missing-binding guards.

## Connecting to a real account

You only need Cloudflare credentials to run against real resources or deploy:

```bash
wrangler login                 # browser OAuth (or set CLOUDFLARE_API_TOKEN)
wrangler kv namespace create KV
wrangler r2 bucket create cf-common-example
wrangler d1 create cf-common-example
```

Wire the returned ids into `wrangler.jsonc`, then run `pnpm dev --remote`
(real resources) or `pnpm deploy` (publish the Worker).
