import { CloudflareError } from '../errors/index.js'

/** A SQL statement plus its bound parameters, for `batch`. */
export interface D1Statement {
	sql: string
	params?: unknown[]
}

/** Run a query and return all rows, typed as `T`. */
export async function query<T = Record<string, unknown>>(
	db: D1Database,
	sql: string,
	...params: unknown[]
): Promise<T[]> {
	const { results } = await db
		.prepare(sql)
		.bind(...params)
		.all<T>()
	return results
}

/** Run a query and return the first row, or `null` if there are none. */
export function queryFirst<T = Record<string, unknown>>(
	db: D1Database,
	sql: string,
	...params: unknown[]
): Promise<T | null> {
	return db
		.prepare(sql)
		.bind(...params)
		.first<T>()
}

/** Run a write (INSERT/UPDATE/DELETE) and return D1's result/metadata. */
export function execute(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
	return db
		.prepare(sql)
		.bind(...params)
		.run()
}

/** Execute many statements atomically in one D1 batch. */
export function batch<T = unknown>(
	db: D1Database,
	statements: D1Statement[]
): Promise<D1Result<T>[]> {
	return db.batch<T>(statements.map((s) => db.prepare(s.sql).bind(...(s.params ?? []))))
}

/** A named, forward-only migration. `sql` may contain multiple statements. */
export interface Migration {
	name: string
	sql: string
}

/**
 * Apply any migrations not yet recorded, in array order, tracking applied names
 * in a `_cf_migrations` table. Forward-only and idempotent — already-applied
 * migrations are skipped. Returns the names that ran this time.
 *
 * ponytail: each migration's SQL runs via `exec` (no surrounding transaction).
 * If a migration spanning multiple statements fails partway, earlier statements
 * in it are not rolled back — keep each migration small, or wrap DDL yourself.
 */
export async function runMigrations(db: D1Database, migrations: Migration[]): Promise<string[]> {
	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS _cf_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
		)
		.run()

	const applied = new Set(
		(await query<{ name: string }>(db, 'SELECT name FROM _cf_migrations')).map((r) => r.name)
	)

	const ran: string[] = []
	for (const migration of migrations) {
		if (applied.has(migration.name)) continue
		try {
			await db.exec(migration.sql)
			await execute(db, 'INSERT INTO _cf_migrations (name) VALUES (?)', migration.name)
			ran.push(migration.name)
		} catch (cause) {
			throw new CloudflareError(`Migration "${migration.name}" failed`, {
				code: 'D1_MIGRATION_FAILED',
				cause,
			})
		}
	}
	return ran
}
