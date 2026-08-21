import type { Intent, AirlineContent } from '@airline-dsl/shared'

export type RouteStatus = 'draft' | 'validated' | 'failed'

export interface Route {
  id: string
  name: string
  intent: Intent
  content: AirlineContent
  aiGenerated: boolean
  status: RouteStatus
  gbhRouteId?: string
  gbhError?: string
  createdAt: string
  updatedAt: string
}

export interface RouteSummary {
  id: string
  name: string
  aiGenerated: boolean
  status: RouteStatus
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  messagesJson: string
  routeId?: string
  createdAt: string
  updatedAt: string
}
