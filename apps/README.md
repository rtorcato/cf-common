# apps

Workspace apps that exercise and document [`@rtorcato/cf-common`](../).

| App | What it is |
| --- | ---------- |
| [`docs`](./docs) | Docusaurus site — guides and the generated API reference. |
| [`example`](./example) | A Worker showing each `cf-common` module against real bindings (`wrangler dev`). |

## What `cf-common` cleans up

Each module wraps a raw Cloudflare binding so callers stop re-writing the same
JSON-parse / null-check / bind boilerplate. The examples below are what the
`example` Worker demonstrates.

### `@rtorcato/cf-common/env` — typed bindings, no `as`

```ts
import { requireEnv, getBinding } from '@rtorcato/cf-common/env'

const db = getBinding<D1Database>(env, 'DB')
const apiKey = requireEnv(env, 'API_KEY') // throws CloudflareError if missing
```

### `@rtorcato/cf-common/kv` — typed JSON store

```ts
import { createKvStore } from '@rtorcato/cf-common/kv'

const users = createKvStore<User>(env.USERS)
await users.put(id, user, { ttl: 3600 })
const user = await users.get(id) // User | null, no JSON.parse
```

### `@rtorcato/cf-common/r2` — objects with JSON helpers

```ts
import { createR2Store } from '@rtorcato/cf-common/r2'

const docs = createR2Store<Doc>(env.DOCS)
await docs.putJSON('a.json', doc)
const doc = await docs.getJSON('a.json') // Doc | null
```

### `@rtorcato/cf-common/d1` — query without prepare/bind ceremony

```ts
import { query, queryFirst, runMigrations } from '@rtorcato/cf-common/d1'

const rows = await query<User>(env.DB, 'SELECT * FROM users WHERE age > ?', 18)
const one = await queryFirst<User>(env.DB, 'SELECT * FROM users WHERE id = ?', id)
await runMigrations(env.DB, migrations)
```

### `@rtorcato/cf-common/errors` — one error type

```ts
import { toCloudflareError } from '@rtorcato/cf-common/errors'

try {
  await users.get(id)
} catch (err) {
  const cfErr = toCloudflareError(err, 500) // normalizes anything thrown
  return Response.json({ error: cfErr.message }, { status: cfErr.status })
}
```

## Run

```sh
pnpm --filter example dev   # wrangler dev
pnpm --filter docs start    # docs site
```
