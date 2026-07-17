# Contributing

## Commits & releases

Commits follow [Conventional Commits](https://conventionalcommits.org/). Merging
to `main` triggers semantic-release, which versions, tags, publishes to npm, and
(via the docs workflow) redeploys the site. Use `feat:` for a new module/API,
`fix:` for a bug fix, `docs:`/`chore:` otherwise.

The docs site's API reference is generated from source JSDoc on every build, and
the README's version badge reflects npm automatically — neither needs a manual
bump per release.

## Shipping a new module

Each Cloudflare service is one subpath module: `src/<mod>/index.ts`, imported as
`@rtorcato/cf-common/<mod>`. When you add one, touch these (the build itself is
automatic — `tsup` already globs `src/*/index.ts`):

1. **Code** — `src/<mod>/index.ts` + `src/<mod>/index.test.ts`. Reuse
   `@rtorcato/js-common` for anything generic; only add the Cloudflare layer.
   Throw `CloudflareError` (with a `code`) from `@/errors`. If the module wraps
   a real binding (KV/R2/D1/Queues/DO), add a `src/<mod>/index.workers.test.ts`
   too — see **Testing** below.
2. **Export** — add the `./<mod>` subpath to `exports` in `package.json`.
3. **API docs** — add `'<mod>'` to `MODULES` in
   `apps/docs/docusaurus.config.ts` and a doc entry to the `API Reference`
   category in `apps/docs/sidebars.ts`. The page generates from your JSDoc.
4. **Listings** — add a row to the modules table in `README.md` and the Status
   table in `apps/docs/docs/index.mdx`.
5. **Roadmap** — close (or tick) the module's issue under its
   [milestone](https://github.com/rtorcato/cf-common/milestones).
6. **Commit** — `feat(<mod>): …`. The release and docs deploy run on merge.

## Testing

Two runners, split by what a test needs:

- **Node runner** (`pnpm test`, `vitest.config.ts`) — the default for pure logic:
  JSON (de)serialization, header parsing, error mapping. Fast; mock `fetch` or
  build a synthetic `Request`. Files: `*.test.ts`.
- **Workers pool** (`pnpm test:workers`, `vitest.workers.config.ts`) — for code
  that touches a real binding. It runs on workerd + Miniflare, so KV/R2/D1
  behave for real (TTL, list pagination, SQL). Files: `*.workers.test.ts`; get
  the binding from `import { env } from 'cloudflare:test'` (declared in
  `src/cloudflare-test.d.ts`, add bindings there). `src/kv/index.workers.test.ts`
  is the reference to copy.

## Local checks

```sh
pnpm verify         # typecheck + biome + node tests — run before pushing
pnpm test:workers   # binding tests on workerd + Miniflare
pnpm build          # tsup → dist/ (ESM, per-module subpaths)
```
