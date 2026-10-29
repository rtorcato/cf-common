---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/vectorize` module with `createVectorStore<M>`, a typed store over one Vectorize index. It adds caller-typed metadata, `upsert` split into chunks of 1000 with one `mutationId` per chunk, and failures mapped to a non-exposed `502` with code `VECTORIZE_FAILED`.
