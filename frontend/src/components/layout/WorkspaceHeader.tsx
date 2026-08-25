import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAirlineChatContext } from '../../state/useAirlineChat'
import type { RouteData } from '../../state/types'

/**
 * Workspace header: title + status + param chips + new-conversation button.
 * Reads route/status from AirlineChatContext.
 */
export function WorkspaceHeader() {
  const { route, status, newConversation, conversationId } = useAirlineChatContext()

  const title = conversationId ? '航线会话' : '新航线'

  return (
    <header
      data-testid="workspace-header"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4"
    >
      <span data-testid="header-title" className="text-sm font-semibold">
        {title}
      </span>

      <StatusBadge status={status} route={route} />

      <div data-testid="header-param-chips" className="flex flex-1 items-center gap-1.5 overflow-hidden">
        {route && <ParamChips route={route} />}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={newConversation}
        data-testid="new-conversation-header"
      >
        <Plus className="h-4 w-4" aria-hidden />
        新对话
      </Button>
    </header>
  )
}

function StatusBadge({
  status,
  route,
}: {
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  route: RouteData | null
}) {
  if (status === 'submitted' || status === 'streaming') {
    return (
      <span data-testid="header-status" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        生成中
      </span>
    )
  }

  if (route) {
    if (route.aiGenerated) {
      return (
        <span data-testid="header-status" className="inline-flex items-center gap-1 text-xs text-success">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
          已生成航线
        </span>
      )
    }
    return (
      <span data-testid="header-status" className="inline-flex items-center gap-1 text-xs text-warning">
        <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
        非 AI 生成
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span data-testid="header-status" className="inline-flex items-center gap-1 text-xs text-destructive">
        <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />
        错误
      </span>
    )
  }

  return null
}

function ParamChips({ route }: { route: RouteData }) {
  const { intent } = route
  const chips: string[] = []
  if (intent.region) chips.push(intent.region)
  if (intent.height) chips.push(`${intent.height}m`)
  if (intent.speed) chips.push(`${intent.speed}m/s`)
  if (intent.action) chips.push(intent.action)

  if (chips.length === 0) return null

  return (
    <>
      {chips.map((chip) => (
        <Badge key={chip} variant="secondary" className="text-[11px]">
          {chip}
        </Badge>
      ))}
    </>
  )
}
