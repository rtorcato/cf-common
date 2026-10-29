---
title: turnstile
description: Verify a Turnstile token server-side, or assert it and throw a 403 on a failed challenge.
---

`@rtorcato/cf-common/turnstile` checks a Turnstile token against Cloudflare's
`siteverify` endpoint. The widget on your page produces the token. Your Worker
has to verify it before trusting the request.

```ts
import { assertTurnstile, verifyTurnstile } from '@rtorcato/cf-common/turnstile'
```

Keep the secret key out of source: `wrangler secret put TURNSTILE_SECRET`.

## Assert

`assertTurnstile` returns the result when the challenge passed and throws a `403`
`CloudflareError` when it didn't. Past this line, the token is valid.

```ts
import { requireEnv } from '@rtorcato/cf-common/env'
import { defineFetch } from '@rtorcato/cf-common/http'
import { clientIp } from '@rtorcato/cf-common/request'

export default defineFetch<Env>(async (request, env) => {
  const form = await request.formData()
  const token = String(form.get('cf-turnstile-response') ?? '')

  await assertTurnstile(token, requireEnv(env, 'TURNSTILE_SECRET'), {
    remoteip: clientIp(request) ?? undefined,
  })

  return Response.json({ ok: true })
})
```

The error's `code` is Turnstile's first error code (`invalid-input-response`,
`timeout-or-duplicate`, …), or `TURNSTILE_FAILED` when none is given. It is
exposed, so the client sees it.

## Verify

`verifyTurnstile` takes the same arguments and returns the raw `siteverify`
result without throwing on a failed challenge. Use it when you want to branch:

```ts
const result = await verifyTurnstile(token, secret)
if (!result.success) {
  console.log('turnstile failed', result['error-codes'])
  return error(403, 'Failed challenge')
}
```

The result also carries `hostname`, `action`, `cdata` and `challenge_ts`, so you
can check the token came from your site and form.

## When the call fails

If `siteverify` itself returns a non-2xx status, both functions throw a `502`
`CloudflareError` with code `TURNSTILE_HTTP_ERROR`. That is an outage, not a
failed challenge.

## Good to know

- A token is single use and expires after a few minutes. A second check of the
  same token fails with `timeout-or-duplicate`.
- `remoteip` is optional. Pass it to have Cloudflare compare it with the visitor
  that solved the challenge.
- Cloudflare publishes test site keys and secrets that always pass or always
  fail. Use them in development and tests.

For a runnable walkthrough, see the `/turnstile` route in `apps/example`. See the
[`turnstile` API reference](/docs/api/turnstile) for every option.
