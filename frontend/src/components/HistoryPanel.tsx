import { useEffect, useState } from 'react'

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

const STATUS_LABEL: Record<RouteStatus, string> = {
  draft: '草稿',
  validated: '已验证',
  failed: '失败',
}

interface HistoryPanelProps {
  onResume: (routeId: string, conversationId?: string) => Promise<void>
  onResubmit: (routeId: string, setStatus: (s: SubmitStatus) => void) => Promise<void>
}

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
    <section className="history-panel" data-testid="history-panel">
      <header className="history-header">
        <button className="history-toggle" data-testid="history-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? '收起历史' : '历史航线'}
        </button>
      </header>
      {open && (
        <div className="history-body">
          {loadingList && <div className="history-note">加载中…</div>}
          {error && <div className="history-note error">{error}</div>}
          {!loadingList && routes.length === 0 && !error && <div className="history-note">暂无航线</div>}
          {routes.map((r) => {
            const st = statuses[r.id] ?? { state: 'idle' }
            return (
              <div className="history-item" key={r.id} data-testid="history-item">
                <div className="history-item-main">
                  <span className="history-name" data-testid="history-name">
                    {r.name}
                  </span>
                  <span className="history-meta" data-testid="history-meta">
                    {r.waypointCount} 航点 · {r.createdAt}
                  </span>
                  <div className="history-badges">
                    <span className="badge status" data-testid="status-badge">
                      {STATUS_LABEL[r.status]}
                    </span>
                    {!r.aiGenerated && (
                      <span className="badge" data-testid="not-ai-badge">
                        非 AI 生成
                      </span>
                    )}
                  </div>
                </div>
                <div className="history-actions">
                  <button className="history-action" data-testid="resume-btn" onClick={() => void onResume(r.id, r.conversationId)}>
                    续编
                  </button>
                  <button
                    className="history-action gbh"
                    data-testid="resubmit-btn"
                    disabled={st.state === 'loading'}
                    onClick={() => void handleResubmit(r.id)}
                  >
                    {st.state === 'loading' ? '提交中…' : '再次提交 GBH'}
                  </button>
                </div>
                {st.state === 'ok' && (
                  <div className="history-submit ok" data-testid="resubmit-status">
                    验证通过 · {st.gbhRouteId}
                  </div>
                )}
                {st.state === 'error' && (
                  <div className="history-submit error" data-testid="resubmit-status">
                    {st.message}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
