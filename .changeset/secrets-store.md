---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/secrets` module with `getSecret`, typed access to a Secrets Store binding by name: a missing binding is a non-exposed `500`, and a failed read becomes a non-exposed `500` with code `SECRET_GET_FAILED`.
