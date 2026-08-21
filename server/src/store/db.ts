import { Database } from 'bun:sqlite'

export const MIGRATION_DDL = `
CREATE TABLE IF NOT EXISTS routes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  intent_json   TEXT NOT NULL,
  content_json  TEXT NOT NULL,
  ai_generated  INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft',
  gbh_route_id  TEXT,
  gbh_error     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  messages_json TEXT NOT NULL,
  route_id      TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_route ON conversations(route_id);
`

export function openDb(path = ':memory:'): Database {
  const db = new Database(path)
  db.exec(MIGRATION_DDL)
  return db
}
