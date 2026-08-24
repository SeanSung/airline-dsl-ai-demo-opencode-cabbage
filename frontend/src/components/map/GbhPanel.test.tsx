import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RouteData } from '../../state/chatReducer'
import { GbhPanel } from './GbhPanel'

function makeRoute(routeId = 'r1'): RouteData {
  return {
    routeId,
    aiGenerated: true,
    intent: {
      region: '沧海校区',
      shape: 'orbit',
      center: { lat: 22.531635, lng: 113.935066 },
      radiusM: 200,
      count: 8,
      heightM: 120,
      speedMps: 15,
      actions: [],
    },
    content: {
      name: '巡检航线',
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
    },
  }
}

describe('GbhPanel', () => {
  it('无 route 时提交按钮禁用', () => {
    render(<GbhPanel route={null} />)
    expect(screen.getByTestId('gbh-submit')).toBeDisabled()
    expect(screen.getByTestId('gbh-bar')).toBeInTheDocument()
  })

  it('面板含语义 h2「提交 GBH」', () => {
    render(<GbhPanel route={null} />)
    expect(screen.getByRole('heading', { level: 2, name: '提交 GBH' })).toBeInTheDocument()
  })

  it('提交中显示 loading 文案，完成后显示验证通过', async () => {
    let resolvePromise: (r: Response) => void = () => {}
    const fetchFn = vi.fn(() => new Promise<Response>((resolve) => { resolvePromise = resolve }))
    vi.stubGlobal('fetch', fetchFn)
    render(<GbhPanel route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    expect(screen.getByText('正在提交模拟飞行…')).toBeInTheDocument()
    resolvePromise(new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_abc' }), { status: 200 }))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('验证通过'))
    expect(screen.getByText(/gbh_abc/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('成功态显示验证通过与平台 routeId', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_1' }), { status: 200 }))))
    render(<GbhPanel route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('验证通过'))
    expect(screen.getByTestId('gbh-status')).toHaveTextContent('gbh_1')
    vi.unstubAllGlobals()
  })

  it('失败态透传平台错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'error', message: '平台校验失败：高度超限' }), { status: 200 }))))
    render(<GbhPanel route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('平台校验失败：高度超限'))
    vi.unstubAllGlobals()
  })

  it('invalid 态提取错误数组中的 message 且不泄露 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'invalid', errors: [{ path: 'waypoints.0', message: '非法' }] }), { status: 200 }))))
    render(<GbhPanel route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('非法'))
    const statusText = screen.getByTestId('gbh-status').textContent ?? ''
    expect(statusText).not.toContain('{')
    expect(statusText).not.toContain('"')
    vi.unstubAllGlobals()
  })

  it('切换 route 后重置提交状态，不误显上一条航线结果', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_old' }), { status: 200 }),
        ),
      ),
    )
    const { rerender } = render(<GbhPanel route={makeRoute('r1')} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('gbh_old'))

    // 切换到新航线：旧的成功态必须清空，按钮恢复可点
    rerender(<GbhPanel route={makeRoute('r2')} />)
    expect(screen.queryByTestId('gbh-status')).toBeNull()
    expect(screen.getByTestId('gbh-submit')).not.toBeDisabled()
    expect(screen.getByTestId('gbh-submit')).toHaveTextContent('一键提交 GBH')
    vi.unstubAllGlobals()
  })
})
