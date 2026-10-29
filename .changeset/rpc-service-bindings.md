---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/rpc` module with `getService`, a typed accessor for Service Bindings to a `WorkerEntrypoint`, and `callService`, which maps a failed RPC call to a non-exposed `502` with code `RPC_CALL_FAILED`.
