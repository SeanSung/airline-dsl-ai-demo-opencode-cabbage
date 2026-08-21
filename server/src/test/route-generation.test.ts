import { describe, expect, test } from 'bun:test'
import { createModels, fauxAssistantMessage, fauxProvider, fauxToolCall } from '@earendil-works/pi-ai'
import type { StreamFn } from '@earendil-works/pi-agent-core'
import type { AgentEvent as SharedAgentEvent } from '@airline-dsl/shared'
import { openDb, RouteRepository } from '../store/index.js'
import { createSessionManager } from '../agent/session.js'
import { createGenerateRouteTool } from '../agent/tools.js'
import { SYSTEM_PROMPT } from '../agent/system-prompt.js'

const FULL_INTENT_ARGS = {
  region: '沧海校区',
  shape: 'orbit',
  center: { lat: 22.531635, lng: 113.935066 },
  radiusM: 200,
  heightM: 120,
  speedMps: 5,
  actions: [{ type: 'takePhoto' }],
}

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
    systemPrompt: SYSTEM_PROMPT,
    model: llm.model,
    streamFn: llm.streamFn,
    tools: [],
    createRouteTool: () => createGenerateRouteTool({ store }),
    store,
    llmFallbackEnabled: true,
  })
  return { llm, manager }
}

describe('route-generation', () => {
  test('参数齐备时一轮对话产出 route_generated 并落库 draft+aiGenerated', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    llm.faux.setResponses([
      fauxAssistantMessage([fauxToolCall('generate_route', FULL_INTENT_ARGS)]),
      fauxAssistantMessage('航线已生成'),
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '环绕沧海校区一圈，半径200米，高120米，速度5米每秒，拍照', (event) => events.push(event))

    const generated = events.find((event) => event.type === 'route_generated')
    expect(generated).toBeDefined()
    if (generated?.type === 'route_generated') {
      expect(generated.aiGenerated).toBe(true)
      expect(generated.content.waypoints.length).toBeGreaterThanOrEqual(3)
      expect(generated.routeId).toBeTruthy()

      const route = store.get(generated.routeId)
      expect(route).not.toBeNull()
      expect(route!.status).toBe('draft')
      expect(route!.aiGenerated).toBe(true)
      expect(route!.intent.radiusM).toBe(200)
      expect(route!.intent.heightM).toBe(120)
      expect(route!.content.waypoints.length).toBe(generated.content.waypoints.length)
    }

    const textDeltas = events.filter((event) => event.type === 'text_delta')
    expect(textDeltas.length).toBeGreaterThan(0)
    expect(events[events.length - 1].type).toBe('done')

    db.close()
  })

  test('缺参被 isError 回灌 → LLM 追问 → 补参后 route_generated 且不丢已有参数', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    let errorToolResult: unknown = null
    llm.faux.setResponses([
      fauxAssistantMessage([
        fauxToolCall('generate_route', {
          region: '沧海校区',
          shape: 'orbit',
          center: { lat: 22.531635, lng: 113.935066 },
          radiusM: 200,
        }),
      ]),
      (context) => {
        errorToolResult = context.messages[context.messages.length - 1]
        return fauxAssistantMessage('请补充飞行高度')
      },
    ])

    const firstRound: SharedAgentEvent[] = []
    await manager.runTurn(handle, '绕沧海校区半径200米环绕', (event) => firstRound.push(event))
    expect(firstRound.some((event) => event.type === 'route_generated')).toBe(false)

    const toolResult = errorToolResult as {
      role: string
      isError: boolean
      content: { text: string }[]
    }
    expect(toolResult.role).toBe('toolResult')
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content[0].text).toContain('heightM')
    expect(toolResult.content[0].text).toContain('speedMps')

    const secondRound: SharedAgentEvent[] = []
    llm.faux.setResponses([
      fauxAssistantMessage([
        fauxToolCall('generate_route', {
          heightM: 120,
          speedMps: 5,
          actions: [{ type: 'takePhoto' }],
        }),
      ]),
      fauxAssistantMessage('航线已生成'),
    ])
    await manager.runTurn(handle, '高度120米，速度5米每秒，拍个照', (event) => secondRound.push(event))

    const generated = secondRound.find((event) => event.type === 'route_generated')
    expect(generated).toBeDefined()
    if (generated?.type === 'route_generated') {
      expect(generated.aiGenerated).toBe(true)
      expect(generated.content.takeoff.lat).toBeCloseTo(22.531635, 5)
      expect(generated.content.takeoff.lng).toBeCloseTo(113.935066, 5)
      expect(generated.content.waypoints[0].altitude).toBe(120)

      const route = store.get(generated.routeId)
      expect(route).not.toBeNull()
      expect(route!.intent.center).toEqual({ lat: 22.531635, lng: 113.935066 })
      expect(route!.intent.radiusM).toBe(200)
      expect(route!.intent.heightM).toBe(120)
      expect(route!.intent.speedMps).toBe(5)
    }
    expect(secondRound[secondRound.length - 1].type).toBe('done')

    db.close()
  })

  test('AirlineValidationError 编码 isError 回灌且错误带字段路径', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    let validationToolResult: unknown = null
    llm.faux.setResponses([
      fauxAssistantMessage([fauxToolCall('generate_route', { ...FULL_INTENT_ARGS, heightM: 99999 })]),
      (context) => {
        validationToolResult = context.messages[context.messages.length - 1]
        return fauxAssistantMessage('高度超出上限，请降低高度')
      },
    ])

    const events: SharedAgentEvent[] = []
    await manager.runTurn(handle, '高度99999米', (event) => events.push(event))

    expect(events.some((event) => event.type === 'route_generated')).toBe(false)

    const toolResult = validationToolResult as {
      role: string
      isError: boolean
      content: { text: string }[]
    }
    expect(toolResult.role).toBe('toolResult')
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content[0].text).toContain('waypoints')
    expect(toolResult.content[0].text).toContain('altitude')

    const routes = store.list()
    expect(routes).toHaveLength(0)

    db.close()
  })

  test('system prompt 定义领域角色、澄清协议与生成协议', async () => {
    const db = openDb(':memory:')
    const store = new RouteRepository(db)
    const { llm, manager } = setupAgent(store)
    const handle = manager.createSession()

    let observedSystemPrompt = ''
    llm.faux.setResponses([
      (context) => {
        observedSystemPrompt = context.systemPrompt ?? ''
        return fauxAssistantMessage('你好，我是航线编辑助手')
      },
    ])

    await manager.runTurn(handle, '你好', () => {})

    expect(observedSystemPrompt).toContain('航线')
    expect(observedSystemPrompt).toContain('每次只追问一个缺失项')
    expect(observedSystemPrompt).toContain('generate_route')

    db.close()
  })
})
