import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AirlineContent } from '@airline-dsl/shared'
import type { SessionHandle, SessionManager } from '../agent/session.js'
import type { ConversationRepository, RouteRepository } from '../store/index.js'
import { submitRoute as defaultSubmitRoute, type SubmitResult, type SubmitRouteOptions } from '../gbh/index.js'

export interface HttpDeps {
  sessionManager: SessionManager
  routes: RouteRepository
  conversations: ConversationRepository
  gbhBaseUrl: string
  tiandituToken: string
  submitRoute?: (content: AirlineContent, opts: SubmitRouteOptions) => Promise<SubmitResult>
}

export function createApp(deps: HttpDeps): Hono {
  const app = new Hono()
  const sessions = new Map<string, SessionHandle>()

  app.post('/api/conversations', (c) => {
    const handle = deps.sessionManager.createSession()
    sessions.set(handle.id, handle)
    deps.conversations.create({ messagesJson: deps.sessionManager.serializeState(handle), routeId: undefined }, handle.id)
    return c.json({ conversationId: handle.id }, 201)
  })

  app.post('/api/conversations/:id/messages', async (c) => {
    const id = c.req.param('id')
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: { code: 'invalid_request', message: '请求体必须是合法 JSON' } }, 400)
    }
    const text = (body as { text?: unknown } | null)?.text
    if (typeof text !== 'string' || text.trim() === '') {
      return c.json({ error: { code: 'invalid_request', message: 'text 字段必填且为非空字符串' } }, 400)
    }
    const conversation = deps.conversations.get(id)
    if (!conversation) {
      return c.json({ error: { code: 'not_found', message: `会话不存在：${id}` } }, 404)
    }
    const handle = sessions.get(id) ?? deps.sessionManager.restoreSession(conversation.messagesJson)
    sessions.set(id, handle)
    return streamSSE(c, async (stream) => {
      let routeId: string | undefined
      await deps.sessionManager.runTurn(handle, text, (event) => {
        if (event.type === 'route_generated') {
          routeId = event.routeId
        }
        stream.write(`data: ${JSON.stringify(event)}\n\n`)
      })
      deps.conversations.updateState(id, deps.sessionManager.serializeState(handle), routeId ?? null)
    })
  })

  app.get('/api/conversations/:id', (c) => {
    const id = c.req.param('id')
    const conversation = deps.conversations.get(id)
    if (!conversation) {
      return c.json({ error: { code: 'not_found', message: `会话不存在：${id}` } }, 404)
    }
    const state = JSON.parse(conversation.messagesJson) as { messages: unknown }
    return c.json({ id: conversation.id, routeId: conversation.routeId, messages: state.messages })
  })

  app.get('/api/routes', (c) => {
    const summaries = deps.routes.list()
    return c.json(
      summaries.map((summary) => ({
        ...summary,
        waypointCount: deps.routes.get(summary.id)?.content.waypoints.length ?? 0,
      })),
    )
  })

  app.get('/api/routes/:id', (c) => {
    const id = c.req.param('id')
    const route = deps.routes.get(id)
    if (!route) {
      return c.json({ error: { code: 'not_found', message: `航线不存在：${id}` } }, 404)
    }
    return c.json({
      content: route.content,
      intent: route.intent,
      aiGenerated: route.aiGenerated,
      status: route.status,
      gbhRouteId: route.gbhRouteId,
      gbhError: route.gbhError,
    })
  })

  app.post('/api/routes/:id/submit-gbh', async (c) => {
    const id = c.req.param('id')
    const route = deps.routes.get(id)
    if (!route) {
      return c.json({ error: { code: 'not_found', message: `航线不存在：${id}` } }, 404)
    }
    const submit = deps.submitRoute ?? defaultSubmitRoute
    const result = await submit(route.content, { baseUrl: deps.gbhBaseUrl })
    if (result.status === 'ok') {
      deps.routes.update(id, { status: 'validated', gbhRouteId: result.routeId, gbhError: undefined })
      return c.json({ status: 'ok', gbhRouteId: result.routeId })
    }
    if (result.status === 'invalid') {
      return c.json({ status: 'invalid', errors: result.errors })
    }
    return c.json({ status: 'error', message: result.message })
  })

  app.get('/api/map-token', (c) => {
    return c.json({ token: deps.tiandituToken })
  })

  app.notFound((c) => {
    return c.json({ error: { code: 'not_found', message: `接口不存在：${c.req.path}` } }, 404)
  })

  app.onError((err, c) => {
    return c.json({ error: { code: 'internal_error', message: err instanceof Error ? err.message : String(err) } }, 500)
  })

  return app
}
