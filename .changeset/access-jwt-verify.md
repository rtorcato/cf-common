---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/access` module with `verifyAccessJwt`, which checks the Cloudflare Access JWT against the team JWKS (signature, issuer, audience, expiry) and returns the typed identity, and `accessJwt`, which reads the `Cf-Access-Jwt-Assertion` header. A bad token throws a `401` with code `ACCESS_JWT_INVALID`.
