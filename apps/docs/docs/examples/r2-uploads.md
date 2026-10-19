---
title: R2 uploads
description: Accept file uploads into R2, serve them back, and keep a JSON manifest alongside.
sidebar_position: 3
---

# R2 uploads

A Worker that takes a `PUT` of any file, streams it into R2, and serves it back
on `GET`. `createR2Store` passes raw object calls through to the binding, and
its `putJSON` / `getJSON` helpers handle a small JSON manifest next to each
upload.

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'
import { createR2Store } from '@rtorcato/cf-common/r2'
import { bearerToken } from '@rtorcato/cf-common/request'

interface Env {
  [key: string]: unknown
  UPLOADS: R2Bucket
  UPLOAD_TOKEN: string
}

// Content types that are safe to serve from this Worker's origin.
const SAFE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'application/pdf',
])

interface Manifest {
  key: string
  size: number
  contentType: string
  uploadedAt: string
}

export default defineFetch<Env>(async (req, env) => {
  const key = new URL(req.url).pathname.slice(1)
  if (!key) throw new CloudflareError('Missing object key', { status: 400 })

  const bucket = getBinding<R2Bucket>(env, 'UPLOADS')
  const files = createR2Store(bucket)
  const manifests = createR2Store<Manifest>(bucket)

  if (req.method === 'PUT') {
    if (!env.UPLOAD_TOKEN) {
      throw new CloudflareError('UPLOAD_TOKEN is not set', { status: 500 })
    }
    // Compare in constant time, so response timing doesn't leak the token.
    const enc = new TextEncoder()
    const given = enc.encode(bearerToken(req) ?? '')
    const expected = enc.encode(env.UPLOAD_TOKEN)
    if (given.byteLength !== expected.byteLength || !crypto.subtle.timingSafeEqual(given, expected)) {
      throw new CloudflareError('Unauthorized', { status: 401 })
    }
    const contentType = req.headers.get('content-type') ?? 'application/octet-stream'
    // Stream the body straight in; nothing is buffered in the Worker.
    const object = await files.put(key, req.body, { httpMetadata: { contentType } })
    if (!object) throw new CloudflareError('Upload failed')

    const manifest: Manifest = {
      key,
      size: object.size,
      contentType,
      uploadedAt: object.uploaded.toISOString(),
    }
    await manifests.putJSON(`${key}.manifest.json`, manifest)
    return Response.json(manifest, { status: 201 })
  }

  if (req.method === 'GET') {
    const object = await files.get(key)
    if (!object) throw new CloudflareError('Not found', { status: 404 })
    const stored = object.httpMetadata?.contentType ?? ''
    return new Response(object.body, {
      headers: {
        // Don't replay the uploader's type as-is; see the note below.
        'content-type': SAFE_TYPES.has(stored) ? stored : 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        etag: object.httpEtag,
      },
    })
  }

  throw new CloudflareError('Method not allowed', { status: 405 })
})
```

The `content-type` on a `PUT` comes from whoever uploaded the file. If `GET`
sent it back as-is, an uploader could store `text/html` or `image/svg+xml` and
run script on your Worker's origin (stored XSS). So `GET` serves only the types
in `SAFE_TYPES`, falls back to `application/octet-stream` for everything else,
and sends `x-content-type-options: nosniff` so the browser doesn't guess. If
you need to serve other files, send `content-disposition: attachment` so they
download instead of rendering.

Try it under `wrangler dev`:

```bash
curl -X PUT --data-binary @photo.jpg -H 'content-type: image/jpeg' \
  -H 'authorization: Bearer dev-token' http://localhost:8787/photos/photo.jpg
curl http://localhost:8787/photos/photo.jpg.manifest.json
```

## Large files

A single `put` is limited by the Worker's request body size. For files you
already hold in chunks, `multipartUpload` runs create, upload parts, and
complete, and aborts the upload if any part fails:

```ts
import { multipartUpload } from '@rtorcato/cf-common/r2'

// Every part except the last must be at least 5 MiB.
await multipartUpload(env.UPLOADS, 'videos/big.mp4', [part1, part2, part3], {
  httpMetadata: { contentType: 'video/mp4' },
})
```

A failure throws a `CloudflareError` with code `R2_MULTIPART_FAILED`.

## Binding

```jsonc
// wrangler.jsonc
"r2_buckets": [{ "binding": "UPLOADS", "bucket_name": "my-uploads" }],
"vars": { "UPLOAD_TOKEN": "dev-token" } // use `wrangler secret put` in production
```

Presigned URLs need the S3-compatible API and account credentials, so they are
not part of this module. See the [`r2` API reference](/docs/api/r2).
