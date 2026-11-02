---
"@rtorcato/cf-common": patch
---

`createAiGateway`'s `fetch` and `json` no longer follow redirects: requests go out with `redirect: 'manual'` (overriding any `init.redirect`), so a 3xx from the gateway can't send the gateway token or provider key to another host. A 3xx now throws `AI_GATEWAY_FAILED` like any other non-2xx status.
