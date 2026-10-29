---
'@rtorcato/cf-common': minor
---

Add the `email` subpath: `sendEmail(binding, message)` sends over a `send_email` binding, from fields or a raw-MIME `EmailMessage`, and maps a failed send to a non-exposed 502 `CloudflareError` with code `EMAIL_SEND_FAILED`.
