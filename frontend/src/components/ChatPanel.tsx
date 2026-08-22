import { useState } from 'react'
import { useChatStream } from '../api/useChatStream'
import { useChat } from '../state/chatReducer'
import { RouteCard } from './RouteCard'

const SUGGESTIONS = [
  '环绕沧海校区巡检一圈，高度 120 米',
  '以机巢为圆心半径 300 米，高度 100 米，每点拍照',
  '环绕沧海校区两圈，加录像和返航',
]

export function ChatPanel() {
  const { state, dispatch } = useChat()
  const { send, newConversation } = useChatStream(dispatch)
  const [draft, setDraft] = useState('')

  const submit = (text: string) => {
    const value = text.trim()
    if (!value || state.streaming) return
    dispatch({ type: 'send', text: value })
    setDraft('')
    void send(value)
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <span className="chat-title">航线编辑 Agent</span>
        <button
          onClick={() => {
            newConversation()
            setDraft('')
          }}
        >
          新建会话
        </button>
      </header>
      <div className="message-list">
        {state.messages.length === 0 && !state.streaming && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} data-testid="suggestion" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {state.messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="bubble user" data-testid="bubble-user">
                {m.text}
              </div>
            )
          }
          if (m.role === 'error') {
            return (
              <div key={m.id} className="bubble error" data-testid="bubble-error">
                {m.text}
              </div>
            )
          }
          return (
            <div key={m.id} className="bubble assistant" data-testid="bubble-assistant">
              {m.clarifying.length > 0 && (
                <span className="tag" data-testid="clarify-tag">
                  待补充参数：{m.clarifying.join('、')}
                </span>
              )}
              <span>{m.text}</span>
              {state.streaming && (
                <span className="typing" data-testid="typing">
                  正在理解需求…
                </span>
              )}
            </div>
          )
        })}
      </div>
      {state.route && <RouteCard route={state.route} />}
      {state.errorBar && (
        <div className="error-bar" data-testid="error-bar">
          {state.errorBar}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="输入需求…" />
        <button type="submit" disabled={state.streaming}>
          发送
        </button>
      </form>
    </section>
  )
}
