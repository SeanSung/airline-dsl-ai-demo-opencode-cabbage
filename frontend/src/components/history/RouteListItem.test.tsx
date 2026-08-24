import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RouteListItem, STATUS_LABEL } from './RouteListItem'
import type { RouteSummary, SubmitStatus } from './HistoryPanel'

function makeRoute(overrides: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: 'r1',
    name: '巡检航线',
    aiGenerated: true,
    status: 'validated',
    waypointCount: 3,
    createdAt: '2026-08-01',
    ...overrides,
  }
}

const idle: SubmitStatus = { state: 'idle' }

describe('RouteListItem 状态徽章', () => {
  it('draft 渲染“草稿”且使用 muted 徽章', () => {
    render(
      <RouteListItem
        route={makeRoute({ status: 'draft' })}
        submit={idle}
        onResume={vi.fn()}
        onResubmit={vi.fn()}
      />,
    )
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent(STATUS_LABEL.draft)
    expect(badge.className).toContain('bg-muted')
    expect(badge.className).toContain('text-muted-foreground')
  })

  it('validated 渲染“已验证”且使用 success 徽章', () => {
    render(
      <RouteListItem
        route={makeRoute({ status: 'validated' })}
        submit={idle}
        onResume={vi.fn()}
        onResubmit={vi.fn()}
      />,
    )
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent(STATUS_LABEL.validated)
    expect(badge.className).toContain('bg-success')
    expect(badge.className).toContain('text-success-foreground')
  })

  it('failed 渲染“失败”且使用 destructive 徽章', () => {
    render(
      <RouteListItem
        route={makeRoute({ status: 'failed' })}
        submit={idle}
        onResume={vi.fn()}
        onResubmit={vi.fn()}
      />,
    )
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent(STATUS_LABEL.failed)
    expect(badge.className).toContain('bg-destructive')
    expect(badge.className).toContain('text-destructive-foreground')
  })
})

describe('RouteListItem 交互', () => {
  it('续编按钮透传 routeId/conversationId', () => {
    const onResume = vi.fn()
    render(
      <RouteListItem
        route={makeRoute({ conversationId: 'c42' })}
        submit={idle}
        onResume={onResume}
        onResubmit={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('resume-btn'))
    expect(onResume).toHaveBeenCalledWith('r1', 'c42')
  })

  it('重提按钮 loading 时禁用，ok 态显示 gbhRouteId', () => {
    const onResubmit = vi.fn()
    const { rerender } = render(
      <RouteListItem
        route={makeRoute()}
        submit={{ state: 'loading' }}
        onResume={vi.fn()}
        onResubmit={onResubmit}
      />,
    )
    const btn = screen.getByTestId('resubmit-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    rerender(
      <RouteListItem
        route={makeRoute()}
        submit={{ state: 'ok', gbhRouteId: 'gbh_77' }}
        onResume={vi.fn()}
        onResubmit={onResubmit}
      />,
    )
    expect(screen.getByTestId('resubmit-status')).toHaveTextContent('gbh_77')
  })
})
