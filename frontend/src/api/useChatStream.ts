import { useCallback, useRef, useState } from 'react'
import type { AgentEvent } from '@airline-dsl/shared'
import type { ChatAction, Dispatch } from '../state/chatReducer'

export function useChatStream(dispatch: Dispatch) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const idRef = useRef<string | null>(null)
  const streamingStarted = useRef(false)

  const newConversation = useCallback(() => {
    idRef.current = null
    streamingStarted.current = false
    setConversationId(null)
    dispatch({ type: 'reset' })
  }, [dispatch])

  const handleEvent = useCallback(
    (ev: AgentEvent) => {
      switch (ev.type) {
        case 'text_delta':
          if (!streamingStarted.current) {
            dispatch({ type: 'stream_start' })
            streamingStarted.current = true
          }
          dispatch({ type: 'stream_delta', text: ev.text })
          break
        case 'clarification':
          streamingStarted.current = false
          dispatch({ type: 'clarification', missing: ev.missing, text: ev.text })
          break
        case 'route_generated':
          streamingStarted.current = false
          dispatch({ type: 'route_generated', routeId: ev.routeId, content: ev.content, aiGenerated: ev.aiGenerated })
          break
        case 'error':
          streamingStarted.current = false
          dispatch({ type: 'error', message: ev.message })
          break
        case 'done':
          streamingStarted.current = false
          dispatch({ type: 'done' })
          break
      }
    },
    [dispatch],
  )

  const send = useCallback(
    async (text: string) => {
      let id = idRef.current
      if (!id) {
        const res = await fetch('/api/conversations', { method: 'POST' })
        const data = (await res.json()) as { conversationId: string }
        id = data.conversationId
        idRef.current = id
        setConversationId(id)
      }
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload) continue
          try {
            handleEvent(JSON.parse(payload) as AgentEvent)
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    },
    [handleEvent],
  )

  return { conversationId, send, newConversation }
}
