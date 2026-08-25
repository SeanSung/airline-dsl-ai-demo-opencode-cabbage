import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WorkspaceHeader } from './WorkspaceHeader'
import { AirlineChatProvider } from '../../state/useAirlineChat'

afterEach(() => cleanup())

function renderHeader() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}'))),
  )
  render(
    <AirlineChatProvider>
      <WorkspaceHeader />
    </AirlineChatProvider>,
  )
}

describe('WorkspaceHeader', () => {
  it('渲染 workspace-header testid', () => {
    renderHeader()
    expect(screen.getByTestId('workspace-header')).toBeTruthy()
  })

  it('初始标题为新航线', () => {
    renderHeader()
    expect(screen.getByTestId('header-title').textContent).toBe('新航线')
  })

  it('无 route 时不渲染 param chips', () => {
    renderHeader()
    const chips = screen.getByTestId('header-param-chips')
    expect(chips.children.length).toBe(0)
  })

  it('新对话按钮存在', () => {
    renderHeader()
    expect(screen.getByTestId('new-conversation-header')).toBeTruthy()
  })

  it('初始状态无状态徽章（ready + null route）', () => {
    renderHeader()
    expect(screen.queryByTestId('header-status')).toBeNull()
  })
})
