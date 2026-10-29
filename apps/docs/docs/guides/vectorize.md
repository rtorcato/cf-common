---
title: vectorize
description: Typed upsert and query over a Vectorize index, with chunked upserts and metadata types you choose.
---

`@rtorcato/cf-common/vectorize` wraps one Vectorize index. You give it the metadata
type, and it types the metadata on writes and reads. Upserts are split into chunks
of 1000, the Workers binding limit. A failed call becomes a `CloudflareError`.

```ts
import { createVectorStore } from '@rtorcato/cf-common/vectorize'
import { getBinding } from '@rtorcato/cf-common/env'

const docs = createVectorStore<{ url: string; title: string }>(getBinding<Vectorize>(env, 'DOCS'))
```

The metadata type is asserted, not checked at runtime. Vectorize's own rules still
apply: values are strings, numbers, booleans or string arrays.

## Upsert

```ts
const mutationIds = await docs.upsert([
  { id: 'intro', values, metadata: { url: '/intro', title: 'Intro' } },
])
```

Each chunk of up to 1000 vectors is one call to the binding, and the result has one
`mutationId` per chunk, in order. Chunks go in order, and sending stops at the first
failed chunk. Vectors in earlier chunks stay upserted. An upsert replaces a vector
with the same ID, so retrying the whole batch is safe. An empty list returns `[]`
and makes no call.

## Query

```ts
const { matches, count } = await docs.query(values, { topK: 5, returnMetadata: 'all' })
matches[0]?.metadata?.title // string | undefined
```

`topK` is capped by Cloudflare: 100 when you don't return values or metadata, and
50 when you do. `queryById` searches from a vector already in the index, and
`getByIds` and `deleteByIds` take a list of IDs.

## Embed and search

Vectorize stores vectors, not text. Make the vector with Workers AI and pass it to
`query`:

```ts
import { runAi } from '@rtorcato/cf-common/ai'

// A synchronous embedding comes back as `{ data }`. The async variant has no `data`.
const { data } = (await runAi(ai, '@cf/baai/bge-base-en-v1.5', { text: question })) as {
  data?: number[][]
}
const values = data?.[0]
if (values) {
  const { matches } = await docs.query(values, { topK: 5, returnMetadata: 'all' })
}
```

## When the call fails

Any rejection from the binding throws a `CloudflareError` with status `502`, code
`VECTORIZE_FAILED` and the original error as `cause`. The message is not exposed to
clients, so under `defineFetch` the response is a generic `Internal error`. Log `cause`
if you need the detail. See [errors](./errors.md) for how to catch it.

## Good to know

- Mutations are async. A `query` straight after an `upsert` can miss the new vectors
  until the index has processed the mutation.
- Metadata is capped at 10 KiB per vector, and IDs at 64 bytes.
- Index creation, `insert`, and the beta `VectorizeIndex` class aren't covered here.
  Create indexes with Wrangler or the REST API.

See the [`vectorize` API reference](/docs/api/vectorize) for every option.
