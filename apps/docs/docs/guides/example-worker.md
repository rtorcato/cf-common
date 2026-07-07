---
title: Example Worker
description: A runnable Worker that exercises every cf-common module locally, with no Cloudflare account.
sidebar_position: 2
---

# Example Worker

The repo ships a runnable sample Worker at
[`apps/example`](https://github.com/rtorcato/cf-common/tree/main/apps/example)
that exercises **every** module (`env`, `kv`, `r2`, `d1`, `errors`) in a single
`fetch` handler. It doubles as a copy-paste starter and a smoke test that the
published subpath exports resolve under the Workers runtime.

## Run it

```bash
pnpm --filter @rtorcato/cf-common-example dev
```

`wrangler dev` runs in **local mode** — Miniflare simulates KV, R2, and D1 on
disk using the placeholder ids in `wrangler.jsonc`, so **every route works with
no Cloudflare account**. Hit them at `http://localhost:8787`:

| Route  | Shows                                          |
| ------ | ---------------------------------------------- |
| `/`    | the list of routes                             |
| `/env` | `requireEnv` / `getEnv` reading a var          |
| `/kv`  | `createKvStore` round-tripping a counter (TTL) |
| `/r2`  | `createR2Store` `putJSON` / `getJSON`          |
| `/d1`  | `queryFirst` against local D1                  |

## The handler

Every route is guarded and wrapped in the `toCloudflareError` pattern, so a
missing binding or a thrown error becomes a clean JSON response:

```ts
import { getEnv, requireEnv } from '@rtorcato/cf-common/env'
import { createKvStore } from '@rtorcato/cf-common/kv'
import { createR2Store } from '@rtorcato/cf-common/r2'
import { queryFirst } from '@rtorcato/cf-common/d1'
import { toCloudflareError } from '@rtorcato/cf-common/errors'

interface Env {
  [key: string]: unknown
  GREETING: string
  KV?: KVNamespace
  R2?: R2Bucket
  D1?: D1Database
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)
    try {
      if (pathname === '/env') {
        return Response.json({ greeting: requireEnv(env, 'GREETING') })
      }
      if (pathname === '/kv' && env.KV) {
        const store = createKvStore<{ hits: number }>(env.KV)
        const hits = ((await store.get('demo'))?.hits ?? 0) + 1
        await store.put('demo', { hits }, { ttl: 3600 })
        return Response.json({ hits })
      }
      if (pathname === '/d1' && env.D1) {
        return Response.json(await queryFirst(env.D1, "SELECT datetime('now') AS now"))
      }
      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (err) {
      const e = toCloudflareError(err)
      return Response.json(
        { error: e.expose ? e.message : 'Internal error', code: e.code },
        { status: e.status },
      )
    }
  },
}
```

See the [full source](https://github.com/rtorcato/cf-common/tree/main/apps/example/src/index.ts)
for the `/r2` route and the friendly missing-binding guards.

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
