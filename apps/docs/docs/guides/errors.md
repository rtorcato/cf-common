---
title: errors
description: Throw CloudflareError with a status, and let one handler turn it into a JSON response.
---

`@rtorcato/cf-common/errors` gives every module one error type. Throw it from
anywhere in your Worker, and map it to a `Response` once at the edge.

```ts
import { CloudflareError, isCloudflareError, toCloudflareError } from '@rtorcato/cf-common/errors'
```

## Throw with a status

```ts
throw new CloudflareError('Session not found', { status: 404 })
// → status 404, expose true

throw new CloudflareError('Quota exceeded', { status: 429, code: 'QUOTA' })
// → status 429, expose true, code 'QUOTA'

throw new CloudflareError('Upstream timed out')
// → status 500, expose false
```

| Option | Default | Meaning |
|--------|---------|---------|
| `status` | `500` | HTTP status for the response. |
| `expose` | `true` below 500, `false` from 500 up | Whether `message` is safe to send to the client. |
| `code` | none | A stable, machine-readable code to branch on. |
| `cause` | none | The underlying error, kept for logs. |

`expose` is the safety net. A 4xx is the caller's fault, so they get the
message. A 5xx is yours, so they get `Internal error` and the detail stays in
your logs.

## Map it once with `defineFetch`

Wrap your handler in `defineFetch` from `@rtorcato/cf-common/http`. Anything
thrown inside becomes a JSON response with the right status:

```ts
import { defineFetch } from '@rtorcato/cf-common/http'
import { CloudflareError } from '@rtorcato/cf-common/errors'

export default defineFetch(async (request) => {
  if (request.method !== 'GET') {
    throw new CloudflareError('Method not allowed', { status: 405 })
  }
  return Response.json({ ok: true })
})
```

The response body is `{ "error": "<message>", "code": "<code>" }`, with `code` left out when the error has none. A non-exposed
error sends `"Internal error"` as the message. Use `errorResponse(err)` from the
same module if you need the mapping without `defineFetch`.

## Check and coerce

Use `isCloudflareError(e)`, not `instanceof`. Each subpath is bundled on its
own, so an error thrown by `kv` is a different class object from the one in
your code, and `instanceof` returns `false`. The guard checks the shape instead.

```ts
try {
  await store.get(key)
} catch (e) {
  if (isCloudflareError(e) && e.code === 'KV_PARSE_FAILED') {
    await store.delete(key) // drop the bad value and carry on
  } else {
    throw e
  }
}
```

`toCloudflareError(e, status?)` turns any thrown value into a `CloudflareError`.
It passes an existing one through and wraps anything else with the wrapped
error's message and `status` (500 by default). `expose` follows the status, so
the default 500 keeps the message private. Pass a 4xx, and the raw message goes
to the client, so only do that when you know the message is safe to show.

## Codes the modules throw

| Code | Thrown by | When |
|------|-----------|------|
| `KV_PARSE_FAILED` | [`kv`](./kv.md) | A stored value isn't valid JSON. |
| `R2_PARSE_FAILED` | [`r2`](./r2.md) | `getJSON` read an object that isn't valid JSON. |
| `R2_MULTIPART_FAILED` | [`r2`](./r2.md) | A part failed, and the upload was aborted. |
| `D1_MIGRATION_FAILED` | [`d1`](./d1.md) | A migration's SQL threw. |
| `INVALID_BODY` | `request` | `parseJson` got a body that isn't JSON or fails the schema (400). |
| `CRON_NO_MATCH` | `cron` | `defineScheduled` has no job for the firing cron (500). |
| `TURNSTILE_HTTP_ERROR` | `turnstile` | Turnstile's siteverify returned a non-2xx (502). |

A missing binding or env var from [`env`](./env.md) throws a non-exposed 500
with no code.

See the [`errors` API reference](/docs/api/errors).
