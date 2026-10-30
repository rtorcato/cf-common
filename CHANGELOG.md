# @rtorcato/cf-common

## 1.9.0

### Minor Changes

- 0fb24e1: Add the `@rtorcato/cf-common/access` module with `verifyAccessJwt`, which checks the Cloudflare Access JWT against the team JWKS (signature, issuer, audience, expiry) and returns the typed identity, and `accessJwt`, which reads the `Cf-Access-Jwt-Assertion` header. A bad token throws a `401` with code `ACCESS_JWT_INVALID`.
- 99bb1db: Add the `@rtorcato/cf-common/ai-gateway` module: `createAiGateway` sends provider calls through an AI Gateway endpoint (`fetch` returns the response, `json` posts and parses JSON), `gatewayUrl` builds the endpoint URL, and `gatewayHeaders` turns typed cache, metadata, logging and retry options into `cf-aig-*` headers. Failures throw a non-exposed `502` with code `AI_GATEWAY_FAILED`; a bad id, provider or path segment throws a non-exposed `500` `AI_GATEWAY_INVALID`.
- 6467fca: Add the `analytics` subpath: `writeDataPoint(dataset, point)` writes to an Analytics Engine dataset and maps a rejected point to a non-exposed 500 `CloudflareError` with code `ANALYTICS_WRITE_FAILED`, and `createDataset(dataset, schema)` names the blob, double and index columns so you write by name and get the SQL API column for each.
- 0f9c81e: Add the `@rtorcato/cf-common/browser` module over the Browser Rendering binding: `withBrowser` launches a browser, runs your callback and always closes it, and `screenshot` and `pdf` render a URL or HTML string in one call. `@cloudflare/puppeteer` is an optional peer dependency, needed only if you import this subpath. A failed launch or render throws a non-exposed `502` (`BROWSER_LAUNCH_FAILED` / `BROWSER_RENDER_FAILED`); a non-http(s) URL throws an exposed `400` `BROWSER_INVALID_URL`.
- 85ea871: Add `@rtorcato/cf-common/do`: `BaseDurableObject` extends the runtime's `DurableObject` and adds a typed `this.storage`, and `typedStorage` wraps any `DurableObjectStorage` so `get` (with an optional fallback), `put` and `delete` are checked against a key → value schema.
- b0264ba: Add the `email` subpath: `sendEmail(binding, message)` sends over a `send_email` binding, from fields or a raw-MIME `EmailMessage`, and maps a failed send to a non-exposed 502 `CloudflareError` with code `EMAIL_SEND_FAILED`.
- 79ab9f4: Add the `@rtorcato/cf-common/hyperdrive` module with `withHyperdrive`, which opens a per-request client over a Hyperdrive binding and always closes it. The driver is yours to pass in through `connect` and `close`, so no driver is bundled. A failed connect throws a non-exposed `502` with code `HYPERDRIVE_CONNECT_FAILED`.
- e28b067: Add the `@rtorcato/cf-common/images` module for Cloudflare Images: `createImagesApi` uploads a file or URL and reserves direct creator upload URLs, `imageUrl` and `transformUrl` build named-variant, flexible-variant and `/cdn-cgi/image/` URLs from typed options, and `signImageUrl` signs a delivery URL with `exp` and an HMAC `sig`. API failures throw a non-exposed `502` with code `IMAGES_API_ERROR`; a bad id throws an exposed `400` `IMAGES_INVALID_ID`.
- 18af2fe: Add the `pipelines` subpath: `createPipelineProducer<T>(pipeline)` wraps a Pipeline binding so `send(record)` and `sendBatch(records, { chunkSize? })` take typed records (batches go out in order in chunks of 100 by default), and a rejected send becomes a non-exposed 502 `CloudflareError` with code `PIPELINE_SEND_FAILED`.
- c57e688: Add the `@rtorcato/cf-common/api` module with `createCloudflareApi`, a small client for Cloudflare's v4 REST API. It covers zones, DNS records and cache purge, and its raw `request`/`requestPage` reach any other endpoint. It adds no dependencies, and any failure throws a non-exposed `502` with code `CF_API_ERROR`.
- a8f4181: Add the `@rtorcato/cf-common/rpc` module with `getService`, a typed accessor for Service Bindings to a `WorkerEntrypoint`, and `callService`, which maps a failed RPC call to a non-exposed `502` with code `RPC_CALL_FAILED`.
- 4de9fe5: Add the `@rtorcato/cf-common/secrets` module with `getSecret`, typed access to a Secrets Store binding by name: a missing binding is a non-exposed `500`, and a failed read becomes a non-exposed `500` with code `SECRET_GET_FAILED`.
- bed7bc4: Add the `@rtorcato/cf-common/assets` module over the Static Assets binding: `serveAssets` serves a request with an optional SPA fallback (for page navigations) and 404 page, and `fetchAsset` fetches the asset at another path with the request's headers.
- e5ff16a: Add the `@rtorcato/cf-common/vectorize` module with `createVectorStore<M>`, a typed store over one Vectorize index. It adds caller-typed metadata, `upsert` split into chunks of 1000 with one `mutationId` per chunk, and failures mapped to a non-exposed `502` with code `VECTORIZE_FAILED`.
- 6b9a389: Add the `@rtorcato/cf-common/workflows` module with `createWorkflow`, a typed client over a Workflow binding: `create` takes typed params, `status` returns a typed `output`, and any failure becomes a non-exposed `502` with code `WORKFLOW_FAILED`.
- 071a62b: Add the `@rtorcato/cf-common/ws` module for Hibernatable WebSockets on a Durable Object: `acceptWebSocket` upgrades with `ctx.acceptWebSocket` (an exposed `426` `WS_UPGRADE_REQUIRED` without an `Upgrade: websocket` header), `getAttachment`/`setAttachment` type the per-socket state, `parseMessage` validates a JSON message (an exposed `400` `WS_INVALID_MESSAGE` on failure), and `sendMessage`/`broadcast` send JSON to one socket or to every socket, optionally by tag.

