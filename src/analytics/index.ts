import { CloudflareError } from '../errors/index.js'

/** A blob value: a string, raw bytes, or `null` for an empty slot. */
export type BlobValue = string | ArrayBuffer | null

/**
 * Column names for one dataset, in slot order: `blobs[0]` is written to
 * `blob1`, `doubles[0]` to `double1`, and `index` (if set) to `index1`.
 */
export interface DatasetSchema {
	readonly blobs?: readonly string[]
	readonly doubles?: readonly string[]
	readonly index?: string
}

type Names<T> = T extends readonly (infer N extends string)[] ? N : never

/** One data point by column name. Blobs are optional (`null` when missing); doubles and the index are required. */
export type DataPointFields<S extends DatasetSchema> = {
	[K in Names<S['blobs']>]?: BlobValue
} & { [K in Names<S['doubles']>]: number } & (S['index'] extends string
		? { [K in S['index']]: string }
		: unknown)

/** A dataset with named columns. */
export interface Dataset<S extends DatasetSchema> {
	/** Write one data point. Throws `ANALYTICS_WRITE_FAILED`. */
	write(fields: DataPointFields<S>): void
	/** Each column name mapped to its SQL API column (`blob1`, `double1`, `index1`), for building queries. */
	readonly columns: Readonly<Record<Names<S['blobs']> | Names<S['doubles']>, string>> &
		(S['index'] extends string ? { readonly [K in S['index']]: 'index1' } : unknown)
}

/**
 * Write one data point to an Analytics Engine dataset. The binding is
 * fire-and-forget, so this returns nothing and never waits on the network.
 *
 * Limits: 20 blobs, 20 doubles, one index of at most 96 bytes, 16 KB of blobs
 * per point. If the binding throws (a point it rejects), the error becomes a
 * non-exposed 500 with code `ANALYTICS_WRITE_FAILED` and the original as `cause`.
 *
 * @example
 * const events = getBinding<AnalyticsEngineDataset>(env, 'EVENTS')
 * writeDataPoint(events, { blobs: [path, country], doubles: [ms], indexes: [customerId] })
 */
export function writeDataPoint(dataset: AnalyticsEngineDataset, point: AnalyticsEngineDataPoint) {
	try {
		dataset.writeDataPoint(point)
	} catch (cause) {
		throw new CloudflareError('Analytics Engine write failed', {
			status: 500,
			expose: false,
			code: 'ANALYTICS_WRITE_FAILED',
			cause,
		})
	}
}

/**
 * Name a dataset's columns once, then write by name instead of by position.
 * Declare the schema `as const` (or inline) so the column names are literal
 * types. Changing the order of an existing schema moves data between columns,
 * so only append.
 *
 * @example
 * const requests = createDataset(getBinding<AnalyticsEngineDataset>(env, 'REQUESTS'), {
 *   blobs: ['path', 'country'],
 *   doubles: ['latencyMs', 'status'],
 *   index: 'customerId',
 * })
 * requests.write({ path: '/api', country: 'CA', latencyMs: 12, status: 200, customerId: 'c_1' })
 * requests.columns.latencyMs // 'double1'
 */
export function createDataset<const S extends DatasetSchema>(
	dataset: AnalyticsEngineDataset,
	schema: S
): Dataset<S> {
	const blobs = schema.blobs ?? []
	const doubles = schema.doubles ?? []
	const columns: Record<string, string> = {}
	blobs.forEach((name, i) => {
		columns[name] = `blob${i + 1}`
	})
	doubles.forEach((name, i) => {
		columns[name] = `double${i + 1}`
	})
	if (schema.index) columns[schema.index] = 'index1'

	return {
		columns: columns as Dataset<S>['columns'],
		write(fields) {
			const row = fields as Record<string, BlobValue | number | undefined>
			writeDataPoint(dataset, {
				blobs: blobs.map((name) => (row[name] as BlobValue | undefined) ?? null),
				doubles: doubles.map((name) => row[name] as number),
				...(schema.index ? { indexes: [row[schema.index] as string] } : {}),
			})
		},
	}
}
