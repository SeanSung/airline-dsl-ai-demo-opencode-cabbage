import { describe, expect, test } from 'bun:test'
import { openDb } from './db'

describe('store/db', () => {
  test('openDb 执行迁移 DDL，:memory: 中创建 routes/conversations 两表与两索引', () => {
    const db = openDb(':memory:')
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: { name: string }) => row.name)
    expect(tables).toContain('routes')
    expect(tables).toContain('conversations')

    const indexes = db
      .query("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row: { name: string }) => row.name)
    expect(indexes).toContain('idx_routes_created_at')
    expect(indexes).toContain('idx_conversations_route')

    db.close()
  })
})
