import { useState } from 'react'
import type { RouteData } from '../state/chatReducer'

export function RouteCard({ route }: { route: RouteData }) {
  const [open, setOpen] = useState(false)
  const { content, intent } = route
  const actionSummary = intent?.actions?.map((a) => a.type).join('、') || '无动作'
  return (
    <div className="route-card" data-testid="route-card">
      <div className="route-title">{content.name}</div>
      {!route.aiGenerated && (
        <span className="badge" data-testid="not-ai-badge">
          非 AI 生成
        </span>
      )}
      <div className="route-meta">
        区域 {intent?.region ?? '—'} · 半径 {intent?.radiusM ?? '—'}m · 高度 {intent?.heightM ?? content.global_height}m · 速度 {intent?.speedMps ?? content.global_speed}m/s · 动作 {actionSummary}
      </div>
      <button onClick={() => setOpen(!open)}>解析详情</button>
      {open && <pre className="intent-json" data-testid="intent-json">{JSON.stringify(intent ?? {}, null, 2)}</pre>}
    </div>
  )
}
