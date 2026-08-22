import { ChatPanel } from './components/ChatPanel'
import { ChatProvider } from './state/chatReducer'

export default function App() {
  return (
    <ChatProvider>
      <ChatPanel />
    </ChatProvider>
  )
}
