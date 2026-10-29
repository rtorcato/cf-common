---
title: do
description: A Durable Object base class with key-checked access to its storage.
---

`@rtorcato/cf-common/do` gives a Durable Object a typed `this.storage`: you
declare which keys it keeps and the type of each value, and `get`/`put`/`delete`
only accept those keys and types.

```ts
import { BaseDurableObject } from '@rtorcato/cf-common/do'

interface CounterState {
  count: number
  lastReset: Date
}

export class Counter extends BaseDurableObject<Env, CounterState> {
  async increment(): Promise<number> {
    const count = (await this.storage.get('count', 0)) + 1
    await this.storage.put('count', count)
    return count
  }

  async reset(): Promise<void> {
    await this.storage.put('count', 0)
    await this.storage.put('lastReset', new Date())
  }
}
```

`BaseDurableObject` extends the runtime's `DurableObject` from
`cloudflare:workers`, so RPC methods, `fetch`, `alarm` and WebSocket handlers
work as usual. `this.ctx` and `this.env` are still there.

Bind and call it as any Durable Object:

```jsonc
// wrangler.jsonc
"durable_objects": { "bindings": [{ "name": "COUNTER", "class_name": "Counter" }] },
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["Counter"] }]
```

```ts
const count = await env.COUNTER.getByName('global').increment()
```

## Storage

| Call | Returns |
| --- | --- |
| `get(key)` | the value, or `undefined` if the key was never written |
| `get(key, fallback)` | the value, or `fallback` if the key was never written |
| `put(key, value)` | `void` |
| `delete(key)` | `true` if the key existed |

Values are stored with structured clone, not JSON, so a `Date`, `Map` or
`Uint8Array` comes back as itself. For `list`, transactions, alarms or SQL, use
`this.ctx.storage` directly.

To type storage without the base class, wrap it yourself:

```ts
import { typedStorage } from '@rtorcato/cf-common/do'

const storage = typedStorage<CounterState>(ctx.storage)
```

## Good to know

- The subpath imports `cloudflare:workers`, so it only loads under workerd
  (`wrangler dev`, a deployed Worker, or `@cloudflare/vitest-plugin`), not in
  plain Node.
- The schema is a compile-time check. Nothing validates what is already in
  storage, so change a key's type with a new key or a migration.

See the [`do` API reference](/docs/api/do) for every export.
