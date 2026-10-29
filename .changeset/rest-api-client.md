---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/api` module with `createCloudflareApi`, a small client for Cloudflare's v4 REST API. It covers zones, DNS records and cache purge, and its raw `request`/`requestPage` reach any other endpoint. It adds no dependencies, and any failure throws a non-exposed `502` with code `CF_API_ERROR`.
