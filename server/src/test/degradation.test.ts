import { describe, expect, test } from 'bun:test'
import { createModels, fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai'
import type { StreamFn } from '@earendil-works/pi-agent-core'
import { NEST_ANCHOR, type AgentEvent as SharedAgentEvent } from '@airline-dsl/shared'
import { openDb, RouteRepository } from '../store/index.js'
import { createSessionManager } from '../agent/session.js'
import { createGenerateRouteTool } from '../agent/tools.js'
import { parseIntent } from '../intent/index.js'

describe('fallback.parseIntent', () => {
  test('环绕|绕|转圈 关键词解析为 shape=orbit', () => {
    expect(parseIntent('环绕一圈').shape).toBe('orbit')
    expect(parseIntent('绕着飞一圈').shape).toBe('orbit')
    expect(parseIntent('转圈').shape).toBe('orbit')
  })

  test('沧海|校区 关键词解析为 region=沧海校区 且 center=机巢锚点', () => {
    const intent = parseIntent('在沧海校区环绕')
    expect(intent.region).toBe('沧海校区')
    expect(intent.center).toEqual(NEST_ANCHOR)
  })

  test('半径\\s*(\\d+) 解析为 radiusM', () => {
    expect(parseIntent('半径200米').radiusM).toBe(200)
    expect(parseIntent('半径 300').radiusM).toBe(300)
  })

  test('高\\s*(\\d+) 或 (\\d+)米 解析为 heightM', () => {
    expect(parseIntent('高120米').heightM).toBe(120)
    expect(parseIntent('飞行高度 80').heightM).toBe(80)
    expect(parseIntent('环绕100米').heightM).toBe(100)
  })

  test('速度 关键词解析为 speedMps', () => {
    expect(parseIntent('速度5米每秒').speedMps).toBe(5)
  })

  test('拍|拍照|悬停|录像|录制 关键词解析为 actions', () => {
    expect(parseIntent('环绕并拍照').actions).toEqual([{ type: 'takePhoto' }])
    expect(parseIntent('到点悬停').actions).toEqual([{ type: 'hover' }])
    expect(parseIntent('全程录像').actions).toEqual([{ type: 'record' }])
    expect(parseIntent('全程录制').actions).toEqual([{ type: 'record' }])
  })

  test('parseIntent("环绕沧海半径200米高120拍照") 产出完整 Intent', () => {
    const intent = parseIntent('环绕沧海半径200米高120拍照')
    expect(intent.shape).toBe('orbit')
    expect(intent.region).toBe('沧海校区')
    expect(intent.center).toEqual(NEST_ANCHOR)
    expect(intent.radiusM).toBe(200)
    expect(intent.heightM).toBe(120)
    expect(intent.actions).toEqual([{ type: 'takePhoto' }])
  })
})

function createFakeLlm() {
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  const streamFn: StreamFn = (model, context, options) => models.streamSimple(model, context, options)
  return { faux, model: faux.getModel(), streamFn }
}

function setupAgent(store: RouteRepository) {
  const llm = createFakeLlm()
  const manager = createSessionManager({
    systemPrompt: '你是航线编辑助手，负责生成大疆航线。',
    model: llm.model,
    streamFn: llm.streamFn,
    tools: [],
    createRouteTool: () => createGenerateRouteTool({ store }),
    store,
    llmFallbackEnabled: true,
  })
  return { llm, manager }
}

describe('agent 降级', () => {
  test('假 LLM 失败 → 降级事件序列 text_delta→route_generated{aiGenerated:false}→done', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    llm.faux.setResponses([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'API Key 失效' }),
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '环绕沧海半径200米高120速度5拍照', (event) => events.push(event))

    const textDeltaIndex = events.findIndex((event) => event.type === 'text_delta')
    const generatedIndex = events.findIndex((event) => event.type === 'route_generated')
    expect(textDeltaIndex).toBeGreaterThanOrEqual(0)
    expect(generatedIndex).toBeGreaterThan(textDeltaIndex)

    const delta = events[textDeltaIndex]
    if (delta.type === 'text_delta') {
      expect(delta.text).toContain('非 AI 生成')
    }
    const generated = events[generatedIndex]
    if (generated.type === 'route_generated') {
      expect(generated.aiGenerated).toBe(false)
    }
    expect(events[events.length - 1].type).toBe('done')
    expect(events.some((event) => event.type === 'error')).toBe(false)

    db.close()
  })

  test('降级生成的航线同样落库且 aiGenerated=false', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    llm.faux.setResponses([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'API Key 失效' }),
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '环绕沧海半径200米高120速度5拍照', (event) => events.push(event))

    const generated = events.find((event) => event.type === 'route_generated')
    expect(generated).toBeDefined()
    if (generated?.type === 'route_generated') {
      const route = store.get(generated.routeId)
      expect(route).not.toBeNull()
      expect(route!.aiGenerated).toBe(false)
      expect(route!.intent.radiusM).toBe(200)
      expect(route!.intent.heightM).toBe(120)
      expect(route!.content.waypoints.length).toBeGreaterThanOrEqual(3)
    }
    const summary = store.list()
    expect(summary).toHaveLength(1)
    expect(summary[0].aiGenerated).toBe(false)

    db.close()
  })

  test('缺必填参数 → clarification 确定性文案且不发 route 事件', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    llm.faux.setResponses([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: '网络超时' }),
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '帮我绕校区飞一圈', (event) => events.push(event))

    expect(events.some((event) => event.type === 'route_generated')).toBe(false)

    const clarification = events.find((event) => event.type === 'clarification')
    expect(clarification).toBeDefined()
    if (clarification?.type === 'clarification') {
      expect(clarification.missing).toEqual(['radiusM', 'heightM', 'speedMps', 'actions'])
      expect(clarification.text).toContain('当前为非 AI 生成模式，请提供：')
      expect(clarification.text).toContain('环绕半径（米）')
    }
    expect(events[events.length - 1].type).toBe('done')

    db.close()
  })

  test('llmFallbackEnabled=false 时不降级，直接发 error 事件', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const llm = createFakeLlm()
    const manager = createSessionManager({
      systemPrompt: '你是航线编辑助手，负责生成大疆航线。',
      model: llm.model,
      streamFn: llm.streamFn,
      tools: [],
      createRouteTool: () => createGenerateRouteTool({ store }),
      store,
      llmFallbackEnabled: false,
    })
    const handle = manager.createSession()

    llm.faux.setResponses([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'API Key 失效' }),
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '环绕沧海半径200米高120速度5拍照', (event) => events.push(event))

    const errorEvent = events.find((event) => event.type === 'error')
    expect(errorEvent).toBeDefined()
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('llm_error')
      expect(errorEvent.message).toContain('API Key 失效')
    }
    expect(events.some((event) => event.type === 'route_generated')).toBe(false)
    expect(events.some((event) => event.type === 'text_delta')).toBe(false)
    expect(events[events.length - 1].type).toBe('done')
    expect(store.list()).toHaveLength(0)

    db.close()
  })
})
