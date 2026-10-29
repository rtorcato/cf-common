---
title: browser
description: Browser Rendering with the browser always closed, plus one-call screenshots and PDFs.
---

`@rtorcato/cf-common/browser` wraps
[Browser Rendering](https://developers.cloudflare.com/browser-rendering/) through
`@cloudflare/puppeteer`. It closes every browser it launches and turns the two
common jobs, a screenshot and a PDF, into one call.

`@cloudflare/puppeteer` is an optional peer dependency: install it yourself, and
only if you use this subpath. Puppeteer needs the `nodejs_compat` flag.

```sh
pnpm add @cloudflare/puppeteer
```

```jsonc
// wrangler.jsonc
"compatibility_flags": ["nodejs_compat"],
"browser": { "binding": "BROWSER" }
```

## Screenshots and PDFs

```ts
import { pdf, screenshot } from '@rtorcato/cf-common/browser'

const png = await screenshot(env.BROWSER, { url: 'https://example.com' }, {
  viewport: { width: 1200, height: 630 },
  waitUntil: 'networkidle0',
})
return new Response(png, { headers: { 'Content-Type': 'image/png' } })
```

```ts
const file = await pdf(env.BROWSER, { html: invoiceHtml }, {
  pdf: { format: 'A4', printBackground: true },
})
return new Response(file, { headers: { 'Content-Type': 'application/pdf' } })
```

The target is `{ url }` to load a page or `{ html }` to render a string. Options:

| Option | Does |
| --- | --- |
| `viewport` | Page size before loading (Puppeteer's default is 800×600) |
| `waitUntil`, `timeout` | When navigation counts as done (`'load'`, `'networkidle0'`, …) and its timeout in ms |
| `screenshot` / `pdf` | Puppeteer's own screenshot or PDF options (`type`, `fullPage`, `format`, `margin`, …) |
| `launch` | Passed to `puppeteer.launch`, e.g. `{ keep_alive: 60_000 }` |

Both return a `Uint8Array` and close the browser when done, also on failure.

## Your own script

`withBrowser` gives you the browser for anything else and always closes it:

```ts
import { withBrowser } from '@rtorcato/cf-common/browser'

const title = await withBrowser(env.BROWSER, async (browser) => {
  const page = await browser.newPage()
  await page.goto('https://example.com')
  return page.title()
})
```

## Errors

| Code | Status | When |
| --- | --- | --- |
| `BROWSER_INVALID_URL` | 400 (exposed) | `url` isn't an `http:` or `https:` URL. Checked before launching |
| `BROWSER_LAUNCH_FAILED` | 502 (not exposed) | The launch failed: concurrency or rate limit reached, or a bad binding. The original is on `cause` |
| `BROWSER_RENDER_FAILED` | 502 (not exposed) | `screenshot`/`pdf` failed to load the page or capture it, e.g. a navigation timeout |

Errors thrown inside a `withBrowser` callback pass through unchanged.

## Good to know

- A screenshot or PDF of a URL from a request fetches that page from
  Cloudflare's network. The scheme check stops `file:` and `javascript:` URLs,
  but limit the hosts yourself if users choose them.
- Each launch is a new browser session and counts against your Browser
  Rendering limits. For many renders in a row, use `withBrowser` and open
  several pages in one browser.
- The subpath imports `@cloudflare/puppeteer`, so it only loads where that
  package is installed.

See the [`browser` API reference](/docs/api/browser) for every export.
