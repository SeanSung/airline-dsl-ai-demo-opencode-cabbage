import { useState, type ReactNode } from 'react'
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
      <span className="text-sm font-semibold">航线编辑 Agent</span>
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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar onNewConversation={onNewConversation} />

      <div
        data-testid="app-shell"
        className="grid min-h-0 flex-1 grid-cols-[48px_minmax(380px,420px)_1fr] wide:grid-cols-[280px_420px_1fr]"
      >
        {/* 历史栏：≥1440 常驻侧栏；1366 仅图标栏，列表在 Sheet */}
        <aside
          data-testid="history-aside"
          className="hidden min-h-0 wide:block wide:overflow-y-auto wide:border-r wide:border-border"
        >
          {renderHistory()}
        </aside>

        <div
          data-testid="history-rail"
          className="flex min-h-0 w-12 items-start justify-center border-r border-border bg-card py-3 wide:hidden"
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
                {renderHistory()}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <section data-testid="chat-column" className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          {chat}
        </section>

        <section data-testid="map-column" className="relative min-h-0 min-w-0">
          {map}
        </section>
      </div>
    </div>
  )
}
