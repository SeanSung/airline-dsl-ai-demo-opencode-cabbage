import { useCallback } from 'react'
import { ChatPanel } from './components/chat/ChatPanel'
import { GbhPanel } from './components/map/GbhPanel'
import { RouteMap } from './components/map/RouteMap'
import { HistoryPanel, type SubmitStatus } from './components/history/HistoryPanel'
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
        <>
          <RouteMap route={state.route} />
          <GbhPanel route={state.route} />
        </>
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
