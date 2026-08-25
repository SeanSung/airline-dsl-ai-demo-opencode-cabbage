import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentEvent, AirlineContent, Intent } from '@airline-dsl/shared'
import {
  agentEventToChunks,
  sseResponseToChunkStream,
  type AirlineUIMessageChunk,
} from './agent-event-stream'

// Helper to collect all chunks from a ReadableStream
async function collectChunks(
  stream: ReadableStream<AirlineUIMessageChunk>,
): Promise<AirlineUIMessageChunk[]> {
  const chunks: AirlineUIMessageChunk[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return chunks
}

// Helper to encode SSE text into a ReadableStream<Uint8Array>
function sseBody(...events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((e) => encoder.encode(e))
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

// Fixtures
const mockContent: AirlineContent = {
  name: 'test',
  aircraft_model: 'M350',
  takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
  waypoints: [],
  global_height: 120,
  global_speed: 15,
  finish_action: 'goHome',
  rth_altitude: 100,
  takeoff_security_height: 50,
  exit_on_rc_lost: 'goContinue',
  altitude_mode: 'relativeToStartPoint',
}

const mockIntent: Intent = {
  region: '沧海校区',
  shape: 'orbit',
  center: { lat: 22.531635, lng: 113.935066 },
  radiusM: 300,
  heightM: 120,
  speedMps: 15,
  actions: [],
}

describe('agentEventToChunks', () => {
  beforeEach(() => {
    // Mock crypto.randomUUID for deterministic tests
    let counter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `test-id-${++counter}-0000-0000`)
  })

  it('text_delta → text-start + text-delta + text-end sequence', () => {
    const ev: AgentEvent = { type: 'text_delta', text: 'hello' }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toEqual({ type: 'text-start', id: 'test-id-1-0000-0000' })
    expect(chunks[1]).toEqual({ type: 'text-delta', delta: 'hello', id: 'test-id-1-0000-0000' })
    expect(chunks[2]).toEqual({ type: 'text-end', id: 'test-id-1-0000-0000' })

    // All three share the same id
    expect(chunks[0].type === 'text-start' && chunks[0].id).toBe(
      chunks[1].type === 'text-delta' && chunks[1].id,
    )
  })

  it('route_generated → data-airline-route data chunk', () => {
    const ev: AgentEvent = {
      type: 'route_generated',
      routeId: 'route-123',
      content: mockContent,
      intent: mockIntent,
      aiGenerated: true,
    }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      type: 'data-airline-route',
      data: {
        routeId: 'route-123',
        content: mockContent,
        intent: mockIntent,
        aiGenerated: true,
      },
    })
  })

  it('error → error chunk with message as errorText', () => {
    const ev: AgentEvent = {
      type: 'error',
      code: 'INTERNAL_ERROR',
      message: '后端服务暂时不可用，请稍后重试',
    }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      type: 'error',
      errorText: '后端服务暂时不可用，请稍后重试',
    })
  })

  it('clarification → data-airline-clarification + text segment', () => {
    const ev: AgentEvent = {
      type: 'clarification',
      missing: ['目的地', '巡航高度'],
      text: '请提供目的地和巡航高度',
    }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(4)
    // Data chunk
    expect(chunks[0]).toEqual({
      type: 'data-airline-clarification',
      data: { missing: ['目的地', '巡航高度'] },
    })
    // Text segment
    expect(chunks[1]).toEqual({ type: 'text-start', id: 'test-id-1-0000-0000' })
    expect(chunks[2]).toEqual({
      type: 'text-delta',
      delta: '请提供目的地和巡航高度',
      id: 'test-id-1-0000-0000',
    })
    expect(chunks[3]).toEqual({ type: 'text-end', id: 'test-id-1-0000-0000' })
  })

  it('clarification without text → generates default text from missing fields', () => {
    const ev: AgentEvent = {
      type: 'clarification',
      missing: ['目的地'],
    }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toEqual({
      type: 'data-airline-clarification',
      data: { missing: ['目的地'] },
    })
    expect(chunks[2]).toEqual({
      type: 'text-delta',
      delta: '待补充参数：目的地',
      id: 'test-id-1-0000-0000',
    })
  })

  it('done → finish chunk', () => {
    const ev: AgentEvent = {
      type: 'done',
      usage: { inputTokens: 100, outputTokens: 50 },
    }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      type: 'finish',
      finishReason: 'stop',
    })
  })

  it('done without usage → finish chunk', () => {
    const ev: AgentEvent = { type: 'done' }
    const chunks = agentEventToChunks(ev)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      type: 'finish',
      finishReason: 'stop',
    })
  })
})

