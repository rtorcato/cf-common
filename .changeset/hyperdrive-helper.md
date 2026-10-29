---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/hyperdrive` module with `withHyperdrive`, which opens a per-request client over a Hyperdrive binding and always closes it. The driver is yours to pass in through `connect` and `close`, so no driver is bundled. A failed connect throws a non-exposed `502` with code `HYPERDRIVE_CONNECT_FAILED`.
