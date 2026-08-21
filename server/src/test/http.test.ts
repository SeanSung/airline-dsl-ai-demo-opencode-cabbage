import { describe, expect, test } from 'bun:test'
import type { AgentEvent as SharedAgentEvent, AirlineContent } from '@airline-dsl/shared'
import { openDb, RouteRepository, ConversationRepository } from '../store/index.js'
import { createApp } from '../http/app.js'
import type { SessionHandle, SessionManager } from '../agent/session.js'
import type { SubmitResult } from '../gbh/index.js'

const FAKE_CONTENT: AirlineContent = {
  name: '沧海校区-环绕-1',
  aircraft_model: 'M350',
  takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
  waypoints: [
    {
      lat: 22.532,
      lng: 113.935,
      altitude: 120,
      speed: 15,
      heading_mode: 'fixed',
      heading_angle: 0,
      turn_mode: 'clockwise',
      actions: [],
    },
    {
      lat: 22.531,
      lng: 113.936,
      altitude: 120,
      speed: 15,
      heading_mode: 'fixed',
      heading_angle: 0,
      turn_mode: 'clockwise',
      actions: [],
    },
    {
      lat: 22.531,
      lng: 113.934,
      altitude: 120,
      speed: 15,
      heading_mode: 'fixed',
      heading_angle: 0,
      turn_mode: 'clockwise',
      actions: [],
    },
  ],
  global_height: 120,
  global_speed: 15,
  finish_action: 'goHome',
  rth_altitude: 100,
  takeoff_security_height: 50,
  exit_on_rc_lost: 'goContinue',
  altitude_mode: 'relativeToStartPoint',
}

class FakeSessionManager implements SessionManager {
  events: SharedAgentEvent[] = []

  createSession(): SessionHandle {
    return { id: 'fake-session-1' }
  }

  restoreSession(_messagesJson: string): SessionHandle {
    return { id: 'fake-session-1' }
  }

  async runTurn(_handle: SessionHandle, _userText: string, onEvent: (event: SharedAgentEvent) => void): Promise<void> {
    for (const event of this.events) {
      onEvent(event)
    }
  }

  serializeState(_handle: SessionHandle): string {
    return JSON.stringify({
      version: 1,
      systemPrompt: '你是大疆航线编辑助手',
      model: { id: 'fake', provider: 'faux', api: 'openai-completions', baseUrl: 'http://x', name: 'fake' },
      thinkingLevel: 'none',
      messages: [
        { role: 'user', content: [{ type: 'text', text: '第一轮问题' }] },
        { role: 'assistant', content: [{ type: 'text', text: '航线已生成' }] },
      ],
    })
  }
}

interface TestEnv {
  db: ReturnType<typeof openDb>
  routes: RouteRepository
  conversations: ConversationRepository
  sessionManager: FakeSessionManager
  app: ReturnType<typeof createApp>
}

function setup(overrides: { events?: SharedAgentEvent[]; submitRoute?: (content: AirlineContent) => Promise<SubmitResult> } = {}): TestEnv {
  const db = openDb(':memory:')
  const routes = new RouteRepository(db)
  const conversations = new ConversationRepository(db)
  const sessionManager = new FakeSessionManager()
  sessionManager.events = overrides.events ?? []
  const app = createApp({
    sessionManager,
    routes,
    conversations,
    gbhBaseUrl: 'http://gbh.test',
    tiandituToken: 'test-token',
    submitRoute: overrides.submitRoute,
  })
  return { db, routes, conversations, sessionManager, app }
}

function parseSSE(text: string): SharedAgentEvent[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const line = block.split('\n').find((l) => l.startsWith('data: '))
      if (!line) throw new Error(`非法 SSE 块：${block}`)
      return JSON.parse(line.slice('data: '.length)) as SharedAgentEvent
    })
}

