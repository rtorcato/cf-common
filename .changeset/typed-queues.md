---
'@rtorcato/cf-common': minor
---

Add `@rtorcato/cf-common/queues`: `createProducer` wraps a `Queue` binding (typed `send`, `sendBatch` split into chunks of 100, failures as `QUEUE_SEND_FAILED`), and `defineQueue` builds a `queue` handler that acks or retries each message individually, with an optional `retryDelay` backoff.
