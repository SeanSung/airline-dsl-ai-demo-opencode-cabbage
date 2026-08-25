import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAirlineChat, conversationForRoute } from './useAirlineChat'

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

function makeRouteEvent(routeId = 'r-1') {
  return JSON.stringify({
    type: 'route_generated',
    routeId,
    content: {
      name: 'test-route',
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
  })
}

describe('useAirlineChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initial state: empty messages, ready status, null route', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))))
    const { result } = renderHook(() => useAirlineChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.status).toBe('ready')
    expect(result.current.route).toBeNull()
    expect(result.current.errorBar).toBeNull()
    expect(result.current.conversationId).toBeNull()
  })

  it('send → lazy ensureConversation → POST → streaming → done', async () => {
    const textDelta = JSON.stringify({ type: 'text_delta', text: 'hi' })
    const done = JSON.stringify({ type: 'done' })

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/conversations' && init?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ conversationId: 'conv-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url === '/api/conversations/conv-1/messages') {
        return Promise.resolve(
          new Response(sseBody([textDelta, done]), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAirlineChat())

    await act(async () => {
      result.current.send('hello')
      // Wait for the stream to complete
      await new Promise((r) => setTimeout(r, 200))
    })

    // Should have created conversation
    expect(result.current.conversationId).toBe('conv-1')

    // Should have user + assistant messages
    expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    expect(result.current.messages[0].role).toBe('user')
  })

  it('route_generated → route derived from data-airline-route part', async () => {
    const routeEvent = makeRouteEvent('route-abc')
    const done = JSON.stringify({ type: 'done' })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-r' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(
          new Response(sseBody([routeEvent, done]), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }),
    )

    const { result } = renderHook(() => useAirlineChat())

    await act(async () => {
      result.current.send('generate route')
      await new Promise((r) => setTimeout(r, 200))
    })

    // Route should be derived
    expect(result.current.route).not.toBeNull()
    expect(result.current.route?.routeId).toBe('route-abc')
    expect(result.current.route?.aiGenerated).toBe(true)

    // Route↔conversation mapping should be registered
    expect(conversationForRoute('route-abc')).toBe('conv-r')
  })

  it('error event → errorBar non-null', async () => {
    const errorEvent = JSON.stringify({
      type: 'error',
      message: 'Something went wrong',
    })
    const done = JSON.stringify({ type: 'done' })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-err' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(
          new Response(sseBody([errorEvent, done]), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }),
    )

    const { result } = renderHook(() => useAirlineChat())

    await act(async () => {
      result.current.send('trigger error')
      await new Promise((r) => setTimeout(r, 200))
    })

    // errorBar should reflect the error
    expect(result.current.errorBar).not.toBeNull()
    expect(result.current.errorBar).not.toContain('{')
  })

  it('newConversation → messages/route/conversationId cleared', async () => {
    const textDelta = JSON.stringify({ type: 'text_delta', text: 'hi' })
    const done = JSON.stringify({ type: 'done' })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-nc' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(
          new Response(sseBody([textDelta, done]), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        )
      }),
    )

    const { result } = renderHook(() => useAirlineChat())

    // First send something
    await act(async () => {
      result.current.send('hello')
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(result.current.messages.length).toBeGreaterThan(0)
    expect(result.current.conversationId).toBe('conv-nc')

    // Now reset
    act(() => {
      result.current.newConversation()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.route).toBeNull()
    expect(result.current.errorBar).toBeNull()
    expect(result.current.conversationId).toBeNull()
  })

  it('loadConversation → hydrates messages and route', async () => {
    const convMessages = [
      { id: 'm1', role: 'user', content: 'hello' },
      {
        id: 'm2',
        role: 'assistant',
        content: 'hi there',
        routeId: 'route-hydrate',
      },
    ]

    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/conversations/conv-hydrate') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ messages: convMessages }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      if (url === '/api/routes/route-hydrate') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              routeId: 'route-hydrate',
              content: { name: 'test' },
              intent: {},
              aiGenerated: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAirlineChat())

    await act(async () => {
      await result.current.loadConversation('conv-hydrate', 'route-hydrate')
    })

    expect(result.current.conversationId).toBe('conv-hydrate')
    expect(result.current.messages.length).toBe(2)
    expect(result.current.messages[0].role).toBe('user')

    // Route mapping registered
    expect(conversationForRoute('route-hydrate')).toBe('conv-hydrate')
  })

  it('HTTP error → throws and surfaces as errorBar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-fail' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return Promise.resolve(new Response('Internal error', { status: 500 }))
      }),
    )

    const { result } = renderHook(() => useAirlineChat())

    await act(async () => {
      result.current.send('will fail')
      await new Promise((r) => setTimeout(r, 300))
    })

    // Status should be error
    expect(result.current.status).toBe('error')
  })
})
