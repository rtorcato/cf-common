---
title: workflows
description: A typed client over a Cloudflare Workflow binding.
---

`@rtorcato/cf-common/workflows` is the caller's side of a
[Cloudflare Workflow](https://developers.cloudflare.com/workflows/).
`createWorkflow` wraps a Workflow binding so `create` takes typed params,
`status` returns a typed `output`, and failures become a `CloudflareError`.

The Workflow itself needs no helper. Extend `WorkflowEntrypoint` from
`cloudflare:workers`: `@cloudflare/workers-types` already types `event.payload`,
`step.do`, `step.sleep` and `step.waitForEvent`.

## Define the Workflow

```ts
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

export interface SignupParams { email: string }
export interface SignupResult { userId: string }

export class SignupWorkflow extends WorkflowEntrypoint<Env, SignupParams> {
  async run(event: Readonly<WorkflowEvent<SignupParams>>, step: WorkflowStep): Promise<SignupResult> {
    const user = await step.do('create user', async () => ({ userId: crypto.randomUUID() }))
    await step.sleep('wait before welcome email', '1 hour')
    await step.do('send welcome email', async () => sendWelcome(event.payload.email))
    return user
  }
}
```

Bind it in `wrangler.jsonc`:

```jsonc
"workflows": [
  { "binding": "SIGNUP", "name": "signup", "class_name": "SignupWorkflow" }
]
```

## Start and watch it

Pass the params and result types once. Import them from the Workflow's module as
types, so the Workflow's code isn't bundled into the caller.

```ts
import { createWorkflow } from '@rtorcato/cf-common/workflows'
import type { SignupParams, SignupResult } from './signup-workflow'

const signups = createWorkflow<SignupParams, SignupResult>(env.SIGNUP)

const instance = await signups.create({ email: 'ada@example.com' }, { id: 'ada' })

const { status, output, error } = await signups.status(instance.id)
if (status === 'complete') console.log(output?.userId)
```

`create` returns Cloudflare's `WorkflowInstance`, so `pause`, `resume`,
`terminate`, `restart` and `sendEvent` are there. `get(id)` returns the same
handle for an instance that already exists. Omit `id` and Cloudflare generates
one; pass your own when you need to look it up later or want a duplicate request
to fail.

## Failures

`create`, `get` and `status` turn any failure (an unknown or duplicate instance
id, an unreachable binding) into a `CloudflareError` with status 502, code
`WORKFLOW_FAILED`, `expose: false`, and the original error as `cause`.
`defineFetch` then returns it as `Internal error`, so Workflow internals never
reach the client.

A step that throws is retried by the Workflow engine, not by this helper. To fail
a step for good, throw `NonRetryableError` from `cloudflare:workflows`.

## Good to know

- `output` is typed, not validated. It is whatever `run` returned, and it is
  `undefined` until the instance completes.
- `status` reads the instance on every call. It does not wait, so poll it or
  have the Workflow report back.

See the [`workflows` API reference](/docs/api/workflows) for every export.
