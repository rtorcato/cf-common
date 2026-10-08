---
title: D1 queries
description: A small notes API on D1 with typed queries, writes, batches, and forward-only migrations.
sidebar_position: 4
---

# D1 queries

A notes API on D1. `query` and `queryFirst` return typed rows, `execute` runs a
write, `batch` runs several statements atomically, and `runMigrations` sets up
the schema on first request. Parameters are always bound, never interpolated
into the SQL.

```ts
import { batch, execute, query, queryFirst, runMigrations } from '@rtorcato/cf-common/d1'
import { getBinding } from '@rtorcato/cf-common/env'
import { CloudflareError } from '@rtorcato/cf-common/errors'
import { defineFetch } from '@rtorcato/cf-common/http'
import { parseJson } from '@rtorcato/cf-common/request'

interface Env {
  [key: string]: unknown
  DB: D1Database
}

interface Note {
  id: number
  title: string
  created_at: string
}

const MIGRATIONS = [
  {
    name: '0001_notes',
    sql: "CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  },
  { name: '0002_tags', sql: 'CREATE TABLE tags (note_id INTEGER NOT NULL, tag TEXT NOT NULL)' },
]

const newNote = {
  parse(input: unknown): { title: string; tags: string[] } {
    const { title, tags = [] } = (input ?? {}) as { title?: unknown; tags?: unknown }
    if (typeof title !== 'string' || !title) throw new Error('`title` is required')
    if (!Array.isArray(tags)) throw new Error('`tags` must be an array')
    return { title, tags: tags.map(String) }
  },
}

export default defineFetch<Env>(async (req, env) => {
  const db = getBinding<D1Database>(env, 'DB')
  await runMigrations(db, MIGRATIONS) // no-op once applied

  const { pathname, searchParams } = new URL(req.url)
  const id = Number(pathname.split('/')[2])

  if (req.method === 'GET' && pathname === '/notes') {
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)
    return Response.json(
      await query<Note>(db, 'SELECT * FROM notes ORDER BY id DESC LIMIT ?', limit)
    )
  }

  if (req.method === 'GET' && id) {
    const note = await queryFirst<Note>(db, 'SELECT * FROM notes WHERE id = ?', id)
    if (!note) throw new CloudflareError('Note not found', { status: 404 })
    return Response.json(note)
  }

  if (req.method === 'POST' && pathname === '/notes') {
    const { title, tags } = await parseJson(req, newNote) // 400 on a bad body
    const { meta } = await execute(db, 'INSERT INTO notes (title) VALUES (?)', title)
    const noteId = meta.last_row_id
    // All tag rows land together or not at all.
    if (tags.length) {
      await batch(
        db,
        tags.map((tag) => ({ sql: 'INSERT INTO tags (note_id, tag) VALUES (?, ?)', params: [noteId, tag] }))
      )
    }
    return Response.json({ id: noteId, title, tags }, { status: 201 })
  }

  if (req.method === 'DELETE' && id) {
    await batch(db, [
      { sql: 'DELETE FROM tags WHERE note_id = ?', params: [id] },
      { sql: 'DELETE FROM notes WHERE id = ?', params: [id] },
    ])
    return new Response(null, { status: 204 })
  }

  throw new CloudflareError('Not found', { status: 404 })
})
```

## Migrations

`runMigrations` records applied names in a `_cf_migrations` table and skips
them on later calls, so it is safe to run on every request or at startup. It is
forward-only: to change a table, add a new migration rather than editing an old
one. Each migration runs without a surrounding transaction, so keep each one to
a single change. A failure throws a `CloudflareError` with code
`D1_MIGRATION_FAILED`.

Running migrations from the Worker suits small apps. For a team, prefer
`wrangler d1 migrations apply` in CI and drop the call from the handler.

## Binding

```jsonc
// wrangler.jsonc
"d1_databases": [{ "binding": "DB", "database_name": "notes", "database_id": "<database-id>" }]
```

`wrangler d1 create notes` prints the id. `wrangler dev` uses a local SQLite
file, so nothing here needs an account until you deploy.

See the [`d1` API reference](/docs/api/d1).
