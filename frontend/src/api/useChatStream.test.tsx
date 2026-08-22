import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useReducer } from 'react'
import type { AgentEvent, AirlineContent } from '@airline-dsl/shared'
import { chatReducer, createChatState } from '../state/chatReducer'
import { useChatStream } from './useChatStream'

function makeContent(): AirlineContent {
  return {
    name: '巡检航线',
    aircraft_model: 'M350',
    takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
    waypoints: [
      {
        lat: 22.531635,
        lng: 113.935066,
        altitude: 120,
        speed: 15,
        heading_mode: 'fixed',
        heading_angle: 0,
        turn_mode: 'clockwise',
        actions: [{ action_type: 'takePhoto', action_params: { payload_lens_index: 'wide' } }],
      },
    ],
    global_height: 120,
    global_speed: 15,
    finish_action: 'goHome',
    rth_altitude: 100,
    takeoff_security_height: 50,
    exit_on_rc_lost: 'goContinue',
    altitude_mode: 'relativeToStartPoint',
  }
}

function sseBody(events: AgentEvent[]): BodyInit {
  const encoder = new TextEncoder()
  const lines = events.map((e) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(line)
      controller.close()
    },
  })
}

function makeIntent() {
  return {
    region: '沧海校区',
    shape: 'orbit' as const,
    center: { lat: 22.531635, lng: 113.935066 },
    radiusM: 200,
    count: 8,
    heightM: 120,
    speedMps: 15,
    actions: [] as { type: 'takePhoto'; seconds?: number; payloadLensIndex?: string }[],
  }
}

function stubFetch(events: AgentEvent[]) {
  const fn = vi.fn((url: string) => {
    if (url === '/api/conversations') {
      return Promise.resolve(new Response(JSON.stringify({ conversationId: 'c1' }), { status: 201 }))
    }
    if (url === '/api/conversations/c1/messages') {
      return Promise.resolve(new Response(sseBody(events), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    }
    return Promise.reject(new Error('unexpected url: ' + url))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function Runtime() {
  const [state, dispatch] = useReducer(chatReducer, undefined, createChatState)
  const { send } = useChatStream(dispatch)
  return (
    <div>
      <button onClick={() => void send('环绕沧海校区一圈')}>send</button>
      <span data-testid="msgs">{state.messages.map((m) => `${m.role}:${m.text}`).join('|')}</span>
      <span data-testid="route">{state.route ? `${state.route.aiGenerated}:${state.route.content.name}` : 'none'}</span>
      <span data-testid="errorBar">{state.errorBar ?? ''}</span>
    </div>
  )
}

describe('useChatStream', () => {
  it('POST 后按 data: 行解析 SSE，text_delta 增量追加到助手气泡', async () => {
    const fn = stubFetch([
      { type: 'text_delta', text: '正在' },
      { type: 'text_delta', text: '生成航线' },
      { type: 'done' },
    ])
    render(<Runtime />)
    fireEvent.click(screen.getByText('send'))
    await waitFor(() => expect(screen.getByTestId('msgs').textContent).toContain('正在生成航线'))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('route_generated 更新路由状态并携带 aiGenerated', async () => {
    stubFetch([
      { type: 'route_generated', routeId: 'r1', content: makeContent(), intent: makeIntent(), aiGenerated: false },
      { type: 'done' },
    ])
    render(<Runtime />)
    fireEvent.click(screen.getByText('send'))
    await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('false:巡检航线'))
  })

  it('error 事件进入错误状态', async () => {
    stubFetch([{ type: 'error', code: 'height_too_high', message: '高度 700m 超出上限 500m' }])
    render(<Runtime />)
    fireEvent.click(screen.getByText('send'))
    await waitFor(() => expect(screen.getByTestId('errorBar').textContent).toContain('高度 700m 超出上限 500m'))
  })
})
