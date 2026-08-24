import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { AirlineContent } from '@airline-dsl/shared'
import type { RouteData } from '../../state/chatReducer'
import { RouteCard } from './RouteCard'

function makeContent(): AirlineContent {
  return {
    name: '巡检航线',
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
}

function makeRoute(overrides: Partial<RouteData> = {}): RouteData {
  return {
    routeId: 'r1',
    content: makeContent(),
    intent: {
      region: '沧海校区',
      shape: 'orbit',
      center: { lat: 22.531635, lng: 113.935066 },
      radiusM: 200,
      count: 8,
      heightM: 120,
      speedMps: 15,
      actions: [{ type: 'takePhoto' }],
    },
    aiGenerated: true,
    ...overrides,
  }
}

describe('RouteCard', () => {
  it('aiGenerated=false 时渲染“非 AI 生成”降级徽章', () => {
    render(<RouteCard route={makeRoute({ aiGenerated: false })} />)
    const badge = screen.getByTestId('not-ai-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('非 AI 生成')
  })

  it('aiGenerated=true 时不渲染降级徽章', () => {
    render(<RouteCard route={makeRoute({ aiGenerated: true })} />)
    expect(screen.queryByTestId('not-ai-badge')).not.toBeInTheDocument()
  })

  it('点击“解析详情”折叠/展开 intent JSON', () => {
    render(<RouteCard route={makeRoute()} />)
    expect(screen.queryByTestId('intent-json')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('解析详情'))
    const pre = screen.getByTestId('intent-json')
    expect(pre).toBeInTheDocument()
    expect(pre.textContent).toContain('沧海校区')
  })

  it('展示航线名与 meta 信息', () => {
    render(<RouteCard route={makeRoute()} />)
    expect(screen.getByText('巡检航线')).toBeInTheDocument()
    expect(screen.getByText(/半径 200m/)).toBeInTheDocument()
    expect(screen.getByText(/高度 120m/)).toBeInTheDocument()
    expect(screen.getByText(/动作 takePhoto/)).toBeInTheDocument()
  })
})
