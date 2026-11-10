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
import { createKvStore } from '@rtorcato/cf-common/kv'

// ❌ the root entry is intentionally empty
import { createKvStore } from '@rtorcato/cf-common'
```

## Configure TypeScript

Add the Workers types and leave the DOM lib out. `@cloudflare/workers-types`
declares the same globals (`Request`, `Response`, `fetch`, …) that the DOM lib
does, so keeping DOM in your default `lib` gives duplicate-identifier errors on
your first Worker.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  }
}
```

## Type your environment

Cloudflare passes bindings on the `env` argument. Declare them once so every
helper is typed against your real bindings. The index signature lets your `Env`
fit the `Record<string, unknown>` that the helpers take:

```ts
interface Env {
  [key: string]: unknown
  CACHE: KVNamespace
  BUCKET: R2Bucket
  DB: D1Database
}
```

## A first Worker

```ts
import { getBinding } from '@rtorcato/cf-common/env'
import { createKvStore } from '@rtorcato/cf-common/kv'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const store = createKvStore<{ id: number }>(getBinding<KVNamespace>(env, 'CACHE'))
    const user = await store.get('u:42') // { id: number } | null
    return Response.json(user ?? { id: 42 })
  },
}
```

## Agent skill

This repo ships an agent skill (`skills/cf-common/SKILL.md`) that teaches coding
agents the subpath imports, the `CloudflareError` / `defineFetch` error contract,
and each module's API. Install it in one command, straight from GitHub:

```sh
npx skills add https://github.com/rtorcato/cf-common --skill cf-common
```

## Next steps

- Browse the [milestones](https://github.com/rtorcato/cf-common/milestones)
  to see what's available and what's coming.
- Follow [issues](https://github.com/rtorcato/cf-common/issues) for per-module progress.
