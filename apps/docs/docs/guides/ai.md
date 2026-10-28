---
title: ai
description: A typed run() over the Workers AI binding, with the model's input and output types picked by name.
---

`@rtorcato/cf-common/ai` wraps the Workers AI binding's `run()`. You pass the
model name and its inputs, and the return type follows from the model. It adds
one thing on top: a failed call becomes a `CloudflareError` instead of a raw
upstream error.

```ts
import { runAi } from '@rtorcato/cf-common/ai'
import { getBinding } from '@rtorcato/cf-common/env'

const ai = getBinding<Ai>(env, 'AI')
```

## Run a model

```ts
const { response } = await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', {
  prompt: 'Name one Cloudflare product.',
})
// response: string | undefined
```

The model name is checked against the Workers AI model map in
`@cloudflare/workers-types`. Pass a name that isn't there, or inputs in the wrong
shape, and the compiler stops you before deploy.

## Options

The third argument is passed to `run()` as is, so gateway settings and the other
binding options work the same way:

```ts
await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', { prompt: 'hi' }, {
  gateway: { id: 'my-gateway' },
})
```

## When the call fails

Quota limits, model errors and upstream outages throw a `CloudflareError` with
status `502`, code `AI_RUN_FAILED` and the original error as `cause`. The
message is not exposed to clients, so under `defineFetch` the response is a
generic `Internal error`. Log `cause` if you need the detail. See
[errors](./errors.md) for how to catch it.

## Good to know

- `runAi` covers the normal `run()` call. Streaming and WebSocket responses come
  back as `ReadableStream` and `Response`, so use the binding's `run()` directly
  for those.
- A missing `AI` binding is a deploy misconfiguration. `getBinding` throws a
  non-exposed `500` for it, the same as the other bindings.

For a runnable walkthrough, see the `/ai` route in `apps/example`. See the
[`ai` API reference](/docs/api/ai) for every option.
