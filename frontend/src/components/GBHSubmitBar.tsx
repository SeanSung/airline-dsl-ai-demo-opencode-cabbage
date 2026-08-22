import { useState } from 'react'
import type { RouteData } from '../state/chatReducer'

export type SubmitStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; gbhRouteId: string }
  | { state: 'error'; message: string }

export function GBHSubmitBar({ route }: { route: RouteData | null }) {
  const [status, setStatus] = useState<SubmitStatus>({ state: 'idle' })

  const submit = async (): Promise<void> => {
    if (!route || status.state === 'loading') return
    setStatus({ state: 'loading' })
    try {
      const res = await fetch(`/api/routes/${route.routeId}/submit-gbh`, { method: 'POST' })
      const data = (await res.json()) as
        | { status: 'ok'; gbhRouteId: string }
        | { status: 'invalid'; errors: unknown }
        | { status: 'error'; message: string }
      if (data.status === 'ok') {
        setStatus({ state: 'ok', gbhRouteId: data.gbhRouteId })
      } else if (data.status === 'invalid') {
        setStatus({ state: 'error', message: JSON.stringify(data.errors) })
      } else {
        setStatus({ state: 'error', message: data.message })
      }
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const disabled = !route || status.state === 'loading'
  const label = status.state === 'loading' ? '正在提交模拟飞行…' : '一键提交 GBH'
  const buttonBg = status.state === 'ok' ? '#34d399' : status.state === 'error' ? '#f87171' : '#38bdf8'

  return (
    <div
      className="gbh-bar"
      data-testid="gbh-bar"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'rgba(15,23,42,0.92)', borderTop: '1px solid #1e293b' }}
    >
      <button
        className="gbh-submit"
        data-testid="gbh-submit"
        disabled={disabled}
        onClick={() => void submit()}
        style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: buttonBg, color: '#0b1220', fontWeight: 600 }}
      >
        {label}
      </button>
      {status.state === 'ok' && (
        <span className="gbh-status ok" data-testid="gbh-status" style={{ color: '#34d399' }}>
          验证通过 · {status.gbhRouteId}
        </span>
      )}
      {status.state === 'error' && (
        <span className="gbh-status error" data-testid="gbh-status" style={{ color: '#f87171' }}>
          {status.message}
        </span>
      )}
    </div>
  )
}
