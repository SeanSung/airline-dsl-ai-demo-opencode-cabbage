import { useState } from 'react'
import { History as HistoryIcon, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface NavRailProps {
  /** Render-prop for history content; mounted only when Sheet is open. */
  renderHistory: () => React.ReactNode
  onNewConversation: () => void
}

/**
 * Left icon navigation rail: 68px wide, always visible.
 * - Plus: new conversation
 * - History: opens Sheet drawer with history content
 * - Settings: disabled
 * - Bottom: user avatar placeholder
 */
export function NavRail({ renderHistory, onNewConversation }: NavRailProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <nav
      data-testid="nav-rail"
      aria-label="导航栏"
      className="flex w-[68px] shrink-0 flex-col items-center border-r border-border bg-card py-3"
    >
      {/* Top actions */}
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 flex-col gap-0.5 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={onNewConversation}
          aria-label="新对话"
          data-testid="new-conversation"
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="text-[11px]">新对话</span>
        </Button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 flex-col gap-0.5 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="历史航线"
              data-testid="history-sheet-trigger"
            >
              <HistoryIcon className="h-5 w-5" aria-hidden />
              <span className="text-[11px]">历史</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>历史航线</SheetTitle>
              <SheetDescription className="sr-only">历史航线列表</SheetDescription>
            </SheetHeader>
            <div data-testid="history-sheet-viewport" className="h-[calc(100%-57px)] overflow-y-auto">
              {sheetOpen ? renderHistory() : null}
            </div>
          </SheetContent>
        </Sheet>

        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 flex-col gap-0.5 rounded-lg text-muted-foreground"
          disabled
          aria-disabled="true"
          aria-label="设置（暂不可用）"
        >
          <Settings className="h-5 w-5" aria-hidden />
          <span className="text-[11px]">设置</span>
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar placeholder */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
        aria-label="用户区"
      >
        U
      </div>
    </nav>
  )
}
