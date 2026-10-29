---
title: images
description: Cloudflare Images uploads, typed variant and transform URLs, and signed delivery URLs.
---

`@rtorcato/cf-common/images` covers the three things a Worker does with
[Cloudflare Images](https://developers.cloudflare.com/images/): upload, build
delivery URLs, and sign them.

```ts
import {
  createImagesApi,
  imageUrl,
  signImageUrl,
  transformUrl,
} from '@rtorcato/cf-common/images'
import { requireEnv } from '@rtorcato/cf-common/env'
```

## Upload

`createImagesApi` takes your account id and an API token with Images Write.

```ts
const images = createImagesApi({
  accountId: requireEnv(env, 'CF_ACCOUNT_ID'),
  token: requireEnv(env, 'IMAGES_TOKEN'),
})

// From a File or Blob, e.g. a form upload the Worker received:
const form = await request.formData()
const image = await images.upload(form.get('file') as File, { metadata: { user: 'u_1' } })

// Or let Cloudflare fetch it:
await images.upload('https://example.com/cat.jpg', { id: 'cats/1' })
```

`upload` returns the image's `id`, `filename`, `uploaded`, `requireSignedURLs`
and one URL per named variant in `variants`.

### Direct creator upload

To let a browser upload without the file passing through your Worker, reserve a
one-time URL and hand it to the client:

```ts
const { id, uploadURL } = await images.directUpload({
  metadata: { user: 'u_1' },
  expiry: new Date(Date.now() + 15 * 60_000), // 2 minutes to 6 hours ahead
})
return Response.json({ id, uploadURL })
```

The browser POSTs the file to `uploadURL` as the `file` field of a multipart
form. The URL works once, and the token never leaves the Worker.

## Delivery URLs

`imageUrl` builds an `imagedelivery.net` URL from the account hash (on the
Images dashboard, not the account id), the image id and a variant:

```ts
imageUrl({ accountHash, imageId: 'cats/1', variant: 'public' })
// https://imagedelivery.net/<accountHash>/cats/1/public

// Flexible variant (enable flexible variants for the account first):
imageUrl({ accountHash, imageId: 'cats/1', variant: { width: 400, fit: 'cover', format: 'auto' } })
// https://imagedelivery.net/<accountHash>/cats/1/width=400,fit=cover,format=auto

// From your own zone:
imageUrl({ accountHash, imageId: 'cats/1', variant: 'thumb', origin: 'https://example.com' })
// https://example.com/cdn-cgi/imagedelivery/<accountHash>/cats/1/thumb
```

`transformUrl` resizes any image, stored in Images or not, on a zone with
Image Transformations on:

```ts
transformUrl('/uploads/cat.jpg', { width: 800, quality: 80, format: 'auto' })
// /cdn-cgi/image/width=800,quality=80,format=auto/uploads/cat.jpg
```

The options are the `cf.image` names a URL can carry (`width`, `height`, `fit`,
`quality`, `format`, `dpr`, `gravity`, `sharpen`, `blur`, `rotate`, `background`,
…), plus `format: 'auto'` and `gravity: { x, y }`. `imageOptions(options)` gives
you the `key=value,…` string alone.

## Signed URLs

An image uploaded with `requireSignedURLs: true` is only served with a valid
signature. Sign the delivery URL with the account's Images signing key (Images >
Keys on the dashboard):

```ts
const url = await signImageUrl(
  imageUrl({ accountHash, imageId: 'private/1', variant: 'public' }),
  requireEnv(env, 'IMAGES_SIGNING_KEY'),
  { expiresIn: 600 } // seconds, default 3600
)
```

It adds `exp` and `sig`, an HMAC-SHA256 of the path and query. Signed delivery
only works with named variants: flexible variants are refused for images that
require signed URLs.

## Errors

| Code | Status | When |
| --- | --- | --- |
| `IMAGES_API_ERROR` | 502 (not exposed) | An upload call failed: non-2xx, `success: false`, a non-JSON body or a network error. The upstream status and `errors` are on `cause` |
| `IMAGES_INVALID_ID` | 400 (exposed) | An empty id, or an id, account hash, variant or account id with an empty, `.` or `..` segment |

The token never appears in the error message.

## Good to know

- Custom image ids may contain `/`, so `imageUrl` keeps slashes and encodes
  each segment.
- Keep the API token and signing key in `wrangler secret put`, never in
  `vars`.
- For transforms inside a Worker without a URL, use the Images binding
  (`env.IMAGES.input(stream).transform({ … })`) directly.

See the [`images` API reference](/docs/api/images) for every export.
