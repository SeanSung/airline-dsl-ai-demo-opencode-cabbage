import type { ReactNode } from 'react'
import { NavRail } from './NavRail'
import { WorkspaceHeader } from './WorkspaceHeader'

interface AppShellProps {
  /** History content render-prop; mounted only when Sheet is open. */
  renderHistory: () => ReactNode
  /** Chat column content. */
  chat: ReactNode
  /** Map column content (RouteMap + GbhPanel). */
  map: ReactNode
}

/**
 * Workspace shell: NavRail + WorkspaceHeader + [chat | map] grid.
 * NavRail is always visible at 68px; history via Sheet drawer.
 * Chat/map column width: 420px|1fr (≥1440) or minmax(380px,420px)|1fr (<1440).
 */
export function AppShell({ renderHistory, chat, map }: AppShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <h1 className="sr-only">航线编辑 Agent</h1>

      <NavRail
        renderHistory={renderHistory}
        onNewConversation={() => {
          /* wired via context in WorkspaceHeader */
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader />

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,420px)_1fr] 2xl:grid-cols-[420px_1fr]">
          <section
            data-testid="chat-column"
            aria-labelledby="chat-heading"
            className="flex min-h-0 min-w-0 flex-col overflow-y-auto"
          >
            <h2 id="chat-heading" className="sr-only">对话</h2>
            {chat}
          </section>

          <section
            data-testid="map-column"
            aria-labelledby="map-heading"
            className="relative flex min-h-0 min-w-0 flex-col"
          >
            <h2 id="map-heading" className="sr-only">航线地图</h2>
            {map}
          </section>
        </div>
      </main>
    </div>
  )
}
