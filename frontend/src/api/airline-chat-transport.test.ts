import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { UIMessage } from 'ai'
import { AirlineChatTransport } from './airline-chat-transport'
import type { AirlineDataTypes } from './agent-event-stream'

// Helper to collect all chunks from a ReadableStream
async function collectChunks(stream: ReadableStream): Promise<unknown[]> {
  const chunks: unknown[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return chunks
}

// Helper to build SSE byte stream
function sseBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((e) => encoder.encode(`data: ${e}\n\n`))
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++])
      } else {
        controller.close()
      }
    },
  })
}

function makeUserMessage(text: string): UIMessage {
  return {
    id: 'msg-1',
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

describe('AirlineChatTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sendMessages: lazy ensureConversation → POST messages → return chunk stream', async () => {
    const agentEvent = JSON.stringify({
      type: 'text_delta',
      text: 'hello',
    })
    const doneEvent = JSON.stringify({ type: 'done' })
    const body = sseBody([agentEvent, doneEvent])

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/conversations') {
        return Promise.resolve(
          new Response(JSON.stringify({ conversationId: 'conv-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url === '/api/conversations/conv-1/messages') {
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const ensureConversation = vi.fn(async () => 'conv-1')
    const getConversationId = vi.fn(() => null)
    const registerRoute = vi.fn()

    const transport = new AirlineChatTransport({
      ensureConversation,
      getConversationId,
      registerRoute,
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'test',
      messageId: undefined,
      messages: [makeUserMessage('test query')],
      abortSignal: undefined,
    })

    const chunks = await collectChunks(stream)
    expect(chunks.length).toBeGreaterThan(0)

    // Verify ensureConversation was called
    expect(ensureConversation).toHaveBeenCalled()

    // Verify POST to messages endpoint
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/conversations/conv-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test query' }),
      }),
    )
  })

  it('sendMessages: extracts text from last user message', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve(
          new Response(JSON.stringify({ conversationId: 'conv-2' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return Promise.resolve(
        new Response(sseBody([JSON.stringify({ type: 'done' })]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const transport = new AirlineChatTransport({
      ensureConversation: async () => 'conv-2',
      getConversationId: () => 'conv-2',
    })

    await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'test',
      messageId: undefined,
      messages: [
        makeUserMessage('first message'),
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'reply' }],
        },
        makeUserMessage('actual query'),
      ],
      abortSignal: undefined,
    })

    // Should extract text from the LAST user message
    const messagesCall = fetchMock.mock.calls.find(
      ([url]: [string]) => url === '/api/conversations/conv-2/messages',
    )
    expect(messagesCall).toBeDefined()
    expect(JSON.parse((messagesCall![1] as RequestInit).body as string)).toEqual({
      text: 'actual query',
    })
  })

  it('sendMessages: throws on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-3' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(new Response('server error', { status: 500 }))
      }),
    )

    const transport = new AirlineChatTransport({
      ensureConversation: async () => 'conv-3',
      getConversationId: () => 'conv-3',
    })

    await expect(
      transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'test',
        messageId: undefined,
        messages: [makeUserMessage('test')],
        abortSignal: undefined,
      }),
    ).rejects.toThrow('Chat request failed (500)')
  })

  it('sendMessages: registers route when route_generated arrives', async () => {
    const routeData = {
      routeId: 'route-1',
      content: {
        name: 'test',
        aircraft_model: 'M350',
        takeoff: { lat: 22.5, lng: 113.9, altitude: 0 },
        waypoints: [],
        global_height: 120,
        global_speed: 15,
        finish_action: 'goHome',
        rth_altitude: 100,
        takeoff_security_height: 50,
        exit_on_rc_lost: 'goContinue',
        altitude_mode: 'relativeToStartPoint',
      },
      intent: { action: 'explore', region: 'SZ' },
      aiGenerated: true,
    }
    const sseEvents = [
      JSON.stringify({
        type: 'route_generated',
        routeId: routeData.routeId,
        content: routeData.content,
        intent: routeData.intent,
        aiGenerated: routeData.aiGenerated,
      }),
      JSON.stringify({ type: 'done' }),
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-4' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(
          new Response(sseBody(sseEvents), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }),
    )

    const registerRoute = vi.fn()
    const transport = new AirlineChatTransport({
      ensureConversation: async () => 'conv-4',
      getConversationId: () => 'conv-4',
      registerRoute,
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'test',
      messageId: undefined,
      messages: [makeUserMessage('generate route')],
      abortSignal: undefined,
    })

    // Consume the stream to trigger onRoute callback
    await collectChunks(stream)

    expect(registerRoute).toHaveBeenCalledWith('route-1', 'conv-4')
  })

  it('sendMessages: abortSignal is passed through to fetch', async () => {
    let resolveFetch: (v: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    vi.stubGlobal('fetch', vi.fn(() => fetchPromise))

    const controller = new AbortController()

    const transport = new AirlineChatTransport({
      ensureConversation: async () => 'conv-5',
      getConversationId: () => 'conv-5',
    })

    // Start the send (don't await yet)
    const sendPromise = transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'test',
      messageId: undefined,
      messages: [makeUserMessage('test')],
      abortSignal: controller.signal,
    })

    // Abort before fetch resolves
    controller.abort()

    // Resolve fetch to avoid hanging
    resolveFetch!(new Response(sseBody([]), { status: 200 }))

    // Should not throw (abort is handled by fetch, not transport)
    const stream = await sendPromise
    expect(stream).toBeDefined()
  })

  it('reconnectToStream returns null', async () => {
    const transport = new AirlineChatTransport({
      ensureConversation: async () => 'conv',
      getConversationId: () => 'conv',
    })

    const result = await transport.reconnectToStream({
      chatId: 'test',
    })
    expect(result).toBeNull()
  })
})
