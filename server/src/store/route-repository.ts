import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
import type { Route, RouteSummary } from './types'

type RouteInput = Omit<Route, 'id' | 'createdAt' | 'updatedAt'>
type RoutePatch = Partial<Omit<Route, 'id' | 'createdAt' | 'updatedAt'>>

interface RouteRow {
  id: string
  name: string
  intent_json: string
  content_json: string
  ai_generated: number
  status: string
  gbh_route_id: string | null
  gbh_error: string | null
  created_at: string
  updated_at: string
}

function rowToRoute(row: RouteRow): Route {
  return {
    id: row.id,
    name: row.name,
    intent: JSON.parse(row.intent_json),
    content: JSON.parse(row.content_json),
    aiGenerated: row.ai_generated === 1,
    status: row.status as Route['status'],
    gbhRouteId: row.gbh_route_id ?? undefined,
    gbhError: row.gbh_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RouteRepository {
  constructor(private readonly db: Database) {}

  create(input: RouteInput): Route {
    const now = new Date().toISOString()
    const route: Route = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    this.db
      .query(
        `INSERT INTO routes (id, name, intent_json, content_json, ai_generated, status, gbh_route_id, gbh_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        route.id,
        route.name,
        JSON.stringify(route.intent),
        JSON.stringify(route.content),
        route.aiGenerated ? 1 : 0,
        route.status,
        route.gbhRouteId ?? null,
        route.gbhError ?? null,
        route.createdAt,
        route.updatedAt,
      )
    return route
  }

  get(id: string): Route | null {
    const row = this.db
      .query(
        `SELECT id, name, intent_json, content_json, ai_generated, status, gbh_route_id, gbh_error, created_at, updated_at
         FROM routes WHERE id = ?`,
      )
      .get(id) as RouteRow | null
    return row ? rowToRoute(row) : null
  }

  list(): RouteSummary[] {
    const rows = this.db
      .query(
        `SELECT r.id, r.name, r.ai_generated, r.status, r.created_at, r.updated_at,
                json_array_length(r.content_json, '$.waypoints') AS waypoint_count,
                c.id AS conversation_id
         FROM routes r
         LEFT JOIN conversations c ON c.route_id = r.id
         ORDER BY r.created_at DESC`,
      )
      .all() as (RouteRow & { waypoint_count: number | null; conversation_id: string | null })[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      aiGenerated: row.ai_generated === 1,
      status: row.status as Route['status'],
      waypointCount: row.waypoint_count ?? 0,
      conversationId: row.conversation_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  update(id: string, patch: RoutePatch): Route {
    const existing = this.get(id)
    if (!existing) {
      throw new Error(`route not found: ${id}`)
    }
    const merged: Route = { ...existing, ...patch, id, updatedAt: new Date().toISOString() }
    this.db
      .query(
        `UPDATE routes
         SET name = ?, intent_json = ?, content_json = ?, ai_generated = ?, status = ?, gbh_route_id = ?, gbh_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        merged.name,
        JSON.stringify(merged.intent),
        JSON.stringify(merged.content),
        merged.aiGenerated ? 1 : 0,
        merged.status,
        merged.gbhRouteId ?? null,
        merged.gbhError ?? null,
        merged.updatedAt,
        id,
      )
    return merged
  }
}
