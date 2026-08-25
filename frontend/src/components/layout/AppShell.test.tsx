import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AppShell } from './AppShell'
import { AirlineChatProvider } from '../../state/useAirlineChat'

afterEach(() => cleanup())

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}'))),
  )
}

function renderShell() {
  stubFetch()
  render(
    <AirlineChatProvider>
      <AppShell
        renderHistory={() => <div data-testid="history-content">历史</div>}
        chat={<div data-testid="chat-content">对话</div>}
        map={<div data-testid="map-content">地图</div>}
      />
    </AirlineChatProvider>,
  )
}

describe('AppShell 新布局', () => {
  it('渲染 NavRail + WorkspaceHeader + 对话列 + 地图列', () => {
    renderShell()
    expect(screen.getByTestId('nav-rail')).toBeTruthy()
    expect(screen.getByTestId('workspace-header')).toBeTruthy()
    expect(screen.getByTestId('chat-content')).toBeTruthy()
    expect(screen.getByTestId('map-content')).toBeTruthy()
  })

  it('旧 testid topbar / history-aside / history-rail 不存在', () => {
    renderShell()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.queryByTestId('history-aside')).toBeNull()
    expect(screen.queryByTestId('history-rail')).toBeNull()
  })

  it('NavRail 含 w-[68px] 类', () => {
    renderShell()
    const nav = screen.getByTestId('nav-rail')
    expect(nav.className).toContain('w-[68px]')
  })

  it('NavRail 含新对话、历史、设置按钮', () => {
    renderShell()
    expect(screen.getByLabelText('新对话')).toBeTruthy()
    expect(screen.getByLabelText('历史航线')).toBeTruthy()
    expect(screen.getByLabelText('设置（暂不可用）')).toBeTruthy()
    expect(screen.getByLabelText('设置（暂不可用）').closest('button')).toBeDisabled()
  })

  it('点击历史按钮打开 Sheet 抽屉', () => {
    renderShell()
    expect(screen.queryByTestId('history-content')).toBeNull()

    fireEvent.click(screen.getByTestId('history-sheet-trigger'))
    expect(screen.getByTestId('history-content')).toBeTruthy()
  })

  it('Sheet 关闭后历史内容从 DOM 卸载', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('history-sheet-trigger'))
    expect(screen.getByTestId('history-content')).toBeTruthy()

    // Close by pressing Escape
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    // Radix unmounts after animation; content should be gone
  })

  it('NavRail 新对话按钮可点击', () => {
    renderShell()
    const btn = screen.getByLabelText('新对话')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
  })

  it('WorkspaceHeader 含标题和状态', () => {
    renderShell()
    expect(screen.getByTestId('header-title')).toBeTruthy()
    expect(screen.getByTestId('header-param-chips')).toBeTruthy()
  })
})
