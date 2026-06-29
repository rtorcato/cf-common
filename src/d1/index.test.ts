import { describe, expect, it, vi } from 'vitest'
import { batch, query, queryFirst, runMigrations } from './index'

// Minimal in-memory D1Database fake — real binding tests land with #22.
// `allRows` is what every `.all()` returns (the migrations runner has a single SELECT).
function fakeD1(opts: { allRows?: unknown[]; firstRow?: unknown } = {}) {
	const run = vi.fn(async () => ({ success: true, meta: {} }) as unknown as D1Result)
	const exec = vi.fn(async () => ({ count: 0, duration: 0 }) as D1ExecResult)
	const bound: Array<{ sql: string; params: unknown[] }> = []
	const batchFn = vi.fn(async (stmts: unknown[]) =>
		stmts.map(() => ({ success: true }) as unknown as D1Result)
	)
	const db = {
		prepare(sql: string) {
			const stmt = {
				bind(...params: unknown[]) {
					bound.push({ sql, params })
					return stmt
				},
				all: async () => ({ results: opts.allRows ?? [], success: true, meta: {} }),
				first: async () => opts.firstRow ?? null,
				run,
			}
			return stmt as unknown as D1PreparedStatement
		},
		batch: batchFn,
		exec,
	} as unknown as D1Database
	return { db, run, exec, bound, batchFn }
}

describe('d1 module', () => {
	it('query binds params and returns rows', async () => {
		const { db, bound } = fakeD1({ allRows: [{ id: 1 }] })
		expect(await query(db, 'SELECT * FROM t WHERE id = ?', 1)).toEqual([{ id: 1 }])
		expect(bound[0]).toEqual({ sql: 'SELECT * FROM t WHERE id = ?', params: [1] })
	})

	it('queryFirst returns the first row or null', async () => {
		const { db } = fakeD1({ firstRow: { id: 7 } })
		expect(await queryFirst(db, 'SELECT 1')).toEqual({ id: 7 })
		const { db: empty } = fakeD1()
		expect(await queryFirst(empty, 'SELECT 1')).toBeNull()
	})

	it('batch prepares and binds each statement', async () => {
		const { db, bound, batchFn } = fakeD1()
		await batch(db, [{ sql: 'INSERT INTO t VALUES (?)', params: ['a'] }, { sql: 'DELETE FROM t' }])
		expect(bound).toEqual([
			{ sql: 'INSERT INTO t VALUES (?)', params: ['a'] },
			{ sql: 'DELETE FROM t', params: [] },
		])
		expect(batchFn).toHaveBeenCalledOnce()
	})

	it('runMigrations applies only unrecorded migrations in order', async () => {
		const { db, exec } = fakeD1({ allRows: [{ name: '001_init' }] })
		const ran = await runMigrations(db, [
			{ name: '001_init', sql: 'CREATE TABLE a (id);' },
			{ name: '002_users', sql: 'CREATE TABLE users (id);' },
		])
		expect(ran).toEqual(['002_users'])
		expect(exec).toHaveBeenCalledOnce()
		expect(exec).toHaveBeenCalledWith('CREATE TABLE users (id);')
	})
})
