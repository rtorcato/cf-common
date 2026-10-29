---
title: secrets
description: Read a Cloudflare Secrets Store secret by binding name.
---

`@rtorcato/cf-common/secrets` reads a secret from a
[Secrets Store](https://developers.cloudflare.com/secrets-store/) binding. It is
`requireEnv` for the secret store: one call, a clear failure.

Unlike a Worker secret (`wrangler secret put`), which arrives on `env` as a
string, a Secrets Store secret is a binding with an async `get()`.

Bind each secret in `wrangler.jsonc`:

```jsonc
"secrets_store_secrets": [
  { "binding": "STRIPE_KEY", "store_id": "<store id>", "secret_name": "stripe-key" }
]
```

## Read a secret

```ts
import { getSecret } from '@rtorcato/cf-common/secrets'

export default defineFetch(async (request, env) => {
  const apiKey = await getSecret(env, 'STRIPE_KEY')
  // …
})
```

## Failures

- No binding with that name: a non-exposed `500`, the same as `getBinding`. It
  means the deploy is misconfigured, not that the client did something wrong.
- The read fails (the secret was deleted, the store is unreachable): a
  `CloudflareError` with status 500, code `SECRET_GET_FAILED`, `expose: false`,
  and the original error as `cause`.

Either way `defineFetch` returns `Internal error` to the client. The message
names the binding, never the value.

## Good to know

- `getSecret` does not cache. Every call reads the store, so read the secret once
  per request and pass it along.
- Local dev needs the secret to exist in a local store. See Cloudflare's docs for
  `wrangler secrets-store secret create`.

See the [`secrets` API reference](/docs/api/secrets) for every export.
