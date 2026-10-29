---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/images` module for Cloudflare Images: `createImagesApi` uploads a file or URL and reserves direct creator upload URLs, `imageUrl` and `transformUrl` build named-variant, flexible-variant and `/cdn-cgi/image/` URLs from typed options, and `signImageUrl` signs a delivery URL with `exp` and an HMAC `sig`. API failures throw a non-exposed `502` with code `IMAGES_API_ERROR`; a bad id throws an exposed `400` `IMAGES_INVALID_ID`.
