import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Route as RouteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { RouteStatus, SubmitStatus } from './HistoryPanel'

/** 状态 → 中文文案映射。 */
export const STATUS_LABEL: Record<RouteStatus, string> = {
  draft: '草稿',
  validated: '已验证',
  failed: '失败',
}

/** 状态 → 徽章样式（Tailwind + design token，无颜色字面量）。 */
const STATUS_BADGE_CLASS: Record<RouteStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  validated: 'bg-success text-success-foreground',
  failed: 'bg-destructive-solid text-destructive-foreground',
}

interface RouteListItemProps {
  route: {
    id: string
    name: string
    aiGenerated: boolean
    status: RouteStatus
    waypointCount: number
    conversationId?: string
    createdAt: string
  }
  submit: SubmitStatus
  onResume: (routeId: string, conversationId?: string) => void
  onResubmit: (routeId: string) => void
}

/** 单条历史航线卡片：名称、摘要、状态徽章、续编/重提按钮、提交反馈。 */
export function RouteListItem({ route, submit, onResume, onResubmit }: RouteListItemProps) {
  const submitting = submit.state === 'loading'

  return (
    <li
      className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
      data-testid="history-item"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground"
            data-testid="history-name"
          >
            <RouteIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{route.name}</span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground" data-testid="history-meta">
            {route.waypointCount} 航点 · {route.createdAt}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
            STATUS_BADGE_CLASS[route.status],
          )}
          data-testid="status-badge"
        >
          {STATUS_LABEL[route.status]}
        </span>
      </div>

      {!route.aiGenerated && (
        <span
          className="mt-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
          data-testid="not-ai-badge"
        >
          非 AI 生成
        </span>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 flex-1 text-xs"
          data-testid="resume-btn"
          onClick={() => void onResume(route.id, route.conversationId)}
        >
          续编
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 text-xs"
          data-testid="resubmit-btn"
          disabled={submitting}
          onClick={() => void onResubmit(route.id)}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              提交中…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              再次提交 GBH
            </>
          )}
        </Button>
      </div>

      {submit.state === 'ok' && (
        <div
          className="mt-2 flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1.5 text-xs text-success"
          data-testid="resubmit-status"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>验证通过 · {submit.gbhRouteId}</span>
        </div>
      )}
      {submit.state === 'error' && (
        <div
          className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive-solid/10 px-2 py-1.5 text-xs text-destructive"
          data-testid="resubmit-status"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{submit.message}</span>
        </div>
      )}
    </li>
  )
}