describe('sseResponseToChunkStream', () => {
  beforeEach(() => {
    let counter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `sse-id-${++counter}-0000-0000`)
  })

  it('parses single SSE event into chunks', async () => {
    const sseText = `data: ${JSON.stringify({ type: 'text_delta', text: 'hi' })}\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    expect(chunks).toHaveLength(3)
    expect(chunks[0].type).toBe('text-start')
    expect(chunks[1].type).toBe('text-delta')
    expect(chunks[2].type).toBe('text-end')
  })

  it('parses multiple SSE events in sequence', async () => {
    const ev1: AgentEvent = { type: 'text_delta', text: 'hello' }
    const ev2: AgentEvent = { type: 'text_delta', text: ' world' }
    const sseText = `data: ${JSON.stringify(ev1)}\n\ndata: ${JSON.stringify(ev2)}\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    // 3 chunks per text_delta event
    expect(chunks).toHaveLength(6)
    expect(chunks[0].type).toBe('text-start')
    expect(chunks[3].type).toBe('text-start')
  })

  it('handles route_generated and calls onRoute callback', async () => {
    const ev: AgentEvent = {
      type: 'route_generated',
      routeId: 'r-1',
      content: mockContent,
      intent: mockIntent,
      aiGenerated: true,
    }
    const sseText = `data: ${JSON.stringify(ev)}\n\n`
    const stream = sseBody(sseText)
    const onRoute = vi.fn()
    const chunks = await collectChunks(
      sseResponseToChunkStream(stream, { onRoute }),
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0].type).toBe('data-airline-route')
    expect(onRoute).toHaveBeenCalledWith({
      routeId: 'r-1',
      content: mockContent,
      intent: mockIntent,
      aiGenerated: true,
    })
  })

  it('handles error event → error chunk', async () => {
    const ev: AgentEvent = {
      type: 'error',
      code: 'TIMEOUT',
      message: '请求超时',
    }
    const sseText = `data: ${JSON.stringify(ev)}\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({ type: 'error', errorText: '请求超时' })
  })

  it('handles done event → finish chunk', async () => {
    const ev: AgentEvent = { type: 'done' }
    const sseText = `data: ${JSON.stringify(ev)}\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({ type: 'finish', finishReason: 'stop' })
  })

  it('handles buffered/partial SSE chunks', async () => {
    const ev: AgentEvent = { type: 'text_delta', text: 'partial' }
    const fullJson = JSON.stringify(ev)
    const sseFull = `data: ${fullJson}\n\n`

    // Split the SSE text in the middle to simulate partial reads
    const mid = Math.floor(sseFull.length / 2)
    const encoder = new TextEncoder()
    const chunk1 = encoder.encode(sseFull.slice(0, mid))
    const chunk2 = encoder.encode(sseFull.slice(mid))

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      },
    })

    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    expect(chunks).toHaveLength(3)
    expect(chunks[0].type).toBe('text-start')
    expect(chunks[1].type).toBe('text-delta')
  })

  it('skips empty lines and non-data lines', async () => {
    const ev: AgentEvent = { type: 'text_delta', text: 'ok' }
    // SSE with comment line and extra empty lines
    const sseText = `: this is a comment\n\ndata: ${JSON.stringify(ev)}\n\n\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    expect(chunks).toHaveLength(3)
  })

  it('handles multi-line data (data: on consecutive lines)', async () => {
    // SSE spec allows multi-line data with multiple data: fields joined by \n
    const sseText = `data: {"type":"text_delta",\ndata: "text":"hello"}\n\n`
    const stream = sseBody(sseText)
    const chunks = await collectChunks(sseResponseToChunkStream(stream))

    // Should parse as {"type":"text_delta","text":"hello"} (joined with \n)
    expect(chunks).toHaveLength(3)
    expect(chunks[1].type).toBe('text-delta')
    if (chunks[1].type === 'text-delta') {
      expect(chunks[1].delta).toBe('hello')
    }
  })

  it('empty body returns closed stream', async () => {
    const chunks = await collectChunks(sseResponseToChunkStream(null))
    expect(chunks).toHaveLength(0)
  })

  it('abort signal stops the stream', async () => {
    // Create a stream that never closes
    const encoder = new TextEncoder()
    const ev: AgentEvent = { type: 'text_delta', text: 'hello' }
    const sseText = `data: ${JSON.stringify(ev)}\n\n`

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(sseText))
        // Keep the stream open indefinitely
        await new Promise(() => {})
      },
    })

    const controller = new AbortController()
    // Abort immediately
    controller.abort()

    const chunks = await collectChunks(
      sseResponseToChunkStream(stream, { signal: controller.signal }),
    )

    // Should get no chunks because the signal was already aborted
    expect(chunks).toHaveLength(0)
  })

  it('complete conversation flow: text + route + done', async () => {
    const textEv: AgentEvent = { type: 'text_delta', text: '为您生成航线：' }
    const routeEv: AgentEvent = {
      type: 'route_generated',
      routeId: 'r-flow',
      content: mockContent,
      intent: mockIntent,
      aiGenerated: true,
    }
    const doneEv: AgentEvent = { type: 'done' }

    const sseText =
      `data: ${JSON.stringify(textEv)}\n\n` +
      `data: ${JSON.stringify(routeEv)}\n\n` +
      `data: ${JSON.stringify(doneEv)}\n\n`

    const stream = sseBody(sseText)
    const onRoute = vi.fn()
    const chunks = await collectChunks(
      sseResponseToChunkStream(stream, { onRoute }),
    )

    // text-start, text-delta, text-end, data-airline-route, finish
    expect(chunks).toHaveLength(5)
    expect(chunks[0].type).toBe('text-start')
    expect(chunks[1].type).toBe('text-delta')
    expect(chunks[2].type).toBe('text-end')
    expect(chunks[3].type).toBe('data-airline-route')
    expect(chunks[4].type).toBe('finish')
    expect(onRoute).toHaveBeenCalledTimes(1)
  })
})
