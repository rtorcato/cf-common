---
'@rtorcato/cf-common': minor
---

Add the `@rtorcato/cf-common/workflows` module with `createWorkflow`, a typed client over a Workflow binding: `create` takes typed params, `status` returns a typed `output`, and any failure becomes a non-exposed `502` with code `WORKFLOW_FAILED`.
