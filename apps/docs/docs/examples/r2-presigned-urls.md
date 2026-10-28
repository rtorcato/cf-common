---
title: R2 presigned URLs
description: Hand out short-lived URLs that upload to or download from R2 directly, without streaming the bytes through your Worker.
sidebar_position: 5
---

# R2 presigned URLs

A presigned URL lets a client `PUT` or `GET` one R2 object directly, until it
expires, with no other credentials. The Worker checks who is asking and signs
the URL. The bytes go straight to R2, so a large upload never passes through
the Worker.

The R2 binding can't sign these. `presignR2Url` signs them over R2's
S3-compatible endpoint with an R2 API token and AWS SigV4, using Web Crypto,
so it adds no dependency.

## Setup

1. In the Cloudflare dashboard, go to **R2 → Manage API tokens** and create a
   token with **Object Read & Write**, scoped to the one bucket. Note the access
   key id and secret.
2. Store them as secrets, and your account id as a var:

```sh
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

```jsonc
// wrangler.jsonc
"vars": { "R2_ACCOUNT_ID": "<your 32-character account id>" }
```

## Issue an upload URL

```ts
import { requireEnv } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'
import { presignR2Url } from '@rtorcato/cf-common/r2-presign'
import { bearerToken } from '@rtorcato/cf-common/request'

export default defineFetch(async (request, env: Record<string, unknown>) => {
  const userId = await authenticate(bearerToken(request)) // your auth
  if (!userId) throw new CloudflareError('Unauthorized', { status: 401 })

  const credentials = {
    accountId: requireEnv(env, 'R2_ACCOUNT_ID'),
    accessKeyId: requireEnv(env, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(env, 'R2_SECRET_ACCESS_KEY'),
    bucket: 'uploads',
  }
  // Build the key yourself. Never sign a key the client chose verbatim.
  const key = `avatars/${userId}.png`

  return Response.json({
    upload: await presignR2Url({ ...credentials, key, method: 'PUT', expiresIn: 300 }),
    download: await presignR2Url({ ...credentials, key, expiresIn: 3600 }),
  })
})
```

The client then uploads with a plain `PUT`:

```sh
curl -X PUT --upload-file avatar.png -H 'Content-Type: image/png' "$UPLOAD_URL"
```

A browser `fetch` to the URL also needs a
[CORS policy on the bucket](https://developers.cloudflare.com/r2/buckets/cors/)
that allows your origin and the `PUT` method.

## What the URL allows

- One method (`GET` by default, or `PUT`) on one key, until `expiresIn`
  seconds pass (default 3600, maximum 604800, which is 7 days).
- Only the `host` header is signed, so a `PUT` client can send any
  `Content-Type` and any size. If that matters, check the object after upload
  (for example with `createR2Store(bucket).head(key)`) before you trust it.
- Anyone who has the URL can use it, so treat it like a short-lived password.

## Errors

| Code | Status | When |
| --- | --- | --- |
| `R2_PRESIGN_INVALID` | 500, not exposed | `accountId` isn't 32 hex characters, or `expiresIn` isn't an integer from 1 to 604800 |
| `R2_PRESIGN_INVALID_KEY` | 400 | the key is empty or has a `.` or `..` segment |

See the [`r2-presign` API reference](/docs/api/r2-presign) for every option.
