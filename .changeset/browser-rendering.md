---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/browser` module over the Browser Rendering binding: `withBrowser` launches a browser, runs your callback and always closes it, and `screenshot` and `pdf` render a URL or HTML string in one call. `@cloudflare/puppeteer` is an optional peer dependency, needed only if you import this subpath. A failed launch or render throws a non-exposed `502` (`BROWSER_LAUNCH_FAILED` / `BROWSER_RENDER_FAILED`); a non-http(s) URL throws an exposed `400` `BROWSER_INVALID_URL`.
