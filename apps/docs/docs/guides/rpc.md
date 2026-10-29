---
title: rpc
description: Typed Service Bindings to a WorkerEntrypoint, and RPC failures mapped to a CloudflareError.
---

`@rtorcato/cf-common/rpc` is for Worker-to-Worker calls. `getService` reads a
Service Binding from `env` typed by the callee's entrypoint, so its public
methods are checked RPC calls. `callService` maps a failed call to a
`CloudflareError`.

## Define the callee

The callee is a normal `WorkerEntrypoint`. Its public methods are the contract.

```ts
// auth-worker/src/index.ts
import { WorkerEntrypoint } from 'cloudflare:workers'

export class AuthService extends WorkerEntrypoint<Env> {
  async verify(token: string): Promise<{ userId: string } | null> {
    // look the token up in this Worker's own D1/KV
    return token === 'valid' ? { userId: 'u_1' } : null
  }
}

export default {
  fetch: () => new Response('auth worker'),
} satisfies ExportedHandler<Env>
```

Bind it in the caller's `wrangler.jsonc`:

```jsonc
"services": [
  { "binding": "AUTH", "service": "auth-worker", "entrypoint": "AuthService" }
]
```

## Call it

Share the contract by importing the class as a **type**, so the callee's code
isn't bundled into the caller. Publish it from the callee's package, or point a
workspace import at it.

```ts
import { getService, callService } from '@rtorcato/cf-common/rpc'
import { defineFetch } from '@rtorcato/cf-common/http'
import { bearerToken } from '@rtorcato/cf-common/request'
import type { AuthService } from 'auth-worker'

export default defineFetch(async (request, env: Env) => {
  const auth = getService<typeof AuthService>(env, 'AUTH')
  const user = await callService('AUTH', () => auth.verify(bearerToken(request) ?? ''))
  return Response.json({ user })
})
```

`getService<typeof AuthService>` is `getBinding` with the type filled in. A
missing binding throws a non-exposed 500, since that is a deploy
misconfiguration. `auth.fetch(request)` is there too, for entrypoints that also
serve HTTP.

## Failures

`callService` runs the call and turns any failure (the callee threw, the binding
is unreachable, the callee hit its limits) into a `CloudflareError` with status
502, code `RPC_CALL_FAILED`, `expose: false`, and the original error as `cause`.
`defineFetch` then returns it as `Internal error`, so the callee's message never
reaches the client.

A callee's own `status` and `code` do not cross the RPC boundary. For an expected
failure such as "token invalid", return a value (`null`, or a result object)
instead of throwing, as `verify` does above.

## Good to know

- Only the entrypoint's public methods are callable, and arguments and results
  must be serializable by Workers RPC.
- A binding to the callee's default export (`export default { fetch }`) has no
  RPC methods. Name the entrypoint in the binding.
- Calls to a Worker on the same account don't go over the public internet and
  aren't billed as extra requests.

See the [`rpc` API reference](/docs/api/rpc) for every export.
