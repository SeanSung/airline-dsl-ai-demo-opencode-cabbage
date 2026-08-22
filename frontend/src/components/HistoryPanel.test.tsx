import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AirlineContent } from '@airline-dsl/shared'
import { ChatProvider, useChat } from '../state/chatReducer'
import { useChatStream, registerConversationRoute, conversationForRoute } from '../api/useChatStream'
import { HistoryPanel, type SubmitStatus, type RouteSummary } from './HistoryPanel'

function makeContent(name: string): AirlineContent {
  return {
    name,
    aircraft_model: 'M350',
    takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
    waypoints: [{ lat: 22.531635, lng: 113.935066, altitude: 120, speed: 15, heading_mode: 'fixed', heading_angle: 0, turn_mode: 'clockwise', actions: [] }],
    global_height: 120,
    global_speed: 15,
    finish_action: 'goHome',
    rth_altitude: 100,
    takeoff_security_height: 50,
    exit_on_rc_lost: 'goContinue',
    altitude_mode: 'relativeToStartPoint',
  }
}

function makeSummary(overrides: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: 'r1',
    name: '巡检航线',
    aiGenerated: true,
    status: 'validated',
    createdAt: '2026-08-01',
    waypointCount: 3,
    ...overrides,
  }
}

const fakeResubmit = async (_routeId: string, _setStatus: (s: SubmitStatus) => void) => {}

function Harness() {
  const { state, dispatch } = useChat()
  const { loadConversation } = useChatStream(dispatch)
  const onResume = async (routeId: string, conversationId?: string) => {
    const cid = conversationId ?? conversationForRoute(routeId)
    if (cid) await loadConversation(cid, routeId)
  }
  return (
    <div>
      <HistoryPanel onResume={onResume} onResubmit={fakeResubmit} />
      <span data-testid="msgs">{state.messages.map((m) => `${m.role}:${m.text}`).join('|')}</span>
      <span data-testid="route">{state.route ? state.route.content.name : 'none'}</span>
    </div>
  )
}

function renderHarness(fetchImpl: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <ChatProvider>
      <Harness />
    </ChatProvider>,
  )
}

function routesFetch(list: RouteSummary[]) {
  return vi.fn((url: string) => {
    if (url === '/api/routes') return Promise.resolve(new Response(JSON.stringify(list), { status: 200 }))
    return Promise.reject(new Error('unexpected url: ' + url))
  })
}

describe('HistoryPanel', () => {
  it('列表渲染：展示名称、状态徽标、非 AI 标注、航点数与创建时间', async () => {
    const fetchFn = routesFetch([
      makeSummary({ aiGenerated: false, status: 'draft', waypointCount: 5 }),
      makeSummary({ id: 'r2', name: '第二航线', status: 'validated' }),
    ])
    renderHarness(fetchFn)
    fireEvent.click(screen.getByTestId('history-toggle'))
    await waitFor(() => expect(screen.getAllByTestId('history-item').length).toBe(2))
    expect(screen.getByText('巡检航线')).toBeInTheDocument()
    expect(screen.getByText('5 航点 · 2026-08-01')).toBeInTheDocument()
    expect(screen.getByText('草稿')).toBeInTheDocument()
    expect(screen.getAllByTestId('not-ai-badge').length).toBe(1)
  })

  it('续编加载后 conversation 与 currentRoute 两 slice 同步回填，且可继续发送', async () => {
    const fetchFn = vi.fn((url: string) => {
      if (url === '/api/routes') return Promise.resolve(new Response(JSON.stringify([makeSummary({ conversationId: 'c1' })]), { status: 200 }))
      if (url === '/api/conversations/c1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'c1',
              routeId: 'r1',
              messages: [
                { role: 'user', content: '环绕沧海校区一圈' },
                { role: 'assistant', content: '正在生成航线' },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      if (url === '/api/routes/r1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              content: makeContent('历史航线A'),
              intent: {},
              aiGenerated: true,
              status: 'validated',
            }),
            { status: 200 },
          ),
        )
      }
      return Promise.reject(new Error('unexpected url: ' + url))
    })
    renderHarness(fetchFn)
    fireEvent.click(screen.getByTestId('history-toggle'))
    await waitFor(() => expect(screen.getByTestId('resume-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('resume-btn'))
    await waitFor(() => expect(screen.getByTestId('msgs').textContent).toContain('user:环绕沧海校区一圈'))
    expect(screen.getByTestId('msgs').textContent).toContain('assistant:正在生成航线')
    expect(screen.getByTestId('route').textContent).toBe('历史航线A')
  })

  it('再次提交 GBH：点击显示提交中，完成后显示验证通过', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/routes') return Promise.resolve(new Response(JSON.stringify([makeSummary()]), { status: 200 }))
        if (url === '/api/routes/r1/submit-gbh') {
          return Promise.resolve(new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_9' }), { status: 200 }))
        }
        return Promise.reject(new Error('unexpected url: ' + url))
      }),
    )
    const resubmit = async (_id: string, setStatus: (s: SubmitStatus) => void) => {
      setStatus({ state: 'loading' })
      const res = await fetch('/api/routes/r1/submit-gbh', { method: 'POST' })
      const data = (await res.json()) as { status: 'ok'; gbhRouteId: string }
      setStatus({ state: 'ok', gbhRouteId: data.gbhRouteId })
    }
    render(
      <HistoryPanel
        onResume={async () => {}}
        onResubmit={resubmit}
      />,
    )
    fireEvent.click(screen.getByTestId('history-toggle'))
    await waitFor(() => expect(screen.getByTestId('resubmit-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('resubmit-btn'))
    await waitFor(() => expect(screen.getByTestId('resubmit-status')).toHaveTextContent('验证通过'))
    expect(screen.getByTestId('resubmit-status')).toHaveTextContent('gbh_9')
  })

  it('再次提交失败态透传错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/routes') return Promise.resolve(new Response(JSON.stringify([makeSummary()]), { status: 200 }))
        if (url === '/api/routes/r1/submit-gbh') {
          return Promise.resolve(new Response(JSON.stringify({ status: 'error', message: '平台校验失败' }), { status: 200 }))
        }
        return Promise.reject(new Error('unexpected url: ' + url))
      }),
    )
    const resubmit = async (_id: string, setStatus: (s: SubmitStatus) => void) => {
      const res = await fetch('/api/routes/r1/submit-gbh', { method: 'POST' })
      const data = (await res.json()) as { status: 'error'; message: string }
      setStatus({ state: 'error', message: data.message })
    }
    render(
      <HistoryPanel
        onResume={async () => {}}
        onResubmit={resubmit}
      />,
    )
    fireEvent.click(screen.getByTestId('history-toggle'))
    await waitFor(() => expect(screen.getByTestId('resubmit-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('resubmit-btn'))
    await waitFor(() => expect(screen.getByTestId('resubmit-status')).toHaveTextContent('平台校验失败'))
  })
})
