import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AirlineContent } from '@airline-dsl/shared'

export interface RouteData {
  routeId: string
  content: AirlineContent
  aiGenerated: boolean
}

export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; clarifying: string[] }
  | { id: number; role: 'error'; text: string }

export interface ChatState {
  messages: ChatMessage[]
  route: RouteData | null
  streaming: boolean
  errorBar: string | null
}

export type ChatAction =
  | { type: 'send'; text: string }
  | { type: 'stream_start' }
  | { type: 'stream_delta'; text: string }
  | { type: 'clarification'; missing: string[]; text?: string }
  | { type: 'route_generated'; routeId: string; content: AirlineContent; aiGenerated: boolean }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'reset' }
  | { type: 'hydrate'; messages: ChatMessage[]; route: RouteData | null }

export type Dispatch = (action: ChatAction) => void

let counter = 0

export function createChatState(): ChatState {
  return { messages: [], route: null, streaming: false, errorBar: null }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send': {
      counter += 1
      return {
        ...state,
        messages: [...state.messages, { id: counter, role: 'user', text: action.text }],
        streaming: true,
        errorBar: null,
      }
    }
    case 'stream_start': {
      counter += 1
      return {
        ...state,
        messages: [...state.messages, { id: counter, role: 'assistant', text: '', clarifying: [] }],
        streaming: true,
      }
    }
    case 'stream_delta': {
      const last = state.messages[state.messages.length - 1]
      if (last && last.role === 'assistant' && last.clarifying.length === 0) {
        const messages = [...state.messages.slice(0, -1), { ...last, text: last.text + action.text }]
        return { ...state, messages }
      }
      return state
    }
    case 'clarification': {
      counter += 1
      const text = action.text ?? `待补充参数：${action.missing.join('、')}`
      return {
        ...state,
        messages: [...state.messages, { id: counter, role: 'assistant', text, clarifying: action.missing }],
        streaming: false,
      }
    }
    case 'route_generated':
      return {
        ...state,
        route: { routeId: action.routeId, content: action.content, aiGenerated: action.aiGenerated },
        streaming: false,
      }
    case 'error':
      return { ...state, errorBar: action.message, streaming: false }
    case 'done':
      return { ...state, streaming: false }
    case 'reset':
      return createChatState()
    case 'hydrate':
      return { messages: action.messages, route: action.route, streaming: false, errorBar: null }
    default:
      return state
  }
}

interface ChatContextValue {
  state: ChatState
  dispatch: Dispatch
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, undefined, createChatState)
  return <ChatContext.Provider value={{ state, dispatch }}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
