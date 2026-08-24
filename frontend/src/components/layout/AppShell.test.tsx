import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AppShell } from './AppShell'

afterEach(() => cleanup())

function setWide(matches: boolean) {
  // test-setup 提供的 matchMedia 总是 matches=false；这里按用例覆盖返回值。
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function renderShell() {
  const onNew = vi.fn()
  render(
    <AppShell
      onNewConversation={onNew}
      renderHistory={() => <div data-testid="history-content">历史</div>}
      chat={<div data-testid="chat-content">对话</div>}
      map={<div data-testid="map-content">地图</div>}
    />,
  )
  return onNew
}

describe('AppShell 三栏骨架', () => {
  it('渲染顶栏与三栏内容', () => {
    setWide(true)
    renderShell()
    expect(screen.getByTestId('topbar')).toBeTruthy()
    expect(screen.getByTestId('app-shell')).toBeTruthy()
    expect(screen.getByTestId('chat-content')).toBeTruthy()
    expect(screen.getByTestId('map-content')).toBeTruthy()
  })

  it('顶栏新对话按钮触发回调', () => {
    setWide(true)
    const onNew = renderShell()
    fireEvent.click(screen.getByTestId('new-conversation'))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('≥1440 历史栏单实例常驻侧栏，不渲染图标栏', () => {
    setWide(true)
    renderShell()
    expect(screen.getByTestId('history-aside')).toBeTruthy()
    expect(screen.queryByTestId('history-rail')).toBeNull()
    // 历史内容只挂载一次
    expect(screen.getAllByTestId('history-content')).toHaveLength(1)
  })

  it('1366 历史收入 Sheet：图标栏 + 抽屉，历史内容单实例', () => {
    setWide(false)
    renderShell()
    expect(screen.queryByTestId('history-aside')).toBeNull()
    expect(screen.getByTestId('history-rail')).toBeTruthy()
    const trigger = screen.getByTestId('history-sheet-trigger')
    expect(trigger).toBeTruthy()
    // 关闭时抽屉内容不挂载（历史组件不在隐藏 DOM 中空跑 fetch）
    expect(screen.queryByTestId('history-sheet-content')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByTestId('history-sheet-content')).toBeTruthy()
    // 全树历史内容仅一个实例
    expect(screen.getAllByTestId('history-content')).toHaveLength(1)
  })

  it('顶栏含唯一 h1 且可访问名称为"航线编辑 Agent"', () => {
    setWide(true)
    renderShell()
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent('航线编辑 Agent')
  })
})
