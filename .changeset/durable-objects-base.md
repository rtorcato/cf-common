---
'@rtorcato/cf-common': minor
---

Add `@rtorcato/cf-common/do`: `BaseDurableObject` extends the runtime's `DurableObject` and adds a typed `this.storage`, and `typedStorage` wraps any `DurableObjectStorage` so `get` (with an optional fallback), `put` and `delete` are checked against a key → value schema.
