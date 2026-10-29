---
title: analytics
description: Write to Workers Analytics Engine by column name instead of blob1/double1 positions, with rejected points mapped to a CloudflareError.
---

`@rtorcato/cf-common/analytics` wraps the Analytics Engine binding's
`writeDataPoint()`. A data point is three positional arrays (`blobs`,
`doubles`, `indexes`), and queries read them back as `blob1`, `double1`,
`index1`. `createDataset` names those slots once, so you write and query by name.

```ts
import { createDataset, writeDataPoint } from '@rtorcato/cf-common/analytics'
import { getBinding } from '@rtorcato/cf-common/env'

const events = getBinding<AnalyticsEngineDataset>(env, 'REQUESTS')
```

## Bind it

Add a dataset to your wrangler config. The dataset is created on the first
write:

```jsonc
{
  "analytics_engine_datasets": [{ "binding": "REQUESTS", "dataset": "requests" }]
}
```

## Write by name

Declare the columns in slot order. `blobs` are strings (or bytes), `doubles`
are numbers, and `index` is the one sampling key (a customer or tenant id is
typical):

```ts
const requests = createDataset(events, {
  blobs: ['path', 'country'],
  doubles: ['latencyMs', 'status'],
  index: 'customerId',
})

requests.write({
  path: url.pathname,
  country: request.cf?.country ?? null,
  latencyMs: Date.now() - start,
  status: response.status,
  customerId,
})
```

Field names and types are checked at compile time: an unknown column, a
missing double or index, or a string in a double slot fails to build. A blob
you leave out is written as `null`.

Only append to a schema. The names map to positions, so reordering or removing
a column writes new data into a slot that holds a different column in older
rows.

## Query by name

`columns` maps each name to the column the SQL API reads:

```ts
const { path, latencyMs } = requests.columns // 'blob1', 'double1'

const sql = `
  SELECT ${path} AS path, avg(${latencyMs}) AS latency
  FROM requests
  WHERE timestamp > NOW() - INTERVAL '1' DAY
  GROUP BY path`
```

Send it to the
[SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
with an API token that has Account Analytics read access. Analytics Engine
samples at high volume, so weight counts and sums by `_sample_interval`.

## Write positionally

`writeDataPoint` takes the binding's own shape, for one-off writes or a
dataset you don't want to name:

```ts
writeDataPoint(events, { blobs: ['/api'], doubles: [12], indexes: ['c_1'] })
```

## When the write fails

`writeDataPoint` is fire-and-forget: it returns `void` and never waits on the
network. A point may hold at most 20 blobs, 20 doubles and one index of up to
96 bytes, with blobs under 16 KB in total. If the binding throws on a point,
the error becomes a `CloudflareError` with status `500`, code
`ANALYTICS_WRITE_FAILED` and the original error as `cause`. That is a bug in
the point, not a client error, so the message is not exposed. See [errors](./errors.md) for how to catch it.

## Good to know

- A Worker invocation can write up to 250 data points.
- A missing `REQUESTS` binding is a deploy misconfiguration. `getBinding`
  throws a non-exposed `500` for it, the same as the other bindings.
- See the
  [Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
  for the current numbers.

See the [`analytics` API reference](/docs/api/analytics) for the full signatures.
