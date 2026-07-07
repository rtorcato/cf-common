# cf-common example Worker

A minimal Cloudflare Worker that exercises every `@rtorcato/cf-common` subpath
(`env`, `kv`, `r2`, `d1`, `errors`) in one `fetch` handler — a copy-paste
starter and a smoke test that the published exports resolve under workerd.

```sh
pnpm --filter @rtorcato/cf-common-example dev
```

Then hit the routes (default `http://localhost:8787`) — **all of them work
locally with no Cloudflare account.** `wrangler dev` runs in local mode:
Miniflare simulates KV, R2, and D1 on disk using the placeholder ids in
`wrangler.jsonc`.

| Route  | Shows                                            |
| ------ | ------------------------------------------------ |
| `/`    | the list of routes                               |
| `/env` | `requireEnv` / `getEnv` reading a var            |
| `/kv`  | `createKvStore` round-tripping a counter (TTL)   |
| `/r2`  | `createR2Store` `putJSON` / `getJSON`            |
| `/d1`  | `queryFirst` against local D1                    |

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
