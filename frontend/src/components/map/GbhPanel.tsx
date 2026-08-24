import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Plane, Send } from 'lucide-react'
import type { RouteData } from '../../state/chatReducer'
import { Button } from '../ui/button'
import { MapOverlayCard } from '../layout/MapOverlayCard'
import { formatGbhError } from '../../lib/format-gbh-error'

export type GbhSubmitStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; gbhRouteId: string }
  | { state: 'error'; message: string }

/**
 * 浮卡式 GBH 提交面板，替代旧的底部 GBHSubmitBar。
 * - 定位为地图右下角浮卡，覆盖面积受控（w-72）。
 * - 提交/状态逻辑与旧 GBHSubmitBar 一致，仅把错误文案经 formatGbhError 净化。
 * - 保留 testid：gbh-bar（面板根）、gbh-submit（按钮）、gbh-status（状态文案）。
 */
export function GbhPanel({ route }: { route: RouteData | null }) {
  const [status, setStatus] = useState<GbhSubmitStatus>({ state: 'idle' })

  // 切换航线或清空时重置提交状态，避免新航线误显上一条航线的成功/失败结果。
  useEffect(() => {
    setStatus({ state: 'idle' })
  }, [route?.routeId])

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
        setStatus({ state: 'error', message: formatGbhError(data.errors) })
      } else {
        setStatus({ state: 'error', message: formatGbhError(data.message) })
      }
    } catch (err) {
      setStatus({ state: 'error', message: formatGbhError(err) })
    }
  }

  const disabled = !route || status.state === 'loading'
  const isLoading = status.state === 'loading'

  const buttonLabel = isLoading ? '正在提交模拟飞行…' : '一键提交 GBH'

  return (
    // gbh-bar 为面板根 testid；absolute 定位浮在地图右下角，宽度受控避免大面积遮挡。
    <div data-testid="gbh-bar" className="absolute bottom-3 right-3 z-10 w-72 max-w-[calc(100%-1.5rem)]">
      <h2 className="sr-only">提交 GBH</h2>
      <MapOverlayCard
        title={
          <span className="flex items-center gap-1.5">
            <Plane className="h-3.5 w-3.5 text-primary" aria-hidden />
            提交 GBH
          </span>
        }
        defaultOpen
      >
        <div className="flex flex-col gap-2">
          <Button
            data-testid="gbh-submit"
            type="button"
            size="sm"
            className="w-full"
            disabled={disabled}
            onClick={() => void submit()}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {buttonLabel}
          </Button>
          {status.state === 'ok' && (
            <span
              data-testid="gbh-status"
              className="flex items-center gap-1.5 text-xs text-success"
              role="status"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              验证通过 · {status.gbhRouteId}
            </span>
          )}
          {status.state === 'error' && (
            <span
              data-testid="gbh-status"
              className="text-xs leading-relaxed text-destructive"
              role="alert"
            >
              {status.message}
            </span>
          )}
        </div>
      </MapOverlayCard>
    </div>
  )
}
