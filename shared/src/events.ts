import type { AirlineContent, Intent } from './index.js'

export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'clarification'; missing: string[]; text?: string }
  | { type: 'route_generated'; routeId: string; content: AirlineContent; intent: Intent; aiGenerated: boolean }
  | { type: 'error'; code: string; message: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }

export type SSEEvent = AgentEvent
