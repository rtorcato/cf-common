---
"@rtorcato/cf-common": minor
---

Support `@cloudflare/puppeteer` 2.x: the optional peer is now `^1.4.0 || ^2.0.0`. Moving to 2.x drops `@puppeteer/browsers` and with it the `basic-ftp` and `extract-zip` advisories. The `browser` module's API is unchanged.
