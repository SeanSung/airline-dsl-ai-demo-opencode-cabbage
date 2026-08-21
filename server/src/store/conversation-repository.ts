import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
import type { Conversation } from './types'

type ConversationInput = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>

interface ConversationRow {
  id: string
  messages_json: string
  route_id: string | null
  created_at: string
  updated_at: string
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    messagesJson: row.messages_json,
    routeId: row.route_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ConversationRepository {
  constructor(private readonly db: Database) {}

  create(input: ConversationInput): Conversation {
    const now = new Date().toISOString()
    const conv: Conversation = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    this.db
      .query(
        `INSERT INTO conversations (id, messages_json, route_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(conv.id, conv.messagesJson, conv.routeId ?? null, conv.createdAt, conv.updatedAt)
    return conv
  }

  get(id: string): Conversation | null {
    const row = this.db
      .query(
        `SELECT id, messages_json, route_id, created_at, updated_at
         FROM conversations WHERE id = ?`,
      )
      .get(id) as ConversationRow | null
    return row ? rowToConversation(row) : null
  }

  updateState(id: string, messagesJson: string, routeId: string | null): void {
    this.db
      .query(
        `UPDATE conversations
         SET messages_json = ?, route_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(messagesJson, routeId, new Date().toISOString(), id)
  }

  findByRoute(routeId: string): Conversation | null {
    const row = this.db
      .query(
        `SELECT id, messages_json, route_id, created_at, updated_at
         FROM conversations WHERE route_id = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(routeId) as ConversationRow | null
    return row ? rowToConversation(row) : null
  }
}