## 1.8.0

### Minor Changes

- 597d6b9: Add `@rtorcato/cf-common/r2-presign`: `presignR2Url` signs presigned `GET`/`PUT` URLs for an R2 object over the S3-compatible API with an R2 API token (AWS SigV4 via Web Crypto, no dependency).
- dc5f548: Add `@rtorcato/cf-common/queues`: `createProducer` wraps a `Queue` binding (typed `send`, `sendBatch` split into chunks of 100, failures as `QUEUE_SEND_FAILED`), and `defineQueue` builds a `queue` handler that acks or retries each message individually, with an optional `retryDelay` backoff.
- 5feadcd: Add the `@rtorcato/cf-common/ai` module with `runAi`, a typed wrapper over the Workers AI binding's `run()`. The input and output types follow the model name, and a failed call throws a non-exposed `502` with code `AI_RUN_FAILED`.

### Patch Changes

- 51791ef: Add the `cache`, `ratelimit` and `ai` modules to the bundled `AGENTS.md` (the subpath list and module map left them out).

## 1.7.0

Released by semantic-release. Earlier entries below are in the semantic-release format; GitHub Releases hold the full history.

## [1.5.1](https://github.com/rtorcato/cf-common/compare/v1.5.0...v1.5.1) (2026-07-23)


### Bug Fixes

