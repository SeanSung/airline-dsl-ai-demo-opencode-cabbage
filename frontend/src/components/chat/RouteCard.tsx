import { useState } from 'react'
import { ChevronRight, Route as RouteIcon } from 'lucide-react'
import type { RouteData } from '../../state/chatReducer'
import { cn } from '../../lib/cn'

/**
 * 航线结果卡片：展示航线名、关键 meta，可折叠展开 intent JSON 解析详情。
 * 仅做表层展示，不改动 route 数据结构。
 */
export function RouteCard({ route }: { route: RouteData }) {
  const [open, setOpen] = useState(false)
  const { content, intent } = route
  const actionSummary = intent?.actions?.map((a) => a.type).join('、') || '无动作'

  return (
    <div
      data-testid="route-card"
      className="m-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm"
    >
      <div className="flex items-start gap-2">
        <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{content.name}</h3>
            {!route.aiGenerated && (
              <span
                data-testid="not-ai-badge"
                className="inline-flex shrink-0 items-center rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
              >
                非 AI 生成
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            区域 {intent?.region ?? '—'} · 半径 {intent?.radiusM ?? '—'}m · 高度{' '}
            {intent?.heightM ?? content.global_height}m · 速度{' '}
            {intent?.speedMps ?? content.global_speed}m/s · 动作 {actionSummary}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
        解析详情
      </button>

      {open && (
        <pre
          data-testid="intent-json"
          className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          {JSON.stringify(intent ?? {}, null, 2)}
        </pre>
      )}
    </div>
  )
}
