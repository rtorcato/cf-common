---
title: cache
description: Cache API match/put/delete with a stable key builder and a TTL option.
---

`@rtorcato/cf-common/cache` is a thin view over a Workers `Cache`
(`caches.default` or a named cache). It adds a key builder and a `ttl` option on
`put`.

```ts
import { buildCacheKey, createCache } from '@rtorcato/cf-common/cache'

const cache = createCache(caches.default)
// or a named cache: createCache(await caches.open('pages'))
```

## Build a key

The Cache API keys on a `GET` request with an absolute URL. `buildCacheKey`
builds one, with the query params sorted so the same params in any order hit the
same entry:

```ts
const key = buildCacheKey('https://cache.internal/users', { id: 7, page: 2 })
// GET https://cache.internal/users?id=7&page=2
```

The host doesn't have to exist. It only names the entry.

## Read through the cache

```ts
export default defineFetch(async (request, env, ctx) => {
  const key = buildCacheKey('https://cache.internal/weather', { city: 'Lisbon' })

  const hit = await cache.match(key)
  if (hit) return hit

  const res = await fetch('https://api.example.com/weather?city=Lisbon')
  ctx.waitUntil(cache.put(key, res.clone(), { ttl: 300 }))
  return res
})
```

`match` returns `undefined` on a miss. `put` stores the response as given: it
doesn't clone it, so `.clone()` it first if you also return it to the client.
`ctx.waitUntil` lets the write finish after the response is sent.

## TTL

`put(key, response, { ttl })` sets `Cache-Control: public, max-age=<ttl>` on the
stored copy, replacing whatever the upstream sent. Without `ttl`, the response's
own caching headers decide how long it stays.

## Delete

```ts
const removed = await cache.delete(key) // true if an entry was removed
```

## Good to know

- The Cache API is per data center. A `put` or `delete` in one location doesn't
  reach the others, so use [KV](./kv.md) for data every location must see.
- A response with a `Set-Cookie` header is never cached. Remove the header before
  `put` if the body is safe to share.
- The runtime's own `put` rules still apply: a `206` response or `Vary: *` throws,
  and a body that is too large is not stored.

See the [KV cache example](/docs/examples/kv-cache) for the KV-backed version, and
the `/cache` route in `apps/example`. See the
[`cache` API reference](/docs/api/cache) for every option.