* **release:** upgrade npm for OIDC trusted publishing ([#108](https://github.com/rtorcato/cf-common/issues/108)) ([9e3080f](https://github.com/rtorcato/cf-common/commit/9e3080f062a86178d10865c02ea85a3ddc1308a7))

# [1.5.0](https://github.com/rtorcato/cf-common/compare/v1.4.0...v1.5.0) (2026-07-17)


### Bug Fixes

* **errors:** detect CloudflareError across bundle boundaries ([#101](https://github.com/rtorcato/cf-common/issues/101)) ([315a6ce](https://github.com/rtorcato/cf-common/commit/315a6cea9584b9210082596bdcb4902d292961ea)), closes [#67](https://github.com/rtorcato/cf-common/issues/67)


### Features

* **request:** typed request.cf + JSON body/auth parsing ([#99](https://github.com/rtorcato/cf-common/issues/99)) ([eab049b](https://github.com/rtorcato/cf-common/commit/eab049b8a7d4c88ec4860f92efff22a836bf1c92)), closes [#34](https://github.com/rtorcato/cf-common/issues/34)

# [1.4.0](https://github.com/rtorcato/cf-common/compare/v1.3.0...v1.4.0) (2026-07-08)


### Features

* http, turnstile, and cron modules ([#86](https://github.com/rtorcato/cf-common/issues/86)) ([4115c5a](https://github.com/rtorcato/cf-common/commit/4115c5a1e248822909a58e33381a2b68a35e9ed0)), closes [#33](https://github.com/rtorcato/cf-common/issues/33) [#24](https://github.com/rtorcato/cf-common/issues/24) [#28](https://github.com/rtorcato/cf-common/issues/28) [#33](https://github.com/rtorcato/cf-common/issues/33) [#24](https://github.com/rtorcato/cf-common/issues/24) [#28](https://github.com/rtorcato/cf-common/issues/28)

# [1.3.0](https://github.com/rtorcato/cf-common/compare/v1.2.0...v1.3.0) (2026-07-07)


### Features

* **example:** add runnable sample Worker + docs ([#74](https://github.com/rtorcato/cf-common/issues/74)) ([beac102](https://github.com/rtorcato/cf-common/commit/beac102a9d19d12eda431ffe948344030d5e33a1))

# [1.2.0](https://github.com/rtorcato/cf-common/compare/v1.1.1...v1.2.0) (2026-07-06)


### Features

* **docs:** auto-generated API reference + release-triggered deploy ([#44](https://github.com/rtorcato/cf-common/issues/44)) ([742fcf0](https://github.com/rtorcato/cf-common/commit/742fcf0e48d6d57126387f5d52a9da4be892ced9))

## [1.1.1](https://github.com/rtorcato/cf-common/compare/v1.1.0...v1.1.1) (2026-06-29)


### Bug Fixes

* **docs:** add wordmark title + tagline to homepage hero ([#41](https://github.com/rtorcato/cf-common/issues/41)) ([2afbdad](https://github.com/rtorcato/cf-common/commit/2afbdad68906a5e058834c540a17f2a2fcc0d75f))

# [1.1.0](https://github.com/rtorcato/cf-common/compare/v1.0.0...v1.1.0) (2026-06-29)


### Features

* **storage:** typed KV, R2 and D1 wrappers ([#40](https://github.com/rtorcato/cf-common/issues/40)) ([290980f](https://github.com/rtorcato/cf-common/commit/290980fcd74079b3b58b54f2945d173f6bd2bac2)), closes [#36](https://github.com/rtorcato/cf-common/issues/36) [#20](https://github.com/rtorcato/cf-common/issues/20) [#21](https://github.com/rtorcato/cf-common/issues/21) [#1](https://github.com/rtorcato/cf-common/issues/1) [#2](https://github.com/rtorcato/cf-common/issues/2) [#3](https://github.com/rtorcato/cf-common/issues/3) [#4](https://github.com/rtorcato/cf-common/issues/4) [#5](https://github.com/rtorcato/cf-common/issues/5) [#22](https://github.com/rtorcato/cf-common/issues/22) [#3](https://github.com/rtorcato/cf-common/issues/3) [#4](https://github.com/rtorcato/cf-common/issues/4)

# 1.0.0 (2026-06-29)


### Features

* ESM subpath build + errors & env foundation modules ([#36](https://github.com/rtorcato/cf-common/issues/36)) ([7e10ea1](https://github.com/rtorcato/cf-common/commit/7e10ea15d46cd2195f0506880ffc977a5991c9b2)), closes [#20](https://github.com/rtorcato/cf-common/issues/20) [#21](https://github.com/rtorcato/cf-common/issues/21) [#1](https://github.com/rtorcato/cf-common/issues/1) [#2](https://github.com/rtorcato/cf-common/issues/2) [#22](https://github.com/rtorcato/cf-common/issues/22) [#3](https://github.com/rtorcato/cf-common/issues/3) [#20](https://github.com/rtorcato/cf-common/issues/20) [#21](https://github.com/rtorcato/cf-common/issues/21) [#1](https://github.com/rtorcato/cf-common/issues/1)
