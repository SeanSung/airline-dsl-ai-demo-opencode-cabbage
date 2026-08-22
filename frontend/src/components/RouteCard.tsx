import { useState } from 'react'
import type { RouteData } from '../state/chatReducer'

export function RouteCard({ route }: { route: RouteData }) {
  const [open, setOpen] = useState(false)
  const { content } = route
  const actionSummary = content.waypoints[0]?.actions.map((a) => a.action_type).join('、') ?? '无'
  return (
    <div className="route-card" data-testid="route-card">
      <div className="route-title">{content.name}</div>
      {!route.aiGenerated && (
        <span className="badge" data-testid="not-ai-badge">
          非 AI 生成
        </span>
      )}
      <div className="route-meta">
        航点 {content.waypoints.length} · 高度 {content.global_height}m · 速度 {content.global_speed}m/s · 动作 {actionSummary}
      </div>
      <button onClick={() => setOpen(!open)}>解析详情</button>
      {open && <pre className="intent-json" data-testid="intent-json">{JSON.stringify(route, null, 2)}</pre>}
    </div>
  )
}
