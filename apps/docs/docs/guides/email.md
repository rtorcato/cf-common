---
title: email
description: Send email over a send_email binding, from fields or raw MIME, with failures mapped to a CloudflareError.
---

`@rtorcato/cf-common/email` wraps the `send_email` binding's `send()`. It adds
one thing on top: a failed send becomes a `CloudflareError` instead of a raw
upstream error.

```ts
import { sendEmail } from '@rtorcato/cf-common/email'
import { getBinding } from '@rtorcato/cf-common/env'

const mailer = getBinding<SendEmail>(env, 'EMAIL')
```

## Bind it

Add a `send_email` binding to your wrangler config. The optional address lists
limit who the Worker may send from and to:

```jsonc
{
  "send_email": [
    {
      "name": "EMAIL",
      "allowed_sender_addresses": ["noreply@example.com"],
      "allowed_destination_addresses": ["ops@example.com"]
    }
  ]
}
```

What the account can deliver to (verified destination addresses only, or any
recipient) depends on your Cloudflare email setup. See
[Send emails from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/).

## Send from fields

Pass the message as fields and the runtime builds the MIME:

```ts
const { messageId } = await sendEmail(mailer, {
  from: { name: 'App', email: 'noreply@example.com' },
  to: 'ops@example.com',
  subject: 'Nightly report',
  text: 'All jobs passed.',
  html: '<p>All jobs passed.</p>',
})
```

`to`, `cc` and `bcc` each take an address, a `{ name, email }` pair or an array
of either, and at least one of them is required. `replyTo`, `headers` and
`attachments` are there too. The field types come from
`@cloudflare/workers-types` (`EmailMessageBuilder`), so a missing `subject` or
recipient fails at compile time.

## Send raw MIME

If you already have a MIME message, wrap it in an `EmailMessage` from
`cloudflare:email` and pass that instead:

```ts
import { EmailMessage } from 'cloudflare:email'

const raw = new EmailMessage('noreply@example.com', 'ops@example.com', mime)
await sendEmail(mailer, raw)
```

To build the MIME yourself, a library such as
[`mimetext`](https://www.npmjs.com/package/mimetext) works in Workers. Most
Workers don't need it, since the fields form above covers text, HTML and
attachments.

## When the send fails

An unverified sender or destination, an address the binding's allow lists
reject, and quota or upstream errors all throw a `CloudflareError` with status
`502`, code `EMAIL_SEND_FAILED` and the original error as `cause`. The message
is not exposed to clients, so under `defineFetch` the response is a generic
`Internal error`. Log `cause` if you need the detail. See
[errors](./errors.md) for how to catch it.

## Good to know

- `sendEmail` returns the binding's `{ messageId }`.
- A missing `EMAIL` binding is a deploy misconfiguration. `getBinding` throws a
  non-exposed `500` for it, the same as the other bindings.
- To reply to or forward an email your Worker receives, use the incoming
  message's own `reply()` and `forward()`.

See the [`email` API reference](/docs/api/email) for the full signature.
