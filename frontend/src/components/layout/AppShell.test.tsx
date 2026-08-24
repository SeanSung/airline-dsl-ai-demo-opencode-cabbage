import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from './AppShell'

function renderShell(onNew = vi.fn()) {
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
    renderShell()
    expect(screen.getByTestId('topbar')).toBeTruthy()
    expect(screen.getByTestId('app-shell')).toBeTruthy()
    expect(screen.getByTestId('chat-content')).toBeTruthy()
    expect(screen.getByTestId('map-content')).toBeTruthy()
  })

  it('顶栏新对话按钮触发回调', () => {
    const onNew = renderShell()
    fireEvent.click(screen.getByTestId('new-conversation'))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('1366 历史栏提供 Sheet 触发器与抽屉内容', () => {
    renderShell()
    // 常驻侧栏与 Sheet 抽屉都渲染了 history-content（render-prop 各调用一次）
    expect(screen.getByTestId('history-aside')).toBeTruthy()
    expect(screen.getByTestId('history-rail')).toBeTruthy()
    const trigger = screen.getByTestId('history-sheet-trigger')
    expect(trigger).toBeTruthy()
    // 打开 Sheet 后抽屉内容可见
    fireEvent.click(trigger)
    expect(screen.getByTestId('history-sheet-content')).toBeTruthy()
  })
})
