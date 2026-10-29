import { describe, expect, it, vi } from 'vitest'
import { isCloudflareError } from '../errors/index'
import { createDataset, writeDataPoint } from './index'

// A stand-in for the Analytics Engine binding: only `writeDataPoint` is exercised.
function fakeDataset(write: (point: unknown) => void = () => {}) {
	return { writeDataPoint: vi.fn(write) } as unknown as AnalyticsEngineDataset & {
		writeDataPoint: ReturnType<typeof vi.fn>
	}
}

describe('analytics module', () => {
	it('writeDataPoint passes the point to the binding', () => {
		const dataset = fakeDataset()
		const point = { blobs: ['/api'], doubles: [12], indexes: ['c_1'] }

		writeDataPoint(dataset, point)

		expect(dataset.writeDataPoint).toHaveBeenCalledWith(point)
	})

	it('writeDataPoint maps a rejected point to a non-exposed 500 and keeps the cause', () => {
		const upstream = new TypeError('writeDataPoint(): Maximum of 20 blobs supported.')
		const dataset = fakeDataset(() => {
			throw upstream
		})

		try {
			writeDataPoint(dataset, { blobs: [] })
			expect.unreachable()
		} catch (err) {
			expect(isCloudflareError(err)).toBe(true)
			expect(isCloudflareError(err) && err.status).toBe(500)
			expect(isCloudflareError(err) && err.expose).toBe(false)
			expect(isCloudflareError(err) && err.code).toBe('ANALYTICS_WRITE_FAILED')
			expect((err as Error).cause).toBe(upstream)
		}
	})

	it('createDataset writes named fields in schema order, missing blobs as null', () => {
		const dataset = fakeDataset()
		const requests = createDataset(dataset, {
			blobs: ['path', 'country', 'referer'],
			doubles: ['latencyMs', 'status'],
			index: 'customerId',
		})

		requests.write({ status: 200, country: 'CA', path: '/api', latencyMs: 12, customerId: 'c_1' })

		expect(dataset.writeDataPoint).toHaveBeenCalledWith({
			blobs: ['/api', 'CA', null],
			doubles: [12, 200],
			indexes: ['c_1'],
		})
	})

	it('createDataset omits indexes when the schema has no index', () => {
		const dataset = fakeDataset()

		createDataset(dataset, { doubles: ['n'] }).write({ n: 1 })

		expect(dataset.writeDataPoint).toHaveBeenCalledWith({ blobs: [], doubles: [1] })
	})

	it('createDataset maps column names to SQL API columns', () => {
		const { columns } = createDataset(fakeDataset(), {
			blobs: ['path', 'country'],
			doubles: ['latencyMs'],
			index: 'customerId',
		})

		expect(columns).toEqual({
			path: 'blob1',
			country: 'blob2',
			latencyMs: 'double1',
			customerId: 'index1',
		})
	})

	it('createDataset types fields by name', () => {
		const requests = createDataset(fakeDataset(), { blobs: ['path'], doubles: ['ms'], index: 'id' })

		// @ts-expect-error a double is required
		requests.write({ path: '/', id: 'x' })
		// @ts-expect-error the index is required
		requests.write({ path: '/', ms: 1 })
		// @ts-expect-error unknown column
		requests.write({ ms: 1, id: 'x', nope: 1 })
		// @ts-expect-error a double must be a number
		requests.write({ ms: '1', id: 'x' })
	})
})
