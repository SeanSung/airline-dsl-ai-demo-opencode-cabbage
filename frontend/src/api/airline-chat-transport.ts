import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import type { AirlineDataTypes } from './agent-event-stream'
import { sseResponseToChunkStream } from './agent-event-stream'

/**
 * Callback to register routeId→conversationId mapping
 * (migrated from useChatStream's registerConversationRoute).
 */
export type RegisterRoute = (routeId: string, conversationId: string) => void

export interface AirlineChatTransportOptions {
  /** Lazy conversation creation: POST /api/conversations on first send. */
  ensureConversation: (signal?: AbortSignal) => Promise<string>
  /** Current conversationId (null after newConversation). */
  getConversationId: () => string | null
  /** Register route↔conversation mapping for history resume. */
  registerRoute?: RegisterRoute
}

/**
 * ChatTransport adapter for the airline SSE backend.
 *
 * sendMessages: extract last user text → ensureConversation → POST messages → sseResponseToChunkStream.
 * reconnectToStream: null (MVP, backend has no resume support).
 */
export class AirlineChatTransport implements ChatTransport<UIMessage> {
  private readonly ensureConversation: (signal?: AbortSignal) => Promise<string>
  private readonly getConversationId: () => string | null
  private readonly registerRoute?: RegisterRoute

  constructor(opts: AirlineChatTransportOptions) {
    this.ensureConversation = opts.ensureConversation
    this.getConversationId = opts.getConversationId
    this.registerRoute = opts.registerRoute
  }

  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UIMessage[]
    abortSignal: AbortSignal | undefined
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options

    // Extract text from the last user message
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const text = lastUser?.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') ?? ''

    // Lazy conversation creation
    const cid = await this.ensureConversation(abortSignal)

    // POST to backend
    const res = await fetch(`/api/conversations/${cid}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: abortSignal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `Chat request failed (${res.status}): ${body || res.statusText}`,
      )
    }

    // Stream SSE → UIMessageChunk, registering routes as they arrive
    return sseResponseToChunkStream(res.body, {
      onRoute: (route) => {
        this.registerRoute?.(route.routeId, cid)
      },
      signal: abortSignal ?? undefined,
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    // MVP: backend has no stream resume support
    return null
  }
}
