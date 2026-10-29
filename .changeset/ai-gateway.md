---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/ai-gateway` module: `createAiGateway` sends provider calls through an AI Gateway endpoint (`fetch` returns the response, `json` posts and parses JSON), `gatewayUrl` builds the endpoint URL, and `gatewayHeaders` turns typed cache, metadata, logging and retry options into `cf-aig-*` headers. Failures throw a non-exposed `502` with code `AI_GATEWAY_FAILED`; a bad id, provider or path segment throws a non-exposed `500` `AI_GATEWAY_INVALID`.
