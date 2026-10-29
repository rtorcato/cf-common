---
title: ratelimit
description: A typed wrapper over the Workers Rate Limiting binding, keyed by client IP or any identifier.
---

`@rtorcato/cf-common/ratelimit` wraps Cloudflare's Rate Limiting binding. You
count a request against a key and get back whether it is within the limit.

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { type RateLimitBinding, rateLimit } from '@rtorcato/cf-common/ratelimit'

const limiter = rateLimit(getBinding<RateLimitBinding>(env, 'API_LIMITER'))
```

## Configure the binding

The limit and window live in `wrangler.jsonc`, not in code. `period` is `10` or
`60` seconds. `namespace_id` is a positive integer, written as a string, that you
pick. Bindings with the same `namespace_id` share counters, even across Workers:

```jsonc
"ratelimits": [
  {
    "name": "API_LIMITER",
    "namespace_id": "1001",
    "simple": { "limit": 100, "period": 60 }
  }
]
```

## Limit a request

```ts
export default defineFetch<Env>(async (request, env) => {
  const limiter = rateLimit(getBinding<RateLimitBinding>(env, 'API_LIMITER'))

  const { success } = await limiter.limitByIp(request)
  if (!success) return error(429, 'Too many requests')

  return Response.json({ ok: true })
})
```

| Method                  | Key counted                                   |
| ----------------------- | --------------------------------------------- |
| `limitByIp(request)`    | `CF-Connecting-IP`, or `'unknown'` if missing |
| `limitBy(id, prefix?)`  | `id`, or `prefix:id` when a prefix is given   |
| `limit({ key })`        | `key` as given                                |

Use `limitBy` to limit by user or API key, and a prefix to keep separate counters
on one binding:

```ts
await limiter.limitBy(userId, 'login')  // key "login:<userId>"
await limiter.limitBy(userId, 'export') // key "export:<userId>"
```

## Good to know

- Requests without a `CF-Connecting-IP` header (a test `Request`, for instance)
  all share the `'unknown'` key under `limitByIp`.
- Counters are kept per Cloudflare location and are eventually consistent, so
  the limit is approximate and a burst can pass it. For a strict, global limit,
  build one on Durable Objects.
- Limiting by IP puts users behind a shared NAT in one bucket. Prefer a user or
  API-key id once the caller is authenticated.

For a runnable walkthrough, see the `/ratelimit` route in `apps/example`. See the
[`ratelimit` API reference](/docs/api/ratelimit) for every option.
