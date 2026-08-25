import { useCallback, useRef, useState, type KeyboardEvent, type FormEvent } from 'react'
import { Loader2, Plus, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface ComposerProps {
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  onSend: (text: string) => void
  onStop: () => void
}

/**
 * Chat composer: multi-line textarea + send/stop.
 * - Enter sends (unless Shift held or IME composing)
 * - Shift+Enter inserts newline
 * - Auto-resize: 1–6 lines, then internal scroll
 * - Streaming: Square stop button; otherwise Send paper plane
 * - + button disabled (attachment placeholder)
 */
export function Composer({ status, onSend, onStop }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  const isStreaming = status === 'submitted' || status === 'streaming'
  const canSend = draft.trim().length > 0 && !isStreaming

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    // Clamp to ~6 lines (line-height ~24px = 144px)
    const max = 144
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [])

  const handleSubmit = useCallback(() => {
    const text = draft.trim()
    if (!text || isStreaming) return
    onSend(text)
    setDraft('')
    // Reset height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.overflowY = 'hidden'
      }
    })
  }, [draft, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // IME composition guard
      if (composingRef.current) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleInput = useCallback(
    (e: FormEvent<HTMLTextAreaElement>) => {
      setDraft((e.target as HTMLTextAreaElement).value)
      adjustHeight()
    },
    [adjustHeight],
  )

  return (
    <form
      className={cn(
        'mx-3 mb-3 flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring',
      )}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        aria-disabled="true"
        aria-label="附件（暂不可用）"
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </Button>

      <textarea
        ref={textareaRef}
        value={draft}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composingRef.current = true }}
        onCompositionEnd={() => { composingRef.current = false }}
        rows={1}
        placeholder="输入航线需求…"
        aria-label="输入航线需求"
        className={cn(
          'min-h-[24px] flex-1 resize-none bg-transparent text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none',
        )}
      />

      {isStreaming ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onStop}
          aria-label="停止生成"
          data-testid="composer-stop"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Square className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={!canSend}
          aria-label="发送"
          data-testid="composer-send"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </form>
  )
}
