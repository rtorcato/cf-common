---
title: Getting started
description: Install cf-common and wire your first Cloudflare binding.
sidebar_position: 1
---

# Getting started

`cf-common` is a set of typed helpers for Cloudflare Workers bindings. You
install it once and import only the modules you need — each is a separate
subpath export, so your Worker bundle stays small.

## Install

```bash
pnpm add @rtorcato/cf-common
```

```bash
npm install @rtorcato/cf-common
```

## Import from subpaths

Always import from a service subpath — never from the package root:

```ts
// ✅ pulls in only the KV helper
import { kv } from '@rtorcato/cf-common/kv'

// ❌ the root entry is intentionally empty
import { kv } from '@rtorcato/cf-common'
```

## Type your environment

Cloudflare passes bindings on the `env` argument. Declare them once so every
helper is typed against your real bindings:

```ts
interface Env {
  CACHE: KVNamespace
  BUCKET: R2Bucket
  DB: D1Database
}
```

## A first Worker

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { kv } from '@rtorcato/cf-common/kv'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const store = kv(getBinding(env, 'CACHE'))
    const user = await store.getJSON<{ id: number }>('u:42')
    return Response.json(user ?? { id: 42 })
  },
}
```

:::note
The module APIs shown here land incrementally — see the
[roadmap](https://github.com/rtorcato/cf-common/blob/main/ROADMAP.md) for which
modules are published. This page updates as each one ships.
:::

## Next steps

- Browse the [roadmap](https://github.com/rtorcato/cf-common/blob/main/ROADMAP.md)
  to see what's available and what's coming.
- Follow [issues](https://github.com/rtorcato/cf-common/issues) for per-module progress.
