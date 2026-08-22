import type { Api, Model } from '@earendil-works/pi-ai'
import { Agent, uuidv7 } from '@earendil-works/pi-agent-core'
import type { AgentEvent, AgentMessage, AgentTool, StreamFn, ThinkingLevel } from '@earendil-works/pi-agent-core'
import type { AgentEvent as SharedAgentEvent, AirlineContent, Intent } from '@airline-dsl/shared'
import { GENERATE_ROUTE_TOOL, createRouteFromIntent } from './tools.js'
import { applyDefaults, parseIntent, validateIntentParams } from '../intent/index.js'
import type { RouteRepository } from '../store/index.js'
import type { ValidationLimits } from '../airline/index.js'

// pi API 实际签名记录（pi 0.84.2 源码确认）：
// - LLM 通过 AgentOptions.streamFn 构造注入（StreamFn = (model, context, options) => AssistantMessageEventStream）
// - 会话消息经 Agent.state.messages 累积（纯 JSON 可序列化），pi 无内建注入式序列化 API，
//   故 serializeState 自管纯 JSON（systemPrompt/model/thinkingLevel/messages），restoreSession 用 initialState 重放注入
// - 工具定义 AgentTool = { name, description, parameters, label, execute }，execute 内 throw 被
//   agent-loop 编码为 isError:true 的 toolResult 回灌 LLM
// - Agent 事件：message_update 携带 assistantMessageEvent（含 text_delta）；agent_end 为最后事件

const FALLBACK_GENERATED_TEXT = '当前为非 AI 生成，规则引擎生成'
const PARAM_LABELS: Record<string, string> = {
  region: '区域',
  shape: '环绕形状',
  center: '环绕中心',
  radiusM: '环绕半径（米）',
  heightM: '飞行高度（米）',
  speedMps: '飞行速度（米/秒）',
  actions: '拍摄动作',
}

export interface SessionHandle {
  id: string
}

export interface SessionManagerOptions {
  systemPrompt: string
  model: Model<Api>
  streamFn: StreamFn
  tools: AgentTool<any>[]
  store: RouteRepository
  llmFallbackEnabled: boolean
  limits?: ValidationLimits
  createRouteTool?: () => AgentTool<any>
}

export interface SessionManager {
  createSession(): SessionHandle
  restoreSession(messagesJson: string): SessionHandle
  runTurn(handle: SessionHandle, userText: string, onEvent: (event: SharedAgentEvent) => void): Promise<void>
  serializeState(handle: SessionHandle): string
}

