import { describe, expect, test } from 'bun:test'
import { createModels, fauxAssistantMessage, fauxProvider, fauxToolCall } from '@earendil-works/pi-ai'
import type { AgentTool, StreamFn } from '@earendil-works/pi-agent-core'
import { Type } from 'typebox'
import type { AgentEvent as SharedAgentEvent } from '@airline-dsl/shared'
import { loadConfig } from '../config.js'
import { openDb, RouteRepository } from '../store/index.js'
import { MissingIntentParamsError } from './errors.js'
import { createSessionManager } from './session.js'

const VALID_ENV = {
  DB_PATH: '/tmp/airline.db',
  GBH_BASE_URL: 'http://localhost:5175',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_API_KEY: 'sk-test',
  DEEPSEEK_MODEL: 'deepseek-chat',
  TIANDITU_TOKEN: 'tok',
  LLM_FALLBACK_ENABLED: 'true',
  HEIGHT_LIMIT_M: '500',
}

describe('config', () => {
  test('loadConfig 在缺失 DEEPSEEK_API_KEY 时抛错', () => {
    const env = { ...VALID_ENV }
    delete env.DEEPSEEK_API_KEY
    expect(() => loadConfig(env)).toThrow()
  })

  test('loadConfig 拒绝非法环境变量值', () => {
    expect(() => loadConfig({ ...VALID_ENV, LLM_FALLBACK_ENABLED: 'maybe' })).toThrow()
    expect(() => loadConfig({ ...VALID_ENV, HEIGHT_LIMIT_M: 'abc' })).toThrow()
    expect(() => loadConfig({ ...VALID_ENV, HEIGHT_LIMIT_M: '-5' })).toThrow()
  })

  test('loadConfig 解析合法环境变量为完整 AppConfig', () => {
    const config = loadConfig(VALID_ENV)
    expect(config).toEqual({
      dbPath: '/tmp/airline.db',
      gbhBaseUrl: 'http://localhost:5175',
      deepseek: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      },
      tiandituToken: 'tok',
      llmFallbackEnabled: true,
      heightLimitM: 500,
    })
  })
})

function createFakeLlm() {
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  const streamFn: StreamFn = (model, context, options) => models.streamSimple(model, context, options)
  return { faux, model: faux.getModel(), streamFn }
}

const testTool: AgentTool = {
  name: 'test_tool',
  description: '最小测试工具，执行时必然抛错以验证 pi 错误编码',
  label: '测试工具',
  parameters: Type.Object({ value: Type.String() }),
  execute: async () => {
    throw new MissingIntentParamsError(['radiusM'])
  },
}

describe('session', () => {
  test('runTurn 注入假 LLM 收到 text_delta→done 合法序列', async () => {
    const llm = createFakeLlm()
    llm.faux.setResponses([fauxAssistantMessage('你好，我是航线编辑助手')])

    const db = openDb(':memory:')
    const manager = createSessionManager({
      systemPrompt: '你是航线编辑助手，负责生成大疆航线。',
      model: llm.model,
      streamFn: llm.streamFn,
      tools: [],
      store: new RouteRepository(db),
      llmFallbackEnabled: true,
    })
    const handle = manager.createSession()

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '你好', (event) => events.push(event))

    expect(events.length).toBeGreaterThan(1)
    const textDeltas = events.filter((event) => event.type === 'text_delta')
    expect(textDeltas.length).toBeGreaterThan(0)
    expect(events[events.length - 1].type).toBe('done')
    db.close()
  })

  test('serializeState 纯 JSON 且 restoreSession 后带完整历史继续对话', async () => {
    const llm = createFakeLlm()
    const db = openDb(':memory:')
    const manager = createSessionManager({
      systemPrompt: '你是航线编辑助手。',
      model: llm.model,
      streamFn: llm.streamFn,
      tools: [],
      store: new RouteRepository(db),
      llmFallbackEnabled: true,
    })

    llm.faux.setResponses([fauxAssistantMessage('已收到第一轮')])
    const handle = manager.createSession()
    await manager.runTurn(handle, '第一轮问题', () => {})

    const json = manager.serializeState(handle)
    const parsed = JSON.parse(json)
    expect(parsed.messages.length).toBe(2)
    expect(parsed.messages[0].role).toBe('user')
    expect(parsed.messages[1].role).toBe('assistant')

    const restored = manager.restoreSession(json)

    let observedMessages: unknown = null
    llm.faux.setResponses([
      (context) => {
        observedMessages = context.messages
        return fauxAssistantMessage('已收到第二轮')
      },
    ])
    await manager.runTurn(restored, '第二轮问题', () => {})

    const secondTurnMessages = observedMessages as {
      role: string
      content: string | { text: string }[]
    }[]
    expect(secondTurnMessages.length).toBe(3)
    expect(secondTurnMessages[0].role).toBe('user')
    const firstUserContent = secondTurnMessages[0].content as { text: string }[]
    expect(firstUserContent[0].text).toBe('第一轮问题')
    expect(secondTurnMessages[1].role).toBe('assistant')
    expect((secondTurnMessages[1].content[0] as { text: string }).text).toContain('已收到第一轮')

    const json2 = manager.serializeState(restored)
    expect(JSON.parse(json2).messages.length).toBe(4)
  })

  test('test_tool 抛错被编码为 isError:true toolResult 回灌 LLM', async () => {
    const llm = createFakeLlm()
    const db = openDb(':memory:')
    const manager = createSessionManager({
      systemPrompt: '你是航线编辑助手。',
      model: llm.model,
      streamFn: llm.streamFn,
      tools: [testTool],
      store: new RouteRepository(db),
      llmFallbackEnabled: true,
    })
    const handle = manager.createSession()

    let observedLast: unknown = null
    llm.faux.setResponses([
      fauxAssistantMessage([fauxToolCall('test_tool', { value: 'x' })]),
      (context) => {
        observedLast = context.messages[context.messages.length - 1]
        return fauxAssistantMessage('请补充 radiusM')
      },
    ])

    await manager.runTurn(handle, '调用测试工具', () => {})

    const toolResult = observedLast as {
      role: string
      isError: boolean
      content: { text: string }[]
    }
    expect(toolResult.role).toBe('toolResult')
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content[0].text).toContain('radiusM')

    const state = JSON.parse(manager.serializeState(handle))
    const toolResultMessages = state.messages.filter((message: { role: string }) => message.role === 'toolResult')
    expect(toolResultMessages.length).toBe(1)
    expect(toolResultMessages[0].isError).toBe(true)
  })
})
