# Roadmap

`cf-common` — typed TypeScript wrappers and helpers for working with Cloudflare
bindings and APIs, in the spirit of `js-common` / `browser-common`.

Each module is a thin, well-typed convenience layer over a Cloudflare service —
not a framework. Tree-shakeable subpath exports, zero required runtime deps.

## Principles

- **Thin over a service, never a framework.** One module per Cloudflare binding.
- **Reuse `@rtorcato/js-common`.** cf-common depends on js-common for generic
  helpers (errors base, env parsing, logger, json, retry, validation) and only
  adds the Cloudflare-specific layer — it never reimplements what js-common
  already ships.
- **Workers-native.** ESM-only build, `@cloudflare/workers-types`, tested
  against workerd (`vitest-pool-workers`). The runtime is workerd, not Node.
- **Subpath imports are the contract.** Always `@rtorcato/cf-common/<module>`,
  so tree-shaking is automatic.

## Beta target

**Beta = an early adopter can build a complete Worker end-to-end with
cf-common.** That means foundations + storage (shipped) plus the HTTP/request
layer every Worker repeats, and a test harness that runs against real workerd.

Gated by (see the [Beta milestone](https://github.com/rtorcato/cf-common/milestone/1)):

- [ ] **HTTP** — `Response`/JSON/CORS helpers + `defineFetch` wrapper — #33
- [ ] **Request** — typed `request.cf`, body + auth parsing — #34
- [ ] **workerd test harness** — `vitest-pool-workers` for binding tests — #22

Foundations (`errors`, `env`) and storage (`kv`, `r2`, `d1`) are already
published. "Beta" is a maturity label, not a semver: the package is past
`1.0.0`, so betas ship under the npm `beta` dist-tag rather than a `0.x`
version.

## v0.1 — Foundations & build

- [x] Tooling, CI, semantic-release (`@rtorcato/js-tooling`)
- [x] ESM-only subpath-export build (multi-entry `tsup`) — #20
- [x] `@cloudflare/workers-types` + depend on `@rtorcato/js-common` — #21
- [ ] `vitest-pool-workers` test harness (workerd) — #22
- [x] Typed error model (`CloudflareError`, result helpers; extends `js-common/errors`) — #1
- [x] Shared types + env binding helpers (`getBinding`, typed `env`) — #2

## v0.2 — Web essentials

The boilerplate every Worker repeats.

- [ ] **HTTP** — `json`/`error` responses, CORS + preflight, `defineFetch` handler wrapper — #33
- [ ] **Request** — typed `request.cf`, body parsing (zod via js-common), bearer/IP extractors — #34

## v0.3 — Storage

- [x] **KV** — typed get/put/list with JSON (de)serialization + TTL helpers — #3
- [x] **R2** — object get/put/list, multipart helpers (presigned URLs deferred — need S3 API + SigV4) — #4
- [x] **D1** — typed query helper, batch, migration runner — #5

## v0.4 — Messaging & Compute

- [ ] **Queues** — typed producer/consumer, batch ack helpers — #6
- [ ] **Durable Objects** — base class + typed storage accessor — #7
- [ ] **Cache API** — `cache.match`/`put` wrappers with key + TTL helpers — #8
- [ ] **Service Bindings / RPC** — typed `WorkerEntrypoint` + worker-to-worker calls — #26
- [ ] **Cron / Scheduled** — typed `scheduled()` handler + cron routing — #28
- [ ] **Workflows** — durable multi-step execution helpers — #27

## v0.5 — Security & auth

- [ ] **Access** — verify `Cf-Access-Jwt-Assertion` (Zero Trust) — #23
- [ ] **Turnstile** — server-side `siteverify` helper — #24
- [ ] **Rate Limiting** — typed wrapper over the Rate Limiting binding — #25

## v0.6 — AI & Data

- [ ] **Workers AI** — typed `run()` per model family — #9
- [ ] **Vectorize** — upsert/query helpers with typed metadata — #10
- [ ] **Hyperdrive** — connection helper — #11
- [ ] **AI Gateway** — typed client routing through a gateway endpoint — #31

## v0.7 — Integrations

- [ ] **Email Workers** — typed sender over the `send_email` binding — #29
- [ ] **Analytics Engine** — typed `writeDataPoint` — #30
- [ ] **Images** — upload + typed transform/variant URLs — #32

## v0.8 — REST API client

- [ ] Account-level client (zones, DNS, cache purge) over `fetch`, typed responses — #12

## v1.0 — Stable

- [ ] Docs site + per-module examples — #13, #19 (site scaffolded, branded)
- [ ] API frozen, `1.0.0` published to npm with provenance

> Issues track each unchecked item. See the
> [issues list](https://github.com/rtorcato/cf-common/issues).
