import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useChat, type UseChatHelpers } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import type { AirlineDataTypes } from '../api/agent-event-stream'
import { AirlineChatTransport } from '../api/airline-chat-transport'
import type { RouteData } from './types'

// Module-level route↔conversation mapping.
// Dynamic runtime insertion/deletion → Map is appropriate.
const conversationByRoute = new Map<string, string>()

export function conversationForRoute(routeId: string): string | undefined {
  return conversationByRoute.get(routeId)
}

export interface AirlineChatApi {
  messages: UIMessage[]
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  route: RouteData | null
  errorBar: string | null
  conversationId: string | null
  send: (text: string) => void
  stop: () => void
  regenerate: () => void
  newConversation: () => void
  loadConversation: (conversationId: string, routeId: string) => Promise<void>
}

export function useAirlineChat(): AirlineChatApi {
  const cidRef = useRef<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  // Key forces useChat remount on newConversation
  const [chatKey, setChatKey] = useState(0)
  // Route loaded via loadConversation (takes precedence over message-derived)
  const [loadedRoute, setLoadedRoute] = useState<RouteData | null>(null)

  const ensureConversation = useCallback(
    async (signal?: AbortSignal): Promise<string> => {
      if (cidRef.current) return cidRef.current
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
      })
      if (!res.ok) throw new Error(`Failed to create conversation (${res.status})`)
      const data = (await res.json()) as { conversationId: string }
      cidRef.current = data.conversationId
      setConversationId(data.conversationId)
      return data.conversationId
    },
    [],
  )

  const getConversationId = useCallback(() => cidRef.current, [])

  const registerRoute = useCallback((routeId: string, cid: string) => {
    conversationByRoute.set(routeId, cid)
    // New streaming route overrides any loadedRoute from history hydrate
    setLoadedRoute(null)
  }, [])

  const transport = useMemo(
    () =>
      new AirlineChatTransport({
        ensureConversation,
        getConversationId,
        registerRoute,
      }),
    [ensureConversation, getConversationId, registerRoute],
  )

  const chat: UseChatHelpers<UIMessage<unknown, AirlineDataTypes>> = useChat({
    id: `airline-${chatKey}`,
    transport,
  })

  // Derive route: loadedRoute (from loadConversation) takes precedence
  const messageRoute = useMemo<RouteData | null>(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i]
      if (!msg.parts) continue
      for (const part of msg.parts) {
        if (part.type === 'data-airline-route') {
          return (part as { type: 'data-airline-route'; data: RouteData }).data
        }
      }
    }
    return null
  }, [chat.messages])
  const route = loadedRoute ?? messageRoute

  const errorBar = useMemo(
    () => (chat.error ? chat.error.message ?? 'Unknown error' : null),
    [chat.error],
  )

  const send = useCallback(
    (text: string) => {
      void chat.sendMessage({ text })
    },
    [chat],
  )

  const newConversation = useCallback(() => {
    cidRef.current = null
    setConversationId(null)
    setLoadedRoute(null)
    setChatKey((k) => k + 1)
  }, [])

  const loadConversation = useCallback(
    async (id: string, routeId: string) => {
      const [convRes, routeRes] = await Promise.all([
        fetch(`/api/conversations/${id}`),
        fetch(`/api/routes/${routeId}`),
      ])
      if (!convRes.ok) throw new Error(`Failed to load conversation (${convRes.status})`)
      if (!routeRes.ok) throw new Error(`Failed to load route (${routeRes.status})`)

      const convData = (await convRes.json()) as { messages: unknown[] }
      const routeData = (await routeRes.json()) as RouteData

      cidRef.current = id
      setConversationId(id)
      setLoadedRoute(routeData)
      conversationByRoute.set(routeId, id)

      chat.setMessages(toUIMessages(convData.messages))
    },
    [chat],
  )

  return {
    messages: chat.messages as UIMessage[],
    status: chat.status,
    route,
    errorBar,
    conversationId,
    send,
    stop: chat.stop,
    regenerate: () => void chat.regenerate(),
    newConversation,
    loadConversation,
  }
}

// --- Context ---

const AirlineChatContext = createContext<AirlineChatApi | null>(null)

export function AirlineChatProvider({ children }: { children: React.ReactNode }) {
  const api = useAirlineChat()
  return <AirlineChatContext value={api}>{children}</AirlineChatContext>
}

export function useAirlineChatContext(): AirlineChatApi {
  const ctx = useContext(AirlineChatContext)
  if (!ctx) {
    throw new Error('useAirlineChatContext must be used within AirlineChatProvider')
  }
  return ctx
}

// --- Helpers ---

interface RawBackendMessage {
  id?: string
  role?: string
  content?: unknown
  clarifying?: string[]
  routeId?: string
}

/** Convert raw backend messages to UIMessage[] for history hydrate. */
function toUIMessages(raw: unknown[]): UIMessage[] {
  const out: UIMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const msg = item as RawBackendMessage
    const role = msg.role
    const id = msg.id ?? crypto.randomUUID()

    if (role === 'user') {
      out.push({
        id,
        role: 'user',
        parts: [{ type: 'text', text: extractTextFromContent(msg.content) }],
      })
    } else if (role === 'assistant') {
      const parts: UIMessage['parts'] = []

      const text = extractTextFromContent(msg.content)
      if (text) parts.push({ type: 'text', text })
      if (msg.clarifying?.length) {
        parts.push({
          type: 'data-airline-clarification',
          data: { missing: msg.clarifying },
        } as UIMessage['parts'][number])
      }
      if (msg.routeId) {
        parts.push({
          type: 'data-airline-route',
          data: { routeId: msg.routeId },
        } as UIMessage['parts'][number])
      }

      if (parts.length) out.push({ id, role: 'assistant', parts })
    }
  }
  return out
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: 'text'; text: string } =>
        typeof p === 'object' && p !== null && p.type === 'text',
      )
      .map((p) => p.text)
      .join('')
  }
  return ''
}
