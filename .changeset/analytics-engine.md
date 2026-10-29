---
'@rtorcato/cf-common': minor
---

Add the `analytics` subpath: `writeDataPoint(dataset, point)` writes to an Analytics Engine dataset and maps a rejected point to a non-exposed 500 `CloudflareError` with code `ANALYTICS_WRITE_FAILED`, and `createDataset(dataset, schema)` names the blob, double and index columns so you write by name and get the SQL API column for each.
