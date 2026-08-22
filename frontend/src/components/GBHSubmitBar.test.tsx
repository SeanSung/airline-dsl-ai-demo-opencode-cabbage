import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AirlineContent } from '@airline-dsl/shared'
import type { RouteData } from '../state/chatReducer'
import { GBHSubmitBar } from './GBHSubmitBar'

function makeRoute(routeId = 'r1'): RouteData {
  return {
    routeId,
    aiGenerated: true,
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

describe('GBHSubmitBar', () => {
  it('提交中显示 loading 文案，完成后显示验证通过', async () => {
    let resolvePromise: (r: Response) => void = () => {}
    const fetchFn = vi.fn(() => new Promise<Response>((resolve) => { resolvePromise = resolve }))
    vi.stubGlobal('fetch', fetchFn)
    render(<GBHSubmitBar route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    expect(screen.getByText('正在提交模拟飞行…')).toBeInTheDocument()
    resolvePromise(new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_abc' }), { status: 200 }))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('验证通过'))
    expect(screen.getByText(/gbh_abc/)).toBeInTheDocument()
  })

  it('成功态显示验证通过与平台 routeId', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', gbhRouteId: 'gbh_1' }), { status: 200 }))))
    render(<GBHSubmitBar route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('验证通过'))
    expect(screen.getByTestId('gbh-status')).toHaveTextContent('gbh_1')
  })

  it('失败态透传平台错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'error', message: '平台校验失败：高度超限' }), { status: 200 }))))
    render(<GBHSubmitBar route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('平台校验失败：高度超限'))
  })

  it('invalid 态透传错误数组', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'invalid', errors: [{ path: 'waypoints.0', message: '非法' }] }), { status: 200 }))))
    render(<GBHSubmitBar route={makeRoute()} />)
    fireEvent.click(screen.getByTestId('gbh-submit'))
    await waitFor(() => expect(screen.getByTestId('gbh-status')).toHaveTextContent('非法'))
  })
})
