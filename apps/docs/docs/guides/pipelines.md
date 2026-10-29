---
title: pipelines
description: Send typed records to a Cloudflare Pipeline, with batches chunked and failures mapped to a CloudflareError.
---

`@rtorcato/cf-common/pipelines` wraps a
[Pipeline](https://developers.cloudflare.com/pipelines/) binding, Cloudflare's
streaming ingestion into R2. The binding's `send()` takes an array of untyped
records; `createPipelineProducer` gives you a typed `send(record)` and a
chunked `sendBatch(records)`.

```ts
import { createPipelineProducer } from '@rtorcato/cf-common/pipelines'
import { getBinding } from '@rtorcato/cf-common/env'
import type { Pipeline } from 'cloudflare:pipelines'

interface PageView extends Record<string, unknown> {
  userId: string
  path: string
  at: number
}

const views = createPipelineProducer<PageView>(getBinding<Pipeline<PageView>>(env, 'VIEWS'))
```

## Bind it

Create the pipeline with Wrangler, then bind it:

```jsonc
{
  "pipelines": [{ "pipeline": "page-views", "binding": "VIEWS" }]
}
```

## Send

```ts
await views.send({ userId, path: url.pathname, at: Date.now() })
```

The record type is asserted, not validated: pair it with your own schema if
the data comes from outside.

## Send in batches

```ts
await views.sendBatch(rows.map((r) => ({ userId: r.id, path: r.path, at: r.at })))
```

`sendBatch` splits the records into `send` calls of 100 and sends them in
order. Pass `{ chunkSize }` to change that; the default is this package's
choice, not a limit Cloudflare publishes for the binding. It stops at the first
chunk that fails, so earlier chunks stay delivered. A `chunkSize` that isn't a
positive integer throws a `CloudflareError` with status `500` and code
`PIPELINE_INVALID_CHUNK_SIZE` before anything is sent.

## When a send fails

A rejected `send` becomes a `CloudflareError` with status `502`, code
`PIPELINE_SEND_FAILED` and the original error as `cause`. The message is not
exposed, so `defineFetch` returns a generic error to the client. See
[errors](./errors.md) for how to catch it.

Use `ctx.waitUntil(views.send(...))` if the response shouldn't wait on the
pipeline, and catch the rejection yourself in that case.

See the [`pipelines` API reference](/docs/api/pipelines) for the full signatures.
