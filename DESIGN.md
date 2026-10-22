# Design

cf-common's docs site is a Docusaurus v3 app in `apps/docs`. It's one of the
torcato.dev repos, themed by shared-docs. Shared tokens live in
`apps/docs/src/css/_jt-tokens.css` and the cf-common tokens (`--jc-*`, Cloudflare
orange) in `apps/docs/src/css/custom.css`. This file covers what is specific to
cf-common.

rtorcato signed off on everything below on 2026-10-15. The mockup is private and
lives outside this repo.

## Navbar (#78, #79)

Left items, in this order, to match api-common:

**Docs · API · Examples · Projects ▾**

- `API` → `/docs/api`. `Examples` → `/docs/examples`.
- The `Guides` item (it links to `/docs/guides/getting-started`) is removed.
  Getting started stays first in the sidebar and in the footer.
- GitHub and npm stay on the right.
- Four left items plus the Projects dropdown is the most the navbar holds before
  it crowds at about 1000px. Don't add a fifth.

## API landing (#78)

The API Reference sidebar category gets a Docusaurus generated index, so nothing
here is custom:

```ts
link: {
  type: 'generated-index',
  title: 'API Reference',
  slug: '/api',
  description: 'TypeDoc reference for every cf-common module. Pick a module below.',
}
```

## Releases (#77)

- Sidebar: a last category, `Releases`, holding `changelog`. It's collapsed, as on
  api-common.
- Footer: `Changelog` → `/docs/changelog` in the Resources column, right after GitHub.

## Badges (#60, which absorbed #62)

One set in two places, so they never drift:

- `README.md`: one row under the brand banner, before the intro paragraph.
  **CI · npm version · npm downloads · bundle size · docs · license**
- `apps/docs/docs/index.mdx`: the same row **minus docs** (the reader is already
  on the docs). **CI · npm version · npm downloads · bundle size · license**

Codecov stays out until CI uploads coverage.

## Homepage module cards (#85)

The data drives the card: `Mod` gets a `guide?: boolean` flag. Don't infer it
from the sidebar.

**Shipped module with a guide** (today: errors, env, kv, r2, d1)

- The whole card is a `<Link>` to `/docs/guides/<subpath>`.
- A footer row: the subpath chip on the left, **Guide →** on the right
  (14px/600).
- Keep the existing hover lift. Add a `:focus-visible` outline, 2px solid
  `--jc-gold`, 2px offset.

**Planned module**

- A `<div>`, not a link. No hover lift, no pointer cursor.
- `1px dashed var(--jc-border2)` border, transparent background.
- A **Planned** pill (12px/600, `--jc-muted`, 1px `--jc-border2` border, full
  radius) where "Guide →" would sit.
- Never dim it with opacity, because the text has to stay AA.

**Section copy:** "Shipped modules open their guide. The rest are on the
[roadmap]." The category label (`Foundations`, `Storage`…) stays top-right.

## Tokens

Map onto the existing variables. Don't add new ones.

| Use | Light | Dark |
|---|---|---|
| "Guide →" text | `--jc-gold` `#a04e08` (5.9:1 on white) | `--jc-gold` `#faad3f` (9.4:1 on `#111824`) |
| Focus ring | `--jc-gold` | `--jc-gold` |
| Planned pill text | `--jc-muted` `#5b6675` (5.8:1) | `--jc-muted` `#94a1b4` (6.8:1) |
| Planned card border | `--jc-border2` | `--jc-border2` |

Light `--jc-gold` and `--ifm-link-color` are `#a04e08`: 5.9:1 on white, 5.4:1 on
`--jc-surface2` and 4.7:1 on `--jc-gold-soft` over `--jc-surface2`, so they carry
small text. The old `#d96b0f` was 3.5:1 on white and about 2.8:1 on the tint.

## Accessibility

- Text meets WCAG AA in both themes. Touch targets are 44px or more.
- Each card link has one accessible name: the module name. "Guide →" is part of
  the link, not a second link.
- Planned cards are plain content, so they aren't in the tab order.

### Faint text

`--jc-faint` colours small text (table headers, footer, code file name, `.wmDash`,
the mobile-menu `↗`). Light `#657080` is 5.0:1 on white and 4.6:1 on
`--jc-surface2`. Dark `#78859a` is 4.8:1 on `--jc-surface` `#111824`. It stays one
step below `--jc-muted`.

## Brand

The banner, mobile banner, social card and favicon in `brand/` come from
`npx @rtorcato/brand-kit`. `brand/render.sh` regenerates them. Don't hand-edit
the PNGs.
