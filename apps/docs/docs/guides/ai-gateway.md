---
title: ai-gateway
description: Route provider calls through Cloudflare AI Gateway with typed cf-aig-* options.
---

`@rtorcato/cf-common/ai-gateway` sends model calls through an
[AI Gateway](https://developers.cloudflare.com/ai-gateway/), which adds caching,
logging, retries and analytics in front of OpenAI, Anthropic, Workers AI and the
other providers. It builds the gateway URL, turns typed options into the
`cf-aig-*` headers, and maps failures to a `CloudflareError`.

```ts
import { createAiGateway } from '@rtorcato/cf-common/ai-gateway'
import { requireEnv } from '@rtorcato/cf-common/env'

const gateway = createAiGateway({
  accountId: requireEnv(env, 'CF_ACCOUNT_ID'),
  gatewayId: 'prod',
  // Only for an authenticated gateway:
  token: requireEnv(env, 'AI_GATEWAY_TOKEN'),
})
```

## Call a provider

`json` POSTs a JSON body to the provider's own path and returns the parsed
response. The type is asserted, not validated.

```ts
interface ChatCompletion {
  choices: { message: { content: string } }[]
}

const completion = await gateway.json<ChatCompletion>(
  'openai',
  '/chat/completions',
  { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }] },
  { cacheTtl: 3600, metadata: { user: 'u_1' } }
)
```

The provider's own key still goes in its own header. Pass it through `fetch`'s
`init`, which also gives you the raw `Response` for streaming:

```ts
const res = await gateway.fetch(
  'anthropic',
  '/v1/messages',
  {
    method: 'POST',
    headers: {
      'x-api-key': requireEnv(env, 'ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 256, stream: true, messages }),
  },
  { skipCache: true }
)
return new Response(res.body, { headers: { 'Content-Type': 'text/event-stream' } })
```

Use `gatewayUrl(config, 'openai')` as the `baseURL` of a provider SDK, and
`gatewayHeaders(options, token)` as its default headers, if you'd rather keep the
SDK.

## Options

The options are the Workers AI binding's `gateway` option without `id`, so the
same object works in both places.

| Option | Header |
| --- | --- |
| `cacheTtl` | `cf-aig-cache-ttl` (seconds) |
| `skipCache` | `cf-aig-skip-cache` |
| `cacheKey` | `cf-aig-cache-key` |
| `metadata` | `cf-aig-metadata` (JSON) |
| `collectLog` | `cf-aig-collect-log` |
| `eventId` | `cf-aig-event-id` |
| `requestTimeoutMs` | `cf-aig-request-timeout` |
| `retries.maxAttempts` / `retryDelayMs` / `backoff` | `cf-aig-max-attempts` / `cf-aig-retry-delay` / `cf-aig-backoff` |

The client's `token` is sent as `cf-aig-authorization: Bearer <token>`. Options
win over a `cf-aig-*` header you also set in `init`.

## Workers AI

From a Worker with an AI binding you don't need this client. Pass the gateway to
[`runAi`](./ai.md):

```ts
await runAi(ai, '@cf/meta/llama-3.2-3b-instruct', { prompt: 'Hi' }, {
  gateway: { id: 'prod', cacheTtl: 3600 },
})
```

The binding's `ai.gateway('prod')` also has `getLog`, `patchLog` and `getUrl`.
Without a binding, call Workers AI over REST through the gateway with provider
`workers-ai`, a path like `/@cf/meta/llama-3.2-3b-instruct` and an
`Authorization: Bearer <API token>` header.

## Errors

| Code | Status | When |
| --- | --- | --- |
| `AI_GATEWAY_FAILED` | 502 (not exposed) | Network error, a non-2xx response, or a non-JSON body from `json`. The upstream status and body are on `cause` |
| `AI_GATEWAY_INVALID` | 500 (not exposed) | An empty account or gateway id, or a `.`/`..` id, provider or path segment |

Neither the gateway token nor a provider key appears in the error message.

## Good to know

- `path` is appended to the provider URL as is, so start it with `/` and encode
  any ids you put in it. A dot segment is rejected because `fetch` would resolve
  it to another gateway or account.
- No auto-retries or fallbacks in the client: set `retries` for the gateway to
  retry, or use the gateway's universal endpoint for fallbacks.

See the [`ai-gateway` API reference](/docs/api/ai-gateway) for every export.
