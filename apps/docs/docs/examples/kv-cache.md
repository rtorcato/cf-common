---
title: KV cache
description: Cache an upstream API response in Workers KV with a TTL, using createKvStore.
sidebar_position: 2
---

# KV cache

Put a slow or rate-limited upstream behind Workers KV. `createKvStore` stores
values as JSON, so `get` hands back the typed object (or `null` on a miss) and
`put` takes a `ttl` in seconds.

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'
import { createKvStore } from '@rtorcato/cf-common/kv'

interface Env {
  [key: string]: unknown
  CACHE: KVNamespace
}

interface Weather {
  city: string
  tempC: number
  fetchedAt: string
}

export default defineFetch<Env>(async (req, env) => {
  const city = new URL(req.url).searchParams.get('city')
  if (!city) throw new CloudflareError('`city` is required', { status: 400 })

  const cache = createKvStore<Weather>(getBinding<KVNamespace>(env, 'CACHE'))
  const key = `weather:${city.toLowerCase()}`

  const hit = await cache.get(key)
  if (hit) return Response.json(hit, { headers: { 'x-cache': 'HIT' } })

  const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}`)
  if (!res.ok) throw new CloudflareError('Upstream failed', { status: 502 })
  const { tempC } = await res.json<{ tempC: number }>()

  const fresh: Weather = { city, tempC, fetchedAt: new Date().toISOString() }
  await cache.put(key, fresh, { ttl: 300 }) // KV's minimum TTL is 60s
  return Response.json(fresh, { headers: { 'x-cache': 'MISS' } })
})
```

## Notes

- **Eventual consistency.** A write is visible in its own location at once but
  can take up to ~60 seconds to reach other edge locations. That is fine for a
  cache; don't use KV for counters or anything that needs read-after-write
  across regions.
- **Bad JSON throws.** If a key holds something that isn't JSON (say, written
  by another tool), `get` throws a `CloudflareError` with code
  `KV_PARSE_FAILED`. `defineFetch` turns it into a 500.
- **Invalidate** with `cache.delete(key)`, or list a prefix with
  `cache.list({ prefix: 'weather:' })` and delete what it returns.

## Binding

```jsonc
// wrangler.jsonc
"kv_namespaces": [{ "binding": "CACHE", "id": "<namespace-id>" }]
```

`wrangler kv namespace create CACHE` prints the id. Under `wrangler dev`, the
namespace is simulated locally and needs no account.

See the [`kv` API reference](/docs/api/kv) for every option.
