import { Loader2 } from 'lucide-react'
import type { UIMessage } from 'ai'
import { useAirlineChatContext } from '../../state/useAirlineChat'
import { RouteCard } from './RouteCard'
import { Composer } from './Composer'
import type { RouteData } from '../../state/types'

const SUGGESTIONS = [
  '环绕沧海校区巡检一圈，高度 120 米',
  '以机巢为圆心半径 300 米，高度 100 米，每点拍照',
  '环绕沧海校区两圈，加录像和返航',
]

/**
 * Chat panel: message list + error bar + Composer.
 * Reads from AirlineChatContext; no props.
 */
export function ChatPanel() {
  const { messages, status, route, errorBar, send, stop } = useAirlineChatContext()

  const isStreaming = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      aria-labelledby="chat-panel-heading"
    >
      <h2 id="chat-panel-heading" className="sr-only">对话</h2>

      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="message-list">
        {isEmpty && (
          <div className="flex h-full flex-col justify-center gap-4" data-testid="composer-greeting">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">你好，今天规划条航线？</p>
              <p className="mt-1 text-sm text-muted-foreground">
                告诉我你想飞去哪里，我来帮你生成航线
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid="suggestion"
                  onClick={() => send(s)}
                  className="w-full max-w-md rounded-full border border-border bg-card px-4 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming}
              route={route}
            />
          ))}
        </div>
      </div>

      {/* Route card */}
      {route && <RouteCard route={route} />}

      {/* Error bar */}
      {errorBar && (
        <div
          data-testid="error-bar"
          role="alert"
          className="mx-3 mb-2 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive-solid/15 px-3 py-2 text-xs text-destructive"
        >
          <span>{errorBar}</span>
          <button
            type="button"
            onClick={() => {
              const lastUser = [...messages].reverse().find((m) => m.role === 'user')
              if (lastUser) {
                const text = lastUser.parts
                  ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                  .map((p) => p.text)
                  .join('')
                if (text) send(text)
              }
            }}
            className="ml-2 shrink-0 underline hover:text-destructive/80"
          >
            重试
          </button>
        </div>
      )}

      {/* Composer */}
      <Composer status={status} onSend={send} onStop={stop} />
    </section>
  )
}

function MessageBubble({
  message,
  isLast,
  isStreaming,
  route,
}: {
  message: UIMessage
  isLast: boolean
  isStreaming: boolean
  route: RouteData | null
}) {
  if (message.role === 'user') {
    const text = extractText(message)
    return (
      <div className="flex justify-end" data-testid="bubble-user">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
          {text}
        </div>
      </div>
    )
  }

  if (message.role === 'assistant') {
    const text = extractText(message)
    const clarifying = extractClarifying(message)
    const hasError = message.parts?.some((p) => p.type === 'error')

    if (hasError) {
      return (
        <div className="flex justify-start" data-testid="bubble-error">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive-solid/15 px-3.5 py-2 text-sm text-destructive">
            {text || '发生错误'}
          </div>
        </div>
      )
    }

    return (
      <div className="flex justify-start" data-testid="bubble-assistant">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm">
          {clarifying.length > 0 && (
            <span
              data-testid="clarify-tag"
              className="mb-1 inline-flex items-center rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-medium text-info"
            >
              待补充参数：{clarifying.join('、')}
            </span>
          )}
          <span>{text}</span>
          {isStreaming && isLast && (
            <Loader2
              data-testid="typing"
              className="ml-1 inline-block h-3.5 w-3.5 animate-spin align-middle text-muted-foreground"
              aria-label="正在生成"
            />
          )}
        </div>
      </div>
    )
  }

  return null
}

function extractText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function extractClarifying(message: UIMessage): string[] {
  for (const part of message.parts ?? []) {
    if (part.type === 'data-airline-clarification') {
      return (part as { type: 'data-airline-clarification'; data: { missing: string[] } }).data.missing
    }
  }
  return []
}
