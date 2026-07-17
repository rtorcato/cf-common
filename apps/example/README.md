# cf-common example Worker

A minimal Cloudflare Worker that exercises every `@rtorcato/cf-common` subpath
(`env`, `http`, `request`, `kv`, `r2`, `d1`, `errors`) in one `fetch` handler —
a copy-paste starter and a smoke test that the published exports resolve under
workerd. The handler is wrapped in `defineFetch`, so a thrown `CloudflareError`
(a missing var, a bad body) becomes a clean JSON response with no `try/catch`.

```sh
pnpm --filter @rtorcato/cf-common-example dev
```

Then hit the routes (default `http://localhost:8787`) — `/`, `/env`, `/whoami`,
and `/echo` work with **no Cloudflare account**; `/kv`, `/r2`, and `/d1` need
their binding uncommented in `wrangler.jsonc`. `wrangler dev` runs in local mode:
Miniflare simulates KV, R2, and D1 on disk using the placeholder ids there.

| Route     | Method | Shows                                                        |
| --------- | ------ | ------------------------------------------------------------ |
| `/`       | GET    | the list of routes                                           |
| `/env`    | GET    | `requireEnv` / `getEnv` reading a var                        |
| `/whoami` | GET    | `cf` (request.cf country/TLS) + `clientIp`                   |
| `/echo`   | POST   | `parseJson` (400 on a bad body) + `bearerToken`; CORS via `withCors` |
| `/kv`     | GET    | `createKvStore` round-tripping a counter (TTL)               |
| `/r2`     | GET    | `createR2Store` `putJSON` / `getJSON`                        |
| `/d1`     | GET    | `queryFirst` against local D1                                |

```sh
# /echo validates the body and reads the bearer token:
curl -X POST localhost:8787/echo -H 'Authorization: Bearer tok' -d '{"name":"Ada"}'
# → {"hello":"Ada","token":"tok"}
curl -X POST localhost:8787/echo -d '{"name":123}'   # → 400 {"error":"...","code":"INVALID_BODY"}
```

## Connecting to a real account

You only need Cloudflare credentials to run against real resources or deploy:

```sh
wrangler login                 # browser OAuth (or set CLOUDFLARE_API_TOKEN)
wrangler kv namespace create KV
wrangler r2 bucket create cf-common-example
wrangler d1 create cf-common-example
```

Wire the returned ids into `wrangler.jsonc`, then use `pnpm dev --remote`
(real resources) or `pnpm deploy` (publish the Worker).
