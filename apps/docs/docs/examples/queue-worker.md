---
title: Queue worker
description: Enqueue background jobs from a fetch handler and process them in the same Worker with createProducer and defineQueue.
sidebar_position: 5
---

# Queue worker

Take slow work off the request path. The `fetch` handler enqueues a job and
returns `202`, and the same Worker's `queue` handler processes it, retrying with
a growing delay when it fails.

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'
import { parseJson } from '@rtorcato/cf-common/request'
import { createProducer, defineQueue } from '@rtorcato/cf-common/queues'

interface Env {
  [key: string]: unknown
  EMAILS: Queue<EmailJob>
}

interface EmailJob {
  to: string
}

const jobSchema = {
  parse(input: unknown): EmailJob {
    if (typeof (input as { to?: unknown })?.to !== 'string') {
      throw new Error('`to` (string) is required')
    }
    return input as EmailJob
  },
}

const api = defineFetch<Env>(async (req, env) => {
  if (req.method !== 'POST') throw new CloudflareError('POST only', { status: 405 })
  const job = await parseJson(req, jobSchema)
  await createProducer(getBinding<Queue<EmailJob>>(env, 'EMAILS')).send(job)
  return Response.json({ queued: true }, { status: 202 })
})

export default {
  ...api,
  queue: defineQueue<EmailJob, Env>(
    async (job) => {
      const res = await fetch('https://mail.example.com/send', {
        method: 'POST',
        body: JSON.stringify(job),
      })
      if (!res.ok) throw new Error(`mail API returned ${res.status}`) // retried
    },
    { retryDelay: (attempts) => 2 ** attempts * 10 }
  ),
}
```

## Notes

- **A thrown error retries one message.** The rest of the batch is acked. The
  failure is logged with `console.error`.
- **Dead letters.** After `max_retries` Cloudflare drops the message unless the
  consumer names a `dead_letter_queue`. See the [queues guide](/docs/guides/queues).
- **At least once.** A message can arrive twice, so make the handler safe to
  repeat.

## Binding

```jsonc
// wrangler.jsonc
"queues": {
  "producers": [{ "binding": "EMAILS", "queue": "emails" }],
  "consumers": [{ "queue": "emails", "max_retries": 5, "dead_letter_queue": "emails-dlq" }]
}
```

`wrangler queues create emails` creates the queue. Under `wrangler dev` the queue
is simulated locally and needs no account.

See the [`queues` API reference](/docs/api/queues) for every option.
