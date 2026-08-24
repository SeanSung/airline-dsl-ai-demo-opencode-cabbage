import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapOverlayCard } from './MapOverlayCard'

describe('MapOverlayCard', () => {
  it('默认渲染标题与子内容', () => {
    render(
      <MapOverlayCard title="测试卡片">
        <span>主体内容</span>
      </MapOverlayCard>,
    )
    expect(screen.getByText('测试卡片')).toBeInTheDocument()
    expect(screen.getByText('主体内容')).toBeInTheDocument()
  })

  it('defaultOpen=false 时子内容被隐藏', () => {
    render(
      <MapOverlayCard title="折叠卡片" defaultOpen={false}>
        <span>隐藏内容</span>
      </MapOverlayCard>,
    )
    expect(screen.getByText('折叠卡片')).toBeInTheDocument()
    // jsdom 不解析 Tailwind 的 hidden 工具类，故直接断言 Radix Collapsible 的 data-state。
    const content = screen.getByText('隐藏内容').closest('[data-state]')
    expect(content).toHaveAttribute('data-state', 'closed')
  })
})
