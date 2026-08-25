import type { AirlineContent, Intent } from '@airline-dsl/shared'

export interface RouteData {
  routeId: string
  content: AirlineContent
  intent: Intent
  aiGenerated: boolean
}
