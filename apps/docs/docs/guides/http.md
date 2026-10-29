---
title: http
description: defineFetch maps a thrown CloudflareError to a JSON response, plus error responses and CORS helpers.
---

`@rtorcato/cf-common/http` is the response side of a Worker: one wrapper that
turns thrown errors into JSON, and a few CORS helpers. It is not a router. Bring
your own, or `switch` on `URL.pathname`.

```ts
import { defineFetch, error, preflight, withCors } from '@rtorcato/cf-common/http'
```

There is no `json()` helper. Use the native `Response.json(data, init)`.

## defineFetch

Wrap your handler and `export default` the result. Anything it throws becomes a
`Response`, so the handler needs no `try/catch`.

```ts
import { requireEnv } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'

export default defineFetch<Env>(async (request, env) => {
  if (request.method !== 'GET') throw new CloudflareError('Method not allowed', { status: 405 })
  return Response.json({ region: requireEnv(env, 'REGION') })
})
```

A thrown `CloudflareError` keeps its `status` and `code`. Its message is sent
only when `expose` is true (the default for 4xx). A 5xx, or any other thrown
value, goes out as `{ "error": "Internal error" }` with status 500, so internals
don't leak. See [errors](./errors.md) for the model.

`defineFetch` returns an `ExportedHandler`, so you can spread it to add other
handlers to the same Worker:

```ts
const api = defineFetch<Env>(handler)

export default {
  ...api,
  scheduled: defineScheduled<Env>({ '0 * * * *': hourly }),
}
```

## Error responses

`error(status, message)` builds the same `{ error }` JSON body directly, for when
you return early instead of throwing:

```ts
if (!id) return error(400, 'Missing id')
```

`errorResponse(err)` is the mapping `defineFetch` uses. Call it yourself if you
need the same output from your own `catch`.

## CORS

```ts
const cors = { origin: 'https://app.example.com', maxAge: 600 }

export default defineFetch(async (request) => {
  if (request.method === 'OPTIONS') return preflight(cors)
  return withCors(Response.json({ ok: true }), cors)
})
```

| Option    | Header                         | Default             |
| --------- | ------------------------------ | ------------------- |
| `origin`  | `Access-Control-Allow-Origin`  | `*`                 |
| `methods` | `Access-Control-Allow-Methods` | `GET,POST,OPTIONS`  |
| `headers` | `Access-Control-Allow-Headers` | `Content-Type`      |
| `maxAge`  | `Access-Control-Max-Age`       | not set             |

`corsHeaders(options)` returns the header object if you are building the
`Response` yourself.

## Good to know

- The defaults are permissive. Set `origin` in production.
- `withCors` copies the response, so the original's headers don't need to be
  mutable.
- A response from `defineFetch`'s error mapping has no CORS headers. If a browser
  calls the Worker cross-origin, catch and wrap it with `withCors(errorResponse(e), cors)`.

For a runnable walkthrough, see the `/echo` route in `apps/example`. See the
[`http` API reference](/docs/api/http) for every option.
