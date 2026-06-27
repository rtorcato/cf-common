# Roadmap

`cf-common` — typed TypeScript wrappers and helpers for working with Cloudflare
bindings and APIs, in the spirit of `js-common` / `browser-common`.

Each module is a thin, well-typed convenience layer over a Cloudflare service —
not a framework. Tree-shakeable subpath exports, zero required runtime deps.

## v0.1 — Foundations

- [x] Tooling, CI, semantic-release (`@rtorcato/js-tooling`)
- [ ] Typed error model (`CloudflareError`, result helpers) — #1
- [ ] Shared types + env binding helpers (`getBinding`, typed `env`) — #2

## v0.2 — Storage

- [ ] **KV** — typed get/put/list with JSON (de)serialization + TTL helpers — #3
- [ ] **R2** — object get/put/list, presigned URLs, multipart helpers — #4
- [ ] **D1** — typed query helper, batch, migration runner — #5

## v0.3 — Messaging & Compute

- [ ] **Queues** — typed producer/consumer, batch ack helpers — #6
- [ ] **Durable Objects** — base class + typed storage accessor — #7
- [ ] **Cache API** — `cache.match`/`put` wrappers with key + TTL helpers — #8

## v0.4 — AI & Data

- [ ] **Workers AI** — typed `run()` per model family — #9
- [ ] **Vectorize** — upsert/query helpers with typed metadata — #10
- [ ] **Hyperdrive** — connection helper — #11

## v0.5 — REST API client

- [ ] Account-level client (zones, DNS, cache purge) over `fetch`, typed responses — #12

## v1.0 — Stable

- [ ] Docs site + per-module examples — #13
- [ ] API frozen, `1.0.0` published to npm with provenance

> Issues track each unchecked item. See the
> [issues list](https://github.com/rtorcato/cf-common/issues).
