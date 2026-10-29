---
title: request
description: Typed request.cf metadata, schema-validated JSON bodies, the bearer token and the client IP.
---

`@rtorcato/cf-common/request` reads the parts of an incoming `Request` that every
Worker needs. Each helper takes the `Request` and returns a value. There is no
request wrapper.

```ts
import { bearerToken, cf, clientIp, parseJson } from '@rtorcato/cf-common/request'
```

## Validate a JSON body

`parseJson(request, schema)` reads the body and runs it through your schema. The
schema only needs a `parse(input)` method, so a Zod schema works as is.

```ts
import { z } from 'zod'

const body = await parseJson(request, z.object({ email: z.string().email() }))
// body: { email: string }
```

Malformed JSON and a failed validation both throw an exposed `400`
`CloudflareError` with code `INVALID_BODY`. Under `defineFetch` the client gets
`{ "error": "...", "code": "INVALID_BODY" }`. The validator's message is the
error message, so keep it client-safe.

## Bearer token

```ts
import { CloudflareError } from '@rtorcato/cf-common/errors'

const token = bearerToken(request)
if (!token) throw new CloudflareError('Missing token', { status: 401 })
```

Returns the token from `Authorization: Bearer <token>`, or `null` when the header
is missing or malformed. The `Bearer` scheme is case-insensitive. Checking the
token is up to you.

## Client IP

```ts
const ip = clientIp(request) ?? 'unknown'
```

Reads the `CF-Connecting-IP` header Cloudflare sets on every request. Returns
`null` when the header is absent, for example on a synthetic `Request` in a test.

## request.cf

```ts
const country = cf(request)?.country ?? 'unknown'
const colo = cf(request)?.colo
```

`cf(request)` returns `request.cf` typed as the incoming request's properties
(`country`, `colo`, `tlsVersion`, `asn`, …). It is `undefined` under
`wrangler dev` without `--remote` and on a synthetic `Request`, so always handle
the missing case.

For a runnable walkthrough, see the `/whoami` and `/echo` routes in
`apps/example`. See the [`request` API reference](/docs/api/request) for every
option.