describe('http api', () => {
  test('POST /api/conversations 返回 201 与 conversationId', async () => {
    const { app, conversations } = setup()

    const res = await app.request('/api/conversations', { method: 'POST' })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { conversationId: string }
    expect(body.conversationId).toBeTruthy()
    expect(conversations.get(body.conversationId)).not.toBeNull()
  })

  test('POST /api/conversations/:id/messages 返回 SSE 流且事件序列合法（text_delta→route_generated→done）', async () => {
    const { app, conversations } = setup({
      events: [
        { type: 'text_delta', text: '正在生成环绕航线' },
        { type: 'route_generated', routeId: 'r-1', content: FAKE_CONTENT, aiGenerated: true },
        { type: 'text_delta', text: '已生成' },
        { type: 'done' },
      ],
    })
    const created = await app.request('/api/conversations', { method: 'POST' })
    const { conversationId } = (await created.json()) as { conversationId: string }

    const res = await app.request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '环绕沧海校区一圈' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const events = parseSSE(await res.text())
    expect(events.map((event) => event.type)).toEqual(['text_delta', 'route_generated', 'text_delta', 'done'])
    const generated = events[1]
    if (generated?.type === 'route_generated') {
      expect(generated.routeId).toBe('r-1')
      expect(generated.aiGenerated).toBe(true)
      expect(generated.content.waypoints.length).toBe(3)
    }
    expect(conversations.get(conversationId)?.routeId).toBe('r-1')
  })

  test('GET /api/conversations/:id 返回会话对象（含 messages）', async () => {
    const { app } = setup()
    const created = await app.request('/api/conversations', { method: 'POST' })
    const { conversationId } = (await created.json()) as { conversationId: string }

    const res = await app.request(`/api/conversations/${conversationId}`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; routeId?: string; messages: { role: string }[] }
    expect(body.id).toBe(conversationId)
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[1].role).toBe('assistant')
  })

  test('GET /api/conversations/:id 不存在时返回 404 与统一错误体', async () => {
    const { app } = setup()

    const res = await app.request('/api/conversations/no-such-conversation')

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('not_found')
    expect(typeof body.error.message).toBe('string')
  })

  test('GET /api/routes 返回 RouteSummary 列表（含 waypointCount）', async () => {
    const { app, routes } = setup()
    routes.create({
      name: '沧海校区-环绕-1',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [{ type: 'takePhoto' }],
      },
      content: FAKE_CONTENT,
      aiGenerated: true,
      status: 'draft',
    })

    const res = await app.request('/api/routes')

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      id: string
      name: string
      status: string
      aiGenerated: boolean
      waypointCount: number
      createdAt: string
    }[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBeTruthy()
    expect(body[0].name).toBe('沧海校区-环绕-1')
    expect(body[0].status).toBe('draft')
    expect(body[0].aiGenerated).toBe(true)
    expect(body[0].waypointCount).toBe(3)
    expect(typeof body[0].createdAt).toBe('string')
  })

  test('GET /api/routes/:id 返回 RouteDetail（含 gbhRouteId 透传）；不存在返回 404', async () => {
    const { app, routes } = setup()
    const created = routes.create({
      name: '沧海校区-环绕-1',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      },
      content: FAKE_CONTENT,
      aiGenerated: false,
      status: 'draft',
    })
    routes.update(created.id, { status: 'validated', gbhRouteId: 'gbh-abc' })

    const res = await app.request(`/api/routes/${created.id}`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      content: AirlineContent
      intent: { radiusM: number }
      aiGenerated: boolean
      status: string
      gbhRouteId?: string
      gbhError?: string
    }
    expect(body.content.waypoints).toHaveLength(3)
    expect(body.intent.radiusM).toBe(200)
    expect(body.aiGenerated).toBe(false)
    expect(body.status).toBe('validated')
    expect(body.gbhRouteId).toBe('gbh-abc')

    const missing = await app.request('/api/routes/no-such-route')
    expect(missing.status).toBe(404)
    const errorBody = (await missing.json()) as { error: { code: string } }
    expect(errorBody.error.code).toBe('not_found')
  })

  test('POST /api/routes/:id/submit-gbh 三态透传，ok 时更新 route 状态', async () => {
    const okEnv = setup({ submitRoute: async () => ({ status: 'ok', routeId: 'gbh-ok' }) })
    const okRoute = okEnv.routes.create({
      name: 'r-ok',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      },
      content: FAKE_CONTENT,
      aiGenerated: true,
      status: 'draft',
    })
    const okRes = await okEnv.app.request(`/api/routes/${okRoute.id}/submit-gbh`, { method: 'POST' })
    expect(okRes.status).toBe(200)
    expect(await okRes.json()).toEqual({ status: 'ok', gbhRouteId: 'gbh-ok' })
    const stored = okEnv.routes.get(okRoute.id)
    expect(stored?.status).toBe('validated')
    expect(stored?.gbhRouteId).toBe('gbh-ok')

    const invalidEnv = setup({ submitRoute: async () => ({ status: 'invalid', errors: [{ path: 'waypoints', message: '航点数不足' }] }) })
    const invalidRoute = invalidEnv.routes.create({
      name: 'r-invalid',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      },
      content: FAKE_CONTENT,
      aiGenerated: true,
      status: 'draft',
    })
    const invalidRes = await invalidEnv.app.request(`/api/routes/${invalidRoute.id}/submit-gbh`, { method: 'POST' })
    expect(invalidRes.status).toBe(200)
    expect(await invalidRes.json()).toEqual({ status: 'invalid', errors: [{ path: 'waypoints', message: '航点数不足' }] })

    const errorEnv = setup({ submitRoute: async () => ({ status: 'error', message: 'GBH 平台不可达' }) })
    const errorRoute = errorEnv.routes.create({
      name: 'r-error',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      },
      content: FAKE_CONTENT,
      aiGenerated: true,
      status: 'draft',
    })
    const errorRes = await errorEnv.app.request(`/api/routes/${errorRoute.id}/submit-gbh`, { method: 'POST' })
    expect(errorRes.status).toBe(200)
    expect(await errorRes.json()).toEqual({ status: 'error', message: 'GBH 平台不可达' })

    const missing = await setup().app.request('/api/routes/no-such-route/submit-gbh', { method: 'POST' })
    expect(missing.status).toBe(404)
    const errorBody = (await missing.json()) as { error: { code: string } }
    expect(errorBody.error.code).toBe('not_found')
  })

  test('GET /api/map-token 返回服务端下发的 token', async () => {
    const { app } = setup()

    const res = await app.request('/api/map-token')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string }
    expect(body.token).toBe('test-token')
  })

  test('请求体校验失败返回 400，未知路径返回 404，内部错误返回 500，均统一错误体', async () => {
    const { app } = setup()
    const created = await app.request('/api/conversations', { method: 'POST' })
    const { conversationId } = (await created.json()) as { conversationId: string }

    const badJson = await app.request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    expect(badJson.status).toBe(400)
    expect((await badJson.json()) as { error: { code: string } }).toEqual({ error: { code: 'invalid_request', message: expect.any(String) } })

    const missingText = await app.request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(missingText.status).toBe(400)
    expect(((await missingText.json()) as { error: { code: string } }).error.code).toBe('invalid_request')

    const unknownRoute = await app.request('/api/unknown-path')
    expect(unknownRoute.status).toBe(404)
    expect(((await unknownRoute.json()) as { error: { code: string } }).error.code).toBe('not_found')

    const crashEnv = setup({ submitRoute: async () => Promise.reject(new Error('内部故障')) })
    const crashRoute = crashEnv.routes.create({
      name: 'r-crash',
      intent: {
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      },
      content: FAKE_CONTENT,
      aiGenerated: true,
      status: 'draft',
    })
    const internalError = await crashEnv.app.request(`/api/routes/${crashRoute.id}/submit-gbh`, { method: 'POST' })
    expect(internalError.status).toBe(500)
    expect(((await internalError.json()) as { error: { code: string } }).error.code).toBe('internal_error')
  })
})
