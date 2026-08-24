import { useEffect, useState, type ReactNode } from 'react'
import { History as HistoryIcon, Plane, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface TopBarProps {
  onNewConversation: () => void
}

function TopBar({ onNewConversation }: TopBarProps) {
  return (
    <header
      data-testid="topbar"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4"
    >
      <Plane className="h-5 w-5 text-primary" aria-hidden />
      <h1 className="text-sm font-semibold">航线编辑 Agent</h1>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        onClick={onNewConversation}
        data-testid="new-conversation"
      >
        <Plus className="h-4 w-4" aria-hidden />
        新对话
      </Button>
    </header>
  )
}

interface AppShellProps {
  /** 历史栏内容；≥1440 常驻侧栏，1366 收入 Sheet。render-prop 以避免同一节点挂两处。 */
  renderHistory: () => ReactNode
  /** 对话栏内容。 */
  chat: ReactNode
  /** 地图栏内容（RouteMap + GBH）。 */
  map: ReactNode
  onNewConversation: () => void
}

/**
 * 三栏工作台骨架：顶栏 + [历史 | 对话 | 地图]。
 * - ≥1440（wide）：历史常驻 280px 侧栏。
 * - 1366：历史收为 48px 图标栏，点击经 Sheet 抽屉滑出。
 * 仅负责布局与定位，不重写业务组件内部样式。
 */
export function AppShell({ renderHistory, chat, map, onNewConversation }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  // ≥1440（wide）：历史常驻侧栏；否则：图标栏 + Sheet。单实例挂载，避免历史组件被渲染两次。
  const isWide = useMediaQuery('(min-width: 1440px)')

  const historyNode = renderHistory()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar onNewConversation={onNewConversation} />

      <div
        data-testid="app-shell"
        className={
          isWide
            ? 'grid min-h-0 flex-1 grid-cols-[280px_420px_1fr]'
            : 'grid min-h-0 flex-1 grid-cols-[48px_minmax(380px,420px)_1fr]'
        }
      >
        {isWide ? (
          <aside
            data-testid="history-aside"
            className="min-h-0 overflow-y-auto border-r border-border"
          >
            {historyNode}
          </aside>
        ) : (
          <div
            data-testid="history-rail"
            className="flex min-h-0 w-12 items-start justify-center border-r border-border bg-card py-3"
          >
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="打开历史航线" data-testid="history-sheet-trigger">
                  <HistoryIcon className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="border-b border-border p-4">
                  <SheetTitle>历史航线</SheetTitle>
                  <SheetDescription className="sr-only">历史航线列表</SheetDescription>
                </SheetHeader>
                <div data-testid="history-sheet-content" className="h-[calc(100%-57px)] overflow-y-auto">
                  {historyNode}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}

        <section data-testid="chat-column" className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          {chat}
        </section>

        <section data-testid="map-column" className="relative flex min-h-0 min-w-0 flex-col">
          {map}
        </section>
      </div>
    </div>
  )
}

/** 订阅 CSS 媒体查询，SSR/无 matchMedia 环境回退 false。 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
