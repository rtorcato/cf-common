---
title: api
description: A small client for Cloudflare's REST API, covering zones, DNS records and cache purge.
---

`@rtorcato/cf-common/api` calls Cloudflare's v4 REST API over `fetch`. It covers
zones, DNS records and cache purge, and `request` reaches any other endpoint. It
adds no dependencies, so it stays small enough for a Worker.

```ts
import { createCloudflareApi } from '@rtorcato/cf-common/api'
```

## The token

The client authenticates with an
[API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
Give the token only the permissions you use: **Zone Read** to list zones,
**DNS Edit** to change records and **Cache Purge** to purge. Keep it out of
source with `wrangler secret put CLOUDFLARE_API_TOKEN`.

```ts
import { requireEnv } from '@rtorcato/cf-common/env'

const cf = createCloudflareApi({ token: requireEnv(env, 'CLOUDFLARE_API_TOKEN') })
```

## Zones

```ts
const { result: zones } = await cf.zones.list({ name: 'example.com' })
const zone = await cf.zones.get(zones[0].id)
```

## DNS

```ts
const { result: records } = await cf.dns.list(zone.id, { type: 'A' })

const record = await cf.dns.create(zone.id, {
  type: 'A',
  name: 'app.example.com',
  content: '192.0.2.1',
  proxied: true,
})

// PATCH: only the fields you pass change.
await cf.dns.update(zone.id, record.id, { content: '192.0.2.2' })
await cf.dns.delete(zone.id, record.id)
```

## Purge cache

Pass one purge mode per call: `files`, `tags`, `hosts`, `prefixes` or
`purge_everything`.

```ts
await cf.cache.purge(zone.id, { files: ['https://example.com/app.css'] })
await cf.cache.purge(zone.id, { purge_everything: true })
```

Cloudflare limits how many URLs, tags or prefixes one request may carry. See
[Purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/) for
the current limits.

## Other endpoints

`request` calls any v4 endpoint and returns the envelope's `result`.
`requestPage` does the same for a list endpoint and also returns its
`result_info`. The path is used as given, so encode any ids you put into it.

```ts
const token = await cf.request<{ status: string }>('GET', '/user/tokens/verify')

const accountId = encodeURIComponent(requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID'))
const workers = await cf.requestPage<{ id: string }>(`/accounts/${accountId}/workers/scripts`)
```

List calls return one page. To read them all, loop on `page`:

```ts
const all = []
for (let page = 1; ; page++) {
  const { result, resultInfo } = await cf.zones.list({ page, per_page: 50 })
  all.push(...result)
  if (page >= (resultInfo.total_pages ?? 1)) break
}
```

## When the call fails

Every failure throws a `CloudflareError` with status `502`, code `CF_API_ERROR`
and `expose: false`. That covers a non-2xx response, `success: false` in the
body, a body that isn't JSON, and a network error. The message names the method,
path and Cloudflare's first error message, but never the token.

The named helpers reject a zone or record id of `.` or `..` before sending
anything, with an exposed `400` and code `CF_API_INVALID_ID`, since `fetch`
would resolve it to a different endpoint. Raw `request` sends its path as given.

For an API error, `cause` holds the upstream status and Cloudflare's `errors`,
so you can branch on a 404 or a 429:

```ts
import { isCloudflareError } from '@rtorcato/cf-common/errors'

try {
  await cf.zones.get(zoneId)
} catch (err) {
  const upstream = isCloudflareError(err) ? (err.cause as { status?: number }) : undefined
  if (upstream?.status === 404) return error(404, 'No such zone')
  throw err
}
```

For a network error, `cause` is the error `fetch` threw.

## Good to know

- `Zone` and `DnsRecord` type only the common fields. For the full payload, call
  `request<YourType>` with your own type.
- There are no retries, timeouts or auto-pagination. Handle a 429 from `cause`.
- Only API tokens are supported, not the global API key.
- For the whole API, use Cloudflare's official
  [`cloudflare`](https://www.npmjs.com/package/cloudflare) SDK. This module stays
  small for the common Worker tasks.

For a runnable walkthrough, see the `/api` route in `apps/example`. See the
[`api` API reference](/docs/api/api) for every option.
