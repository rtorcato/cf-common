---
title: kv
description: A typed JSON store over a KV namespace, with TTLs, metadata and listing.
---

`@rtorcato/cf-common/kv` wraps a `KVNamespace` binding as a typed store.
Values go in and come out as JSON, so you work with objects instead of strings.

```ts
import { createKvStore } from '@rtorcato/cf-common/kv'
import { getBinding } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'

interface Session {
  userId: string
  createdAt: string
}

const sessions = createKvStore<Session>(getBinding<KVNamespace>(env, 'SESSIONS'))
```

## Read and write

```ts
await sessions.put(id, { userId: 'u_42', createdAt: new Date().toISOString() })

const session = await sessions.get(id) // Session | null
if (!session) throw new CloudflareError('Session not found', { status: 404 })

await sessions.delete(id)
```

`get` returns `null` for a missing key, never `undefined`.

## Expiry and metadata

```ts
// gone in an hour
await sessions.put(id, session, { ttl: 3600 })

// gone at a fixed time (unix seconds)
await sessions.put(id, session, { expiration: Math.floor(Date.now() / 1000) + 86_400 })

// metadata rides along with the key and comes back from list()
await sessions.put(id, session, { metadata: { userId: session.userId } })
```

`ttl` maps to KV's `expirationTtl`, which has a 60-second minimum.

## List by prefix

```ts
let cursor: string | undefined
do {
  const page = await sessions.list({ prefix: 'u_42:', cursor })
  for (const { name, metadata } of page.keys) {
    // ...
  }
  cursor = page.list_complete ? undefined : page.cursor
} while (cursor)
```

`list` passes straight through to the binding, so it takes the same options
and returns the same shape.

## When the value isn't JSON

If a key holds something that isn't valid JSON, written by another tool for
example, `get` throws a `CloudflareError` with code `KV_PARSE_FAILED`. Under
`defineFetch`, that becomes a 500. See [errors](./errors.md) for how to catch
it.

## Good to know

- KV is eventually consistent. A write can take up to about 60 seconds to reach
  other locations, so use it for caches, sessions and config, not counters.
- One store wraps one namespace. Create one per binding.

For a full walkthrough, see the [KV cache example](/docs/examples/kv-cache).
See the [`kv` API reference](/docs/api/kv) for every option.
