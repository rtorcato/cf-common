---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/ai` module with `runAi`, a typed wrapper over the Workers AI binding's `run()`. The input and output types follow the model name, and a failed call throws a non-exposed `502` with code `AI_RUN_FAILED`.
