---
title: hyperdrive
description: A per-request database client over a Hyperdrive binding, always closed, with any driver you bring.
---

`@rtorcato/cf-common/hyperdrive` runs your query inside a client that it always
closes. Hyperdrive does the connection pooling, so you open a client per request.
The helper makes sure you close it, including when the query throws.

```ts
import { withHyperdrive } from '@rtorcato/cf-common/hyperdrive'
import { getBinding } from '@rtorcato/cf-common/env'

const hd = getBinding<Hyperdrive>(env, 'HYPERDRIVE')
```

No database driver is bundled. You pass `connect` and `close`, so the driver stays
your dependency.

## With `postgres`

```ts
import postgres from 'postgres'

const rows = await withHyperdrive(
  hd,
  { connect: (cs) => postgres(cs), close: (sql) => sql.end() },
  (sql) => sql`SELECT * FROM users WHERE id = ${id}`
)
```

## With `pg`

```ts
import { Client } from 'pg'

const rows = await withHyperdrive(
  hd,
  {
    connect: async (cs) => {
      const client = new Client({ connectionString: cs })
      await client.connect()
      return client
    },
    close: (client) => client.end(),
  },
  async (client) => (await client.query('SELECT * FROM users WHERE id = $1', [id])).rows
)
```

## With `ctx`

Pass the `ExecutionContext` to have `close` run in `ctx.waitUntil`. The response
then goes out without waiting for the socket to close:

```ts
const rows = await withHyperdrive(
  hd,
  { connect: (cs) => postgres(cs), close: (sql) => sql.end(), ctx },
  (sql) => sql`SELECT 1`
)
```

## When the call fails

If `connect` fails, the helper throws a `CloudflareError` with status `502`, code
`HYPERDRIVE_CONNECT_FAILED` and the original error as `cause`. The message is not
exposed to clients. Errors from your query pass through unchanged, so catch them
where you run the query. A failing `close` is dropped, so it never hides the result
or the error from `work`. See [errors](./errors.md) for how to catch these.

## Good to know

- Use one client per request. Don't cache a client across requests in a Worker.
- `connect` and `close` receive the binding's `connectionString`. Caching and
  `localConnectionString` are set in your Wrangler config, not here.

See the [`hyperdrive` API reference](/docs/api/hyperdrive) for every option.
