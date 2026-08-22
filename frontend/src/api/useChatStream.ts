import { useCallback, useRef, useState } from 'react'
import type { AgentEvent, AirlineContent } from '@airline-dsl/shared'
import type { ChatAction, ChatMessage, Dispatch, RouteData } from '../state/chatReducer'

const conversationByRoute = new Map<string, string>()

export function registerConversationRoute(routeId: string, conversationId: string): void {
  conversationByRoute.set(routeId, conversationId)
}

export function conversationForRoute(routeId: string): string | undefined {
  return conversationByRoute.get(routeId)
}

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
          if (idRef.current) registerConversationRoute(ev.routeId, idRef.current)
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

  const loadConversation = useCallback(
    async (id: string, routeId: string) => {
      const [convRes, routeRes] = await Promise.all([
        fetch(`/api/conversations/${id}`),
        fetch(`/api/routes/${routeId}`),
      ])
      const conv = (await convRes.json()) as { messages: unknown[] }
      const route = (await routeRes.json()) as { content: AirlineContent; aiGenerated: boolean }
      const messages = toChatMessages(conv.messages)
      const currentRoute: RouteData = { routeId, content: route.content, aiGenerated: route.aiGenerated }
      idRef.current = id
      streamingStarted.current = false
      setConversationId(id)
      dispatch({ type: 'hydrate', messages, route: currentRoute })
    },
    [dispatch],
  )

  return { conversationId, send, newConversation, loadConversation }
}

function toChatMessages(raw: unknown[]): ChatMessage[] {
  let counter = 0
  const out: ChatMessage[] = []
  for (const item of raw) {
    const msg = item as { role?: string; content?: unknown }
    if (msg.role === 'user') {
      counter += 1
      out.push({ id: counter, role: 'user', text: extractText(msg.content) })
    } else if (msg.role === 'assistant') {
      counter += 1
      out.push({ id: counter, role: 'assistant', text: extractText(msg.content), clarifying: [] })
    }
  }
  return out
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' ? (part as { text?: unknown }).text : undefined))
      .filter((t): t is string => typeof t === 'string')
      .join('')
  }
  return ''
}
