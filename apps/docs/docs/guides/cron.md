---
title: cron
description: One scheduled handler that dispatches each cron trigger to its own job.
---

`@rtorcato/cf-common/cron` builds the `scheduled` handler for a Worker with Cron
Triggers. You map each cron expression to a job, and the handler runs the one
that fired.

```ts
import { defineScheduled } from '@rtorcato/cf-common/cron'

export default {
  scheduled: defineScheduled<Env>({
    '0 * * * *': async (_controller, env) => rollupHourly(env),
    '0 0 * * *': async (_controller, env) => rollupDaily(env),
  }),
}
```

## Configure the triggers

The keys must match the `crons` in `wrangler.jsonc` exactly, character for
character:

```jsonc
"triggers": {
  "crons": ["0 * * * *", "0 0 * * *"]
}
```

## The job

Each job gets the same arguments as a `scheduled` handler:

```ts
'*/5 * * * *': async (controller, env, ctx) => {
  console.log(controller.cron, new Date(controller.scheduledTime).toISOString())
  ctx.waitUntil(flushMetrics(env))
}
```

`controller.cron` is the expression that fired and `controller.scheduledTime` is
when it was due, in milliseconds.

## Alongside fetch

`defineFetch` returns an object, so spread it to put both handlers in one Worker:

```ts
const api = defineFetch<Env>(handler)

export default {
  ...api,
  scheduled: defineScheduled<Env>({ '0 * * * *': hourly }),
}
```

## When nothing matches

A trigger with no job throws a `CloudflareError` with code `CRON_NO_MATCH`. It
shows up in the Worker's logs, which is where a typo between the config and the
code gets caught. An error thrown by a job propagates the same way.

## Test it locally

`wrangler dev --test-scheduled` exposes a route that fires the handler:

```sh
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

For a runnable walkthrough, see the `scheduled` handler in `apps/example`. See the
[`cron` API reference](/docs/api/cron) for every option.
