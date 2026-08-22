import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AgentEvent, AirlineContent } from '@airline-dsl/shared'
import { ChatProvider } from '../state/chatReducer'
import { ChatPanel } from './ChatPanel'

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

function renderPanel(events: AgentEvent[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/conversations') {
        return Promise.resolve(new Response(JSON.stringify({ conversationId: 'c1' }), { status: 201 }))
      }
      if (url === '/api/conversations/c1/messages') {
        return Promise.resolve(new Response(sseBody(events), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      }
      return Promise.reject(new Error('unexpected url: ' + url))
    }),
  )
  return render(
    <ChatProvider>
      <ChatPanel />
    </ChatProvider>,
  )
}

describe('ChatPanel', () => {
  it('空态展示建议话术区（2-4 条），点击即发送', async () => {
    renderPanel([{ type: 'done' }])
    const suggestions = screen.getAllByTestId('suggestion')
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
    expect(suggestions.length).toBeLessThanOrEqual(4)
    fireEvent.click(suggestions[0])
    await waitFor(() => expect(screen.getAllByTestId('bubble-user').length).toBe(1))
  })

  it('事件流增量追加：text_delta 打字机流式出现', async () => {
    renderPanel([
      { type: 'text_delta', text: '正在' },
      { type: 'text_delta', text: '生成航线' },
      { type: 'done' },
    ])
    fireEvent.change(screen.getByPlaceholderText('输入需求…'), { target: { value: '环绕沧海一圈' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByTestId('bubble-assistant').textContent).toBe('正在生成航线'))
  })

  it('clarification 事件渲染"待补充参数"标签', async () => {
    renderPanel([{ type: 'clarification', missing: ['heightM'], text: '请指定飞行高度' }])
    fireEvent.change(screen.getByPlaceholderText('输入需求…'), { target: { value: '环绕沧海一圈' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByTestId('clarify-tag')).toHaveTextContent('待补充参数'))
  })

  it('route_generated 触发 RouteCard，aiGenerated:false 显示"非 AI 生成"', async () => {
    renderPanel([{ type: 'route_generated', routeId: 'r1', content: makeContent(), aiGenerated: false }, { type: 'done' }])
    fireEvent.change(screen.getByPlaceholderText('输入需求…'), { target: { value: '环绕沧海一圈' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByTestId('route-card')).toBeInTheDocument())
    expect(screen.getByTestId('not-ai-badge')).toHaveTextContent('非 AI 生成')
  })

  it('error 事件触发错误条', async () => {
    renderPanel([{ type: 'error', code: 'height_too_high', message: '高度 700m 超出上限 500m' }])
    fireEvent.change(screen.getByPlaceholderText('输入需求…'), { target: { value: '环绕沧海一圈' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByTestId('error-bar')).toHaveTextContent('高度 700m 超出上限 500m'))
  })

  it('新建会话重置消息与路由', async () => {
    renderPanel([
      { type: 'route_generated', routeId: 'r1', content: makeContent(), aiGenerated: true },
      { type: 'done' },
    ])
    fireEvent.change(screen.getByPlaceholderText('输入需求…'), { target: { value: '环绕沧海一圈' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByTestId('route-card')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建会话'))
    await waitFor(() => expect(screen.queryByTestId('route-card')).not.toBeInTheDocument())
    expect(screen.getAllByTestId('suggestion').length).toBeGreaterThanOrEqual(2)
  })
})
