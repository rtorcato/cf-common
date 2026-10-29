---
title: assets
description: Serve from the Static Assets binding with an SPA or 404-page fallback.
---

`@rtorcato/cf-common/assets` is two small helpers over the
[Static Assets](https://developers.cloudflare.com/workers/static-assets/) binding
(`env.ASSETS`), for a Worker that runs before its assets and decides per route
what a miss should return. It is not a router.

```jsonc
// wrangler.jsonc
"assets": { "directory": "./public", "binding": "ASSETS", "run_worker_first": true }
```

```ts
import { serveAssets } from '@rtorcato/cf-common/assets'
import { getBinding } from '@rtorcato/cf-common/env'
import { defineFetch } from '@rtorcato/cf-common/http'

export default defineFetch(async (request, env) => {
  const assets = getBinding<Fetcher>(env, 'ASSETS')
  const { pathname } = new URL(request.url)

  if (pathname.startsWith('/api/')) return handleApi(request, env)
  if (pathname.startsWith('/app')) return serveAssets(assets, request, { spa: '/app/' })
  return serveAssets(assets, request, { notFound: '/404' })
})
```

## serveAssets

`serveAssets(assets, request, { spa?, notFound? })` fetches the request from the
binding and returns the asset if it matched. On a 404 it tries, in order:

1. `spa`: for a `GET` or `HEAD` whose `Accept` header includes `text/html` (a
   browser page load), the asset at that path, with status 200. A missing
   `/app.js` or a `fetch()` with `Accept: */*` still gets a 404.
2. `notFound`: that asset's body and headers with status 404.
3. Otherwise the binding's own 404.

## fetchAsset

`fetchAsset(assets, request, path)` fetches the asset at `path`, resolved
against the request URL, with the request's headers. `HEAD` stays `HEAD` and
any other method becomes `GET`, since the binding only serves reads.

```ts
// Serve one template for every /blog/<slug>
if (pathname.startsWith('/blog/')) return fetchAsset(assets, request, '/blog/post')
```

## Good to know

- Paths are the URLs assets are served at, not file names. With the default
  `html_handling`, `index.html` is served at `/` and `404.html` at `/404`, and a
  request for `/index.html` redirects, so pass `'/'` rather than
  `'/index.html'`.
- If the whole site wants one rule, set `not_found_handling` to
  `"single-page-application"` or `"404-page"` in wrangler config. That needs no
  code; these helpers are for choosing per route.
- A missing `ASSETS` binding is a deploy misconfiguration. `getBinding` throws a
  non-exposed `500` for it.

See the [`assets` API reference](/docs/api/assets) for every export.
