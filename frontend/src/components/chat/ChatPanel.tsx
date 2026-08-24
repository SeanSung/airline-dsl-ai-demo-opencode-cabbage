import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { useChatStream } from '../../api/useChatStream'
import { useChat } from '../../state/chatReducer'
import { Button } from '../ui/button'
import { RouteCard } from './RouteCard'
import { cn } from '../../lib/cn'

const SUGGESTIONS = [
  '环绕沧海校区巡检一圈，高度 120 米',
  '以机巢为圆心半径 300 米，高度 100 米，每点拍照',
  '环绕沧海校区两圈，加录像和返航',
]

/**
 * 航线编辑 Agent 对话栏：消息列表 + 航线卡片 + 错误条 + 输入区。
 * 无 props，内部通过 useChat/useChatStream 接线；header 与“新建会话”由 AppShell TopBar 接管。
 */
export function ChatPanel() {
  const { state, dispatch } = useChat()
  const { send } = useChatStream(dispatch)
  const [draft, setDraft] = useState('')

  const submit = (text: string) => {
    const value = text.trim()
    if (!value || state.streaming) return
    dispatch({ type: 'send', text: value })
    setDraft('')
    void send(value)
  }

  const lastAssistant =
    state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant'
      ? state.messages[state.messages.length - 1]
      : null

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground">
      {/* 消息列表区：可滚动 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="message-list">
        {state.messages.length === 0 && !state.streaming && (
          <div className="flex h-full flex-col justify-center gap-2" data-testid="suggestions">
            <p className="mb-1 text-center text-xs text-muted-foreground">试试这样说</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                data-testid="suggestion"
                onClick={() => submit(s)}
                className="rounded-full border border-border bg-card px-4 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {state.messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end" data-testid="bubble-user">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
                    {m.text}
                  </div>
                </div>
              )
            }
            if (m.role === 'error') {
              return (
                <div key={m.id} className="flex justify-start" data-testid="bubble-error">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive-solid/15 px-3.5 py-2 text-sm text-destructive">
                    {m.text}
                  </div>
                </div>
              )
            }
            return (
              <div key={m.id} className="flex justify-start" data-testid="bubble-assistant">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm">
                  {m.clarifying.length > 0 && (
                    <span
                      data-testid="clarify-tag"
                      className="mb-1 inline-flex items-center rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-medium text-info"
                    >
                      待补充参数：{m.clarifying.join('、')}
                    </span>
                  )}
                  <span>{m.text}</span>
                  {state.streaming && lastAssistant?.id === m.id && (
                    <Loader2
                      data-testid="typing"
                      className="ml-1 inline-block h-3.5 w-3.5 animate-spin align-middle text-muted-foreground"
                      aria-label="正在生成"
                    />
                  )}
                </div>
              </div>
            )
          })}

          {/* streaming 中但助手气泡尚未建立时的加载指示 */}
          {state.streaming && !lastAssistant && (
            <div className="flex justify-start" data-testid="bubble-assistant-pending">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                正在理解需求…
              </div>
            </div>
          )}
        </div>
      </div>

      {state.route && <RouteCard route={state.route} />}

      {state.errorBar && (
        <div
          data-testid="error-bar"
          role="alert"
          className="mx-3 mb-2 rounded-md border border-destructive/30 bg-destructive-solid/15 px-3 py-2 text-xs text-destructive"
        >
          {state.errorBar}
        </div>
      )}

      <form
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="输入需求…"
          className={cn(
            'h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        />
        <Button type="submit" disabled={state.streaming} aria-label="发送">
          <Send className="h-4 w-4" aria-hidden />
          发送
        </Button>
      </form>
    </section>
  )
}
