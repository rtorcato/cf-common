---
"@rtorcato/cf-common": major
---

Node 24 is now required (`engines.node` is `>=24`, up from `>=22`), to match `@rtorcato/js-common` 6, which cf-common now depends on (`^6.1.0`, up from `^5.0.0`). The js-common bump also brings 6.1.0's `HttpError` fix: the error message now shows a redacted URL (no userinfo, query or fragment), so a `?token=…` in a request URL no longer ends up in error messages or logs. `error.url` still holds the raw URL.
