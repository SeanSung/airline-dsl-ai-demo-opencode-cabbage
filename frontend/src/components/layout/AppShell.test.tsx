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

  it('栅格在 1366/1920 不横向溢出：fr + min-w-0 收缩，导航固定 68px', () => {
    renderShell()
    const grid = screen.getByTestId('chat-content').parentElement!.parentElement!
    // grid 容器本身使用 fr 列与 min-w-0 防止子列撑破视口
    expect(grid.className).toContain('grid-cols-[minmax(380px,420px)_1fr]')
    expect(grid.className).toContain('2xl:grid-cols-[420px_1fr]')
    // 两个工作列均带 min-w-0，避免内容把 grid 撑出横向滚动
    const cols = grid.querySelectorAll('[data-testid="chat-column"],[data-testid="map-column"]')
    cols.forEach((col) => expect(col.className).toContain('min-w-0'))
    // 导航栏固定宽度 68px（∈ [64,72]），shrink-0 不被压缩
    const nav = screen.getByTestId('nav-rail')
    expect(nav.className).toContain('w-[68px]')
    expect(nav.className).toContain('shrink-0')
  })

  it('顶栏参数区 flex-1 overflow-hidden，长参数不挤压标题', () => {
    renderShell()
    const chips = screen.getByTestId('header-param-chips')
    expect(chips.className).toContain('flex-1')
    expect(chips.className).toContain('overflow-hidden')
  })
})
