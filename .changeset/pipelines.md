---
'@rtorcato/cf-common': minor
---

Add the `pipelines` subpath: `createPipelineProducer<T>(pipeline)` wraps a Pipeline binding so `send(record)` and `sendBatch(records, { chunkSize? })` take typed records (batches go out in order in chunks of 100 by default), and a rejected send becomes a non-exposed 502 `CloudflareError` with code `PIPELINE_SEND_FAILED`.
