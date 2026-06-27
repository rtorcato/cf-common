# @rtorcato/cf-common-docs

Documentation site for [`@rtorcato/cf-common`](../../), built with
[Docusaurus](https://docusaurus.io/) and deployed to GitHub Pages at
<https://rtorcato.github.io/cf-common/>.

## Develop

```bash
pnpm --filter @rtorcato/cf-common-docs dev      # local dev server
pnpm --filter @rtorcato/cf-common-docs build    # production build → ./build
pnpm --filter @rtorcato/cf-common-docs test:e2e # Playwright smoke tests
```

## Structure

- `docs/` — markdown content (overview, getting started; per-module pages land
  as the library modules ship).
- `src/pages/index.tsx` — marketing landing page (owns `/`).
- `src/css/custom.css` — Cloudflare-orange theme.
- `src/theme/` — swizzled mobile drawer (flat menu, see `PrimaryMenu`).
- `sidebars.ts` — wire new module docs in here.

## Deploy

Pushed automatically by `.github/workflows/docs.yml` on every push to `main`
that touches `apps/doc/**`.
