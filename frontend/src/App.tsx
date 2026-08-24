import { useCallback } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { RouteMap } from './components/RouteMap'
import { GBHSubmitBar } from './components/GBHSubmitBar'
import { HistoryPanel, type SubmitStatus } from './components/HistoryPanel'
import { AppShell } from './components/layout/AppShell'
import { ChatProvider, useChat } from './state/chatReducer'
import { useChatStream, conversationForRoute } from './api/useChatStream'

function Workspace() {
  const { state, dispatch } = useChat()
  const { loadConversation, newConversation } = useChatStream(dispatch)

  const onResume = useCallback(
    async (routeId: string, conversationId?: string) => {
      const cid = conversationId ?? conversationForRoute(routeId)
      if (cid) {
        await loadConversation(cid, routeId)
      }
    },
    [loadConversation],
  )

  const onResubmit = useCallback(async (routeId: string, setStatus: (s: SubmitStatus) => void) => {
    setStatus({ state: 'loading' })
    try {
      const res = await fetch(`/api/routes/${routeId}/submit-gbh`, { method: 'POST' })
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
  }, [])

  return (
    <AppShell
      onNewConversation={() => newConversation()}
      renderHistory={() => <HistoryPanel onResume={onResume} onResubmit={onResubmit} />}
      chat={<ChatPanel />}
      map={
        <div className="flex h-full flex-col">
          <RouteMap route={state.route} />
          <GBHSubmitBar route={state.route} />
        </div>
      }
    />
  )
}

export default function App() {
  return (
    <ChatProvider>
      <Workspace />
    </ChatProvider>
  )
}
