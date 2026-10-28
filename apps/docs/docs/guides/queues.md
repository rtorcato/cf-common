---
title: queues
description: A typed producer for Queue bindings and a consumer that acks or retries each message on its own.
---

`@rtorcato/cf-common/queues` covers both ends of a Cloudflare Queue: a typed
producer over a `Queue` binding, and a `queue` handler that settles every
message individually.

```ts
import { createProducer, defineQueue } from '@rtorcato/cf-common/queues'
import { getBinding } from '@rtorcato/cf-common/env'

interface EmailJob {
  to: string
  template: string
}

const jobs = createProducer<EmailJob>(getBinding<Queue<EmailJob>>(env, 'EMAILS'))
```

## Send

```ts
await jobs.send({ to: 'ada@example.com', template: 'welcome' })

// run in 30 seconds
await jobs.send({ to: 'ada@example.com', template: 'reminder' }, { delaySeconds: 30 })
```

`sendBatch` takes plain bodies. Cloudflare accepts at most 100 messages per
call, so a longer list is split into chunks of 100 and sent in order.

```ts
await jobs.sendBatch(recipients.map((to) => ({ to, template: 'digest' })))
```

If the binding rejects a call, you get a `CloudflareError` with code
`QUEUE_SEND_FAILED` (status 502, not exposed). A batch stops at the first
failing chunk, so earlier chunks stay enqueued. Cloudflare also caps a batch at
256 KB, which the helper does not check.

## Consume

`defineQueue` returns the `queue` handler. Your function gets one message body at a
time. When it returns, the message is acked. When it throws, only that message is
retried.

```ts
import { defineQueue } from '@rtorcato/cf-common/queues'

export default {
  queue: defineQueue<EmailJob, Env>(async (job, message, env) => {
    await sendEmail(env, job)
  }),
}
```

The handler also receives the raw `Message`, so you can read `message.id` or
`message.attempts`. Call `message.ack()` yourself if you want to settle early.

### Back off between retries

```ts
defineQueue<EmailJob, Env>(handler, {
  retryDelay: (attempts) => 2 ** attempts * 10, // 20s, 40s, 80s...
})
```

`retryDelay` also takes a number of seconds. Without it, a failed message is
redelivered straight away. Failures are logged with `console.error`.

## Dead-letter queue

After `max_retries` deliveries Cloudflare drops the message unless the consumer
has a `dead_letter_queue`. Set one in `wrangler.jsonc`:

```jsonc
"queues": {
  "producers": [{ "binding": "EMAILS", "queue": "emails" }],
  "consumers": [{ "queue": "emails", "max_retries": 5, "dead_letter_queue": "emails-dlq" }]
}
```

## Good to know

- Messages in a batch run concurrently. Lower `max_batch_size` in the consumer
  config if your downstream can't take that.
- Delivery is at least once, so make the handler idempotent.
- One producer wraps one queue. Create one per binding.

For a full walkthrough, see the [queue worker example](/docs/examples/queue-worker).
See the [`queues` API reference](/docs/api/queues) for every option.