interface SessionEntry {
  agent: Agent
}

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const sessions = new Map<string, SessionEntry>()

  function sessionTools(): AgentTool<any>[] {
    return options.createRouteTool ? [...options.tools, options.createRouteTool()] : options.tools
  }

  function createSession(): SessionHandle {
    const agent = new Agent({
      streamFn: options.streamFn,
      initialState: {
        systemPrompt: options.systemPrompt,
        model: options.model,
        tools: sessionTools(),
      },
    })
    return register(agent)
  }

  function restoreSession(messagesJson: string): SessionHandle {
    const parsed: unknown = JSON.parse(messagesJson)
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('非法会话状态 JSON：期望对象')
    }
    const state = parsed as {
      version?: unknown
      systemPrompt?: unknown
      model?: unknown
      thinkingLevel?: unknown
      messages?: unknown
    }
    if (state.version !== 1 || !Array.isArray(state.messages)) {
      throw new Error('非法会话状态 JSON：version/messages 不合法')
    }
    const agent = new Agent({
      streamFn: options.streamFn,
      initialState: {
        systemPrompt: typeof state.systemPrompt === 'string' ? state.systemPrompt : options.systemPrompt,
        model: state.model as Model<Api>,
        thinkingLevel: state.thinkingLevel as ThinkingLevel,
        tools: sessionTools(),
        messages: state.messages as AgentMessage[],
      },
    })
    return register(agent)
  }

  function register(agent: Agent): SessionHandle {
    const handle: SessionHandle = { id: uuidv7() }
    sessions.set(handle.id, { agent })
    return handle
  }

  function getSession(handle: SessionHandle): SessionEntry {
    const entry = sessions.get(handle.id)
    if (!entry) {
      throw new Error(`未知会话 handle: ${handle.id}`)
    }
    return entry
  }

  async function runTurn(handle: SessionHandle, userText: string, onEvent: (event: SharedAgentEvent) => void): Promise<void> {
    const agent = getSession(handle).agent
    let llmFailed = false
    let failureMessage = 'LLM 调用失败'
    const pendingDeltas: string[] = []
    const flushDeltas = () => {
      if (llmFailed) {
        pendingDeltas.length = 0
        return
      }
      for (const text of pendingDeltas) {
        onEvent({ type: 'text_delta', text })
      }
      pendingDeltas.length = 0
    }
    const unsubscribe = agent.subscribe((event) => {
      if (event.type === 'message_update') {
        const streamEvent = event.assistantMessageEvent
        if (streamEvent.type === 'text_delta') {
          pendingDeltas.push(streamEvent.delta)
        }
        return
      }
      if (event.type === 'message_end') {
        const message = event.message
        if (message.role === 'assistant' && message.stopReason === 'error') {
          llmFailed = true
          failureMessage = message.errorMessage ?? 'LLM 调用失败'
          pendingDeltas.length = 0
          return
        }
      }
      if (event.type === 'agent_end' && llmFailed) {
        return
      }
      flushDeltas()
      for (const sharedEvent of toSharedEvents(event, agent)) {
        onEvent(sharedEvent)
      }
    })
    try {
      await agent.prompt(userText)
    } finally {
      unsubscribe()
    }
    if (!llmFailed) {
      return
    }
    if (!options.llmFallbackEnabled) {
      onEvent({ type: 'error', code: 'llm_error', message: failureMessage })
      onEvent({ type: 'done' })
      return
    }
    await runFallback(userText, onEvent)
  }

  async function runFallback(userText: string, onEvent: (event: SharedAgentEvent) => void): Promise<void> {
    const partial = parseIntent(userText)
    const validation = validateIntentParams(partial)
    if (!validation.ok) {
      onEvent({
        type: 'clarification',
        missing: validation.missing,
        text: `当前为非 AI 生成模式，请提供：${validation.missing.map((key) => PARAM_LABELS[key] ?? key).join('、')}`,
      })
      onEvent({ type: 'done' })
      return
    }
    const intent = applyDefaults(partial as Intent)
    const { route, content } = createRouteFromIntent(intent, {
      store: options.store,
      limits: options.limits,
      aiGenerated: false,
    })
    onEvent({ type: 'text_delta', text: FALLBACK_GENERATED_TEXT })
    onEvent({ type: 'route_generated', routeId: route.id, content, intent, aiGenerated: false })
    onEvent({ type: 'done' })
  }

  function serializeState(handle: SessionHandle): string {
    const state = getSession(handle).agent.state
    return JSON.stringify({
      version: 1,
      systemPrompt: state.systemPrompt,
      model: state.model,
      thinkingLevel: state.thinkingLevel,
      messages: state.messages,
    })
  }

  return { createSession, restoreSession, runTurn, serializeState }
}

function toSharedEvents(event: AgentEvent, agent: Agent): SharedAgentEvent[] {
  switch (event.type) {
    case 'message_update': {
      const streamEvent = event.assistantMessageEvent
      if (streamEvent.type === 'text_delta') {
        return [{ type: 'text_delta', text: streamEvent.delta }]
      }
      return []
    }
    case 'message_end': {
      const message = event.message
      if (message.role === 'assistant' && message.stopReason === 'error') {
        return [{ type: 'error', code: 'llm_error', message: message.errorMessage ?? 'LLM 调用失败' }]
      }
      return []
    }
    case 'tool_execution_end': {
      if (event.toolName === GENERATE_ROUTE_TOOL && !event.isError) {
        const details = (event.result as { details?: unknown } | undefined)?.details as
          | { routeId?: string; content?: AirlineContent; intent?: Intent }
          | undefined
        if (details?.routeId && details?.content && details.intent) {
          return [
            {
              type: 'route_generated',
              routeId: details.routeId,
              content: details.content,
              intent: details.intent,
              aiGenerated: true,
            },
          ]
        }
      }
      return []
    }
    case 'agent_end':
      return [{ type: 'done', usage: lastAssistantUsage(agent) }]
    default:
      return []
  }
}

function lastAssistantUsage(agent: Agent): { inputTokens: number; outputTokens: number } | undefined {
  const messages = agent.state.messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'assistant' && message.usage && message.usage.input + message.usage.output > 0) {
      return { inputTokens: message.usage.input, outputTokens: message.usage.output }
    }
  }
  return undefined
}
