# cf-common example Worker

A minimal Cloudflare Worker that exercises every `@rtorcato/cf-common` subpath
(`env`, `http`, `request`, `kv`, `r2`, `r2-presign`, `cache`, `d1`, `queues`, `ai`,
`ratelimit`, `turnstile`, `cron`, `errors`) in one Worker —
a copy-paste starter and a smoke test that the published exports resolve under
workerd. The handler is wrapped in `defineFetch`, so a thrown `CloudflareError`
(a missing var, a bad body) becomes a clean JSON response with no `try/catch`.

```sh
pnpm --filter @rtorcato/cf-common-example dev
```

Then hit the routes (default `http://localhost:8787`) — `/`, `/env`, `/whoami`,
`/echo`, `/cache`, `/ratelimit` and `/turnstile` work with **no Cloudflare account**;
`/kv`, `/r2`, `/d1`, and `/queue` need their binding in `wrangler.jsonc`; `/ai` needs the
commented-out `ai` binding and `--remote`; `/presign` needs `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (in `.dev.vars` locally). `wrangler dev` runs in local mode:
Miniflare simulates KV, R2, and D1 on disk using the placeholder ids there.

| Route     | Method | Shows                                                        |
| --------- | ------ | ------------------------------------------------------------ |
| `/`       | GET    | the list of routes                                           |
| `/env`    | GET    | `requireEnv` / `getEnv` reading a var                        |
| `/whoami` | GET    | `cf` (request.cf country/TLS) + `clientIp`                   |
| `/echo`   | POST   | `parseJson` (400 on a bad body) + `bearerToken`; CORS via `withCors` |
| `/kv`     | GET    | `createKvStore` round-tripping a counter (TTL)               |
| `/r2`     | GET    | `createR2Store` `putJSON` / `getJSON`                        |
| `/presign` | GET   | `presignR2Url` signing 5-minute `GET` and `PUT` URLs (needs the `R2_*` secrets) |
| `/d1`     | GET    | `queryFirst` against local D1                                |
| `/queue`  | GET    | `createProducer` enqueues; `defineQueue` consumes it in the same Worker |
| `/ai`     | GET    | `runAi` against a Workers AI model (needs `--remote`)        |
| `/cache`  | GET    | `createCache` + `buildCacheKey` read-through, 60s TTL (`X-Cache: MISS`, then `HIT`) |
| `/ratelimit` | GET | `rateLimit(...).limitByIp`, 5 requests per 10s, then `429`   |
| `/turnstile` | POST | `assertTurnstile` on a form token, using Cloudflare's always-pass test secret |

```sh
# /echo validates the body and reads the bearer token:
curl -X POST localhost:8787/echo -H 'Authorization: Bearer tok' -d '{"name":"Ada"}'
# → {"hello":"Ada","token":"tok"}
curl -X POST localhost:8787/echo -d '{"name":123}'   # → 400 {"error":"...","code":"INVALID_BODY"}

# /turnstile verifies the widget token against siteverify:
curl -X POST localhost:8787/turnstile -F 'cf-turnstile-response=XXXX.DUMMY.TOKEN.XXXX'
# → {"ok":true,"hostname":"example.com"}
```

The `scheduled` handler (`defineScheduled`) runs on the `*/5 * * * *` trigger. Fire
it locally with `pnpm dev --test-scheduled`:

```sh
curl 'localhost:8787/__scheduled?cron=*/5+*+*+*+*'   # logs "cron */5 * * * * <time>"
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
