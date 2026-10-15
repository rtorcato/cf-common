---
title: env
description: Read bindings, required secrets, and optional vars from the Workers env object.
---

`@rtorcato/cf-common/env` reads bindings and vars off the `env` argument
Cloudflare passes to your handlers. A missing value fails loudly, with a clear
message, instead of turning up later as `undefined is not a function`.

```ts
import { getBinding, getEnv, requireEnv } from '@rtorcato/cf-common/env'
```

## Bindings

```ts
const sessions = getBinding<KVNamespace>(env, 'SESSIONS')
const bucket = getBinding<R2Bucket>(env, 'UPLOADS')
const db = getBinding<D1Database>(env, 'DB')
```

`getBinding` works for any binding: KV, R2, D1, queues, services or Durable
Objects. The type parameter names what you expect, so the rest of your code is
typed against it.

If the binding is missing, `getBinding` throws a non-exposed 500
`CloudflareError`. That is a deploy mistake, such as a binding left out of
`wrangler.jsonc`, not something the client did. The client sees
`Internal error`, and your logs show `Missing Cloudflare binding: SESSIONS`.

## Required vars and secrets

```ts
const apiKey = requireEnv(env, 'STRIPE_KEY')
```

`requireEnv` returns the string or throws a non-exposed 500 when the var is
unset or empty. Use it for secrets the Worker can't run without.

## Optional vars

```ts
const region = getEnv(env, 'REGION', 'us')     // 'us' when unset
const label = getEnv(env, 'BUILD_LABEL')        // string | undefined
```

`getEnv` never throws. An empty string counts as unset, so it returns the
fallback.

## Typing `env`

The helpers take an `Env`, which is `Record<string, unknown>`. If you declare
your own interface for `defineFetch<Env>`, give it an index signature so it
fits:

```ts
interface Env {
  [key: string]: unknown
  SESSIONS: KVNamespace
  STRIPE_KEY: string
}
```

## Locally

Under `wrangler dev`, vars come from `.dev.vars`, and KV, R2 and D1 bindings
are simulated, so you don't need a Cloudflare account. A binding you forgot to
declare fails the same way it would in production.

See the [`env` API reference](/docs/api/env).
