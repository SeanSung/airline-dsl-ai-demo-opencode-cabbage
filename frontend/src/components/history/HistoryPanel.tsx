import { useEffect, useState } from 'react'
import { AlertCircle, ChevronRight, History as HistoryIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { RouteListItem } from './RouteListItem'

export type RouteStatus = 'draft' | 'validated' | 'failed'

export interface RouteSummary {
  id: string
  name: string
  aiGenerated: boolean
  status: RouteStatus
  waypointCount: number
  conversationId?: string
  createdAt: string
}

export type SubmitStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; gbhRouteId: string }
  | { state: 'error'; message: string }

interface HistoryPanelProps {
  onResume: (routeId: string, conversationId?: string) => Promise<void>
  onResubmit: (routeId: string, setStatus: (s: SubmitStatus) => void) => Promise<void>
}

/**
 * 历史航线侧栏面板。
 * - 显隐由外层 AppShell 控制（≥1440 常驻，窄屏收入 Sheet）；组件内部仍保留折叠 toggle 以兼容独立使用与测试。
 * - 业务逻辑（fetch /api/routes、本地 statuses、onResume/onResubmit）保持不变。
 */
export function HistoryPanel({ onResume, onResubmit }: HistoryPanelProps) {
  const [open, setOpen] = useState(false)
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, SubmitStatus>>({})
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoadingList(true)
    setError(null)
    try {
      const res = await fetch('/api/routes')
      const data = (await res.json()) as RouteSummary[]
      setRoutes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  const handleResubmit = async (routeId: string) => {
    const setStatus = (s: SubmitStatus) => setStatuses((prev) => ({ ...prev, [routeId]: s }))
    await onResubmit(routeId, setStatus)
  }

  return (
    <section
      className="flex h-full flex-col bg-card text-card-foreground"
      data-testid="history-panel"
    >
      <button
        type="button"
        className={cn(
          'flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-left',
          'text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        )}
        data-testid="history-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <HistoryIcon className="h-4 w-4 text-primary" aria-hidden />
        <span className="flex-1">历史航线</span>
        <ChevronRight
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-90')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col">
          {loadingList && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              加载中…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          {!loadingList && routes.length === 0 && !error && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              暂无历史航线，开始对话即可生成。
            </div>
          )}

          {routes.length > 0 && (
            <ul className="flex flex-col gap-2 overflow-y-auto p-2">
              {routes.map((r) => {
                const st = statuses[r.id] ?? { state: 'idle' as const }
                return (
                  <RouteListItem
                    key={r.id}
                    route={r}
                    submit={st}
                    onResume={onResume}
                    onResubmit={handleResubmit}
                  />
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
