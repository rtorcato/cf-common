---
title: access
description: Verify the Cloudflare Access JWT so a Worker behind Zero Trust can trust the caller's identity.
---

`@rtorcato/cf-common/access` verifies the `Cf-Access-Jwt-Assertion` header that
Cloudflare Access adds to requests behind Zero Trust. A Worker should check it
instead of trusting the `Cf-Access-Authenticated-User-Email` header, which anyone
who can reach the Worker directly (for example on `workers.dev`) can forge.

It uses Web Crypto only. No JWT library is involved.

## Verify a request

You need your Access team domain and the application's AUD tag (both in the
Zero Trust dashboard, under the Access application).

```ts
import { accessJwt, verifyAccessJwt } from '@rtorcato/cf-common/access'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { requireEnv } from '@rtorcato/cf-common/env'

const token = accessJwt(request)
if (!token) throw new CloudflareError('Unauthorized', { status: 401 })

const identity = await verifyAccessJwt(token, {
  teamDomain: requireEnv(env, 'ACCESS_TEAM_DOMAIN'), // myteam.cloudflareaccess.com
  aud: requireEnv(env, 'ACCESS_AUD'),
})
identity.email // the signed-in user
```

`accessJwt` returns `null` when the header is missing. `verifyAccessJwt` returns
the token's claims (`email`, `sub`, `iss`, `aud`, `exp`, …) with `aud` always as
an array.

## What is checked

The RS256 signature against the team's published keys, then the issuer
(`https://<teamDomain>`), the `aud` tag, `exp` and `nbf`. Any other signing
algorithm, including `none`, is rejected.

## Key caching

The keys come from `https://<teamDomain>/cdn-cgi/access/certs`. They are cached
in the isolate for an hour. If a token names a key that isn't cached (Cloudflare
rotated them), the keys are refetched, at most once a minute so junk tokens
can't hammer the endpoint.

## When it fails

A token that fails any check throws a `CloudflareError` with status `401` and code
`ACCESS_JWT_INVALID`. If the certs endpoint can't be reached, it throws a
non-exposed `502` with code `ACCESS_JWKS_HTTP_ERROR`. Under `defineFetch` these
map to a `401` and a generic `Internal error`. See [errors](./errors.md).

See the [`access` API reference](/docs/api/access) for the exported types.
