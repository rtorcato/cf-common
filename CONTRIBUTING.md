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
   Throw `CloudflareError` (with a `code`) from `@/errors`.
2. **Export** — add the `./<mod>` subpath to `exports` in `package.json`.
3. **API docs** — add `'<mod>'` to `MODULES` in
   `apps/docs/docusaurus.config.ts` and a doc entry to the `API Reference`
   category in `apps/docs/sidebars.ts`. The page generates from your JSDoc.
4. **Listings** — add a row to the modules table in `README.md` and the Status
   table in `apps/docs/docs/index.mdx`.
5. **Roadmap** — tick the item in `ROADMAP.md`.
6. **Commit** — `feat(<mod>): …`. The release and docs deploy run on merge.

## Local checks

```sh
pnpm verify   # typecheck + biome + tests — run before pushing
pnpm build    # tsup → dist/ (ESM, per-module subpaths)
```
