import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NavRail } from './NavRail'

afterEach(() => cleanup())

function renderNavRail(props: Partial<Parameters<typeof NavRail>[0]> = {}) {
  const onNew = vi.fn()
  const defaults = {
    renderHistory: () => <div data-testid="history-content">历史</div>,
    onNewConversation: onNew,
  }
  render(<NavRail {...defaults} {...props} />)
  return onNew
}

describe('NavRail', () => {
  it('含 w-[68px] 类（NavRail 宽度）', () => {
    renderNavRail()
    const nav = screen.getByTestId('nav-rail')
    expect(nav.className).toContain('w-[68px]')
  })

  it('含新对话、历史、设置三个按钮', () => {
    renderNavRail()
    expect(screen.getByLabelText('新对话')).toBeTruthy()
    expect(screen.getByLabelText('历史航线')).toBeTruthy()
    expect(screen.getByLabelText('设置（暂不可用）')).toBeTruthy()
  })

  it('设置按钮 disabled 且 aria-disabled', () => {
    renderNavRail()
    const settingsBtn = screen.getByLabelText('设置（暂不可用）').closest('button')!
    expect(settingsBtn).toBeDisabled()
    expect(settingsBtn.getAttribute('aria-disabled')).toBe('true')
  })

  it('点击新对话触发 onNewConversation', () => {
    const onNew = renderNavRail()
    fireEvent.click(screen.getByLabelText('新对话'))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('关闭时历史内容不挂载', () => {
    renderNavRail()
    expect(screen.queryByTestId('history-content')).toBeNull()
  })

  it('点击历史打开 Sheet，历史内容出现在 viewport 中', () => {
    renderNavRail()
    fireEvent.click(screen.getByTestId('history-sheet-trigger'))
    expect(screen.getByTestId('history-content')).toBeTruthy()
    expect(screen.getByTestId('history-sheet-viewport')).toBeTruthy()
  })

  it('Sheet role=dialog 存在', () => {
    renderNavRail()
    fireEvent.click(screen.getByTestId('history-sheet-trigger'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('底部用户区占位存在', () => {
    renderNavRail()
    expect(screen.getByLabelText('用户区')).toBeTruthy()
  })
})
