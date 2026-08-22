import { ChatPanel } from './components/ChatPanel'
import { RouteMap } from './components/RouteMap'
import { GBHSubmitBar } from './components/GBHSubmitBar'
import { ChatProvider, useChat } from './state/chatReducer'

function Workspace() {
  const { state } = useChat()
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b1220', color: '#e2e8f0' }}>
      <ChatPanel />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <RouteMap route={state.route} />
        <GBHSubmitBar route={state.route} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ChatProvider>
      <Workspace />
    </ChatProvider>
  )
}
