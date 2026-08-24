import { useState, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MapOverlayCardProps {
  /** 卡片标题，渲染在折叠栏左侧。 */
  title: ReactNode
  /** 卡片主体内容。 */
  children: ReactNode
  /** 定位/外观类，由调用方传入（如 bottom-3 right-3 w-72）。 */
  className?: string
  /** 是否默认展开，默认 true。 */
  defaultOpen?: boolean
  /** 折叠按钮 aria-label（默认「折叠/展开」由标题上下文补充）。 */
  toggleAriaLabel?: string
}

/**
 * 地图浮卡通用容器：标题栏 + 可折叠主体 + Radix Collapsible 动画。
 * 定位类由调用方通过 className 传入（浮在地图上的不同位置）。
 * GbhPanel 及未来的 badge/info 浮层均复用此容器。
 */
export function MapOverlayCard({
  title,
  children,
  className,
  defaultOpen = true,
  toggleAriaLabel = '折叠面板',
}: MapOverlayCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card/95 text-card-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Collapsible.Trigger
          className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          aria-label={toggleAriaLabel}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="truncate">{title}</span>
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content
        forceMount
        className="overflow-hidden data-[state=closed]:hidden data-[state=open]:animate-in"
      >
        <div className="px-3 py-2.5 text-sm">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
