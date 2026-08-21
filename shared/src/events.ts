import type { AirlineContent } from './airline-content.js'

export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'clarification'; missing: string[]; text?: string }
  | { type: 'route_generated'; routeId: string; content: AirlineContent; aiGenerated: boolean }
  | { type: 'error'; code: string; message: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }

export type SSEEvent = AgentEvent
