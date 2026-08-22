import { describe, expect, test } from 'bun:test'
import { openDb, RouteRepository, ConversationRepository } from './index'
import type { Intent, AirlineContent } from '@airline-dsl/shared'

function sampleIntent(): Intent {
  return {
    name: '沧海巡检',
    region: '沧海校区',
    shape: 'orbit',
    center: { lat: 22.531635, lng: 113.935066 },
    radiusM: 200,
    heightM: 120,
    speedMps: 15,
    actions: [{ type: 'takePhoto' }],
  }
}

function sampleContent(): AirlineContent {
  return {
    name: '沧海巡检航线',
    aircraft_model: 'M350',
    takeoff: { lat: 22.531635, lng: 113.935066, altitude: 100 },
    waypoints: [
      {
        lat: 22.531635,
        lng: 113.935066,
        altitude: 120,
        speed: 15,
        heading_mode: 'fixed',
        heading_angle: 0,
        turn_mode: 'clockwise',
        actions: [{ action_type: 'takePhoto', action_params: {} }],
      },
    ],
    global_height: 120,
    global_speed: 15,
    finish_action: 'goHome',
    rth_altitude: 100,
    takeoff_security_height: 20,
    exit_on_rc_lost: 'goContinue',
    altitude_mode: 'relativeToStartPoint',
  }
}

describe('RouteRepository', () => {
  test('create 落库 Route 且 intent/content 中文 JSON 无损返回完整对象', () => {
    const db = openDb(':memory:')
    const repo = new RouteRepository(db)
    const intent = sampleIntent()
    const content = sampleContent()

    const route = repo.create({
      name: '沧海巡检',
      intent,
      content,
      aiGenerated: true,
      status: 'draft',
    })

    expect(route.id).toBeTruthy()
    expect(route.createdAt).toBeTruthy()
    expect(route.updatedAt).toBeTruthy()
    expect(route.name).toBe('沧海巡检')
    expect(route.intent).toEqual(intent)
    expect(route.intent.region).toBe('沧海校区')
    expect(route.content).toEqual(content)
    expect(route.content.name).toBe('沧海巡检航线')
    expect(route.content.aircraft_model).toBe('M350')
    expect(route.aiGenerated).toBe(true)
    expect(route.status).toBe('draft')

    const raw = db
      .query('SELECT intent_json, content_json FROM routes WHERE id = ?')
      .get(route.id) as { intent_json: string; content_json: string }
    expect(JSON.parse(raw.intent_json)).toEqual(intent)
    expect(JSON.parse(raw.content_json)).toEqual(content)
    expect(raw.intent_json).toContain('沧海校区')
    expect(raw.content_json).toContain('沧海巡检航线')

    db.close()
  })

  test('get 反序列化返回完整 Route 且未命中返回 null', () => {
    const db = openDb(':memory:')
    const repo = new RouteRepository(db)
    const created = repo.create({
      name: '沧海巡检',
      intent: sampleIntent(),
      content: sampleContent(),
      aiGenerated: false,
      status: 'draft',
    })

    const got = repo.get(created.id)

    expect(got).not.toBeNull()
    expect(got!.id).toBe(created.id)
    expect(got!.name).toBe('沧海巡检')
    expect(got!.intent).toEqual(sampleIntent())
    expect(got!.content).toEqual(sampleContent())
    expect(got!.aiGenerated).toBe(false)
    expect(got!.status).toBe('draft')
    expect(got!.createdAt).toBe(created.createdAt)
    expect(got!.updatedAt).toBe(created.updatedAt)

    expect(repo.get('no-such-id')).toBeNull()

    db.close()
  })

  test('list 返回 RouteSummary 列表且按创建时间倒序', async () => {
    const db = openDb(':memory:')
    const repo = new RouteRepository(db)
    const older = repo.create({
      name: '路线一',
      intent: sampleIntent(),
      content: sampleContent(),
      aiGenerated: true,
      status: 'draft',
    })
    await Bun.sleep(2)
    const newer = repo.create({
      name: '路线二',
      intent: sampleIntent(),
      content: sampleContent(),
      aiGenerated: false,
      status: 'validated',
    })

    const list = repo.list()

    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({
      id: newer.id,
      name: '路线二',
      aiGenerated: false,
      status: 'validated',
      waypointCount: 1,
      conversationId: undefined,
      createdAt: newer.createdAt,
      updatedAt: newer.updatedAt,
    })
    expect(list[1]).toEqual({
      id: older.id,
      name: '路线一',
      aiGenerated: true,
      status: 'draft',
      waypointCount: 1,
      conversationId: undefined,
      createdAt: older.createdAt,
      updatedAt: older.updatedAt,
    })

    db.close()
  })

  test('update 合并 patch 更新字段并刷新 updatedAt，未命中抛错', () => {
    const db = openDb(':memory:')
    const repo = new RouteRepository(db)
    const created = repo.create({
      name: '沧海巡检',
      intent: sampleIntent(),
      content: sampleContent(),
      aiGenerated: true,
      status: 'draft',
    })

    const updated = repo.update(created.id, {
      status: 'validated',
      gbhRouteId: 'gbh_123',
      aiGenerated: false,
    })

    expect(updated.status).toBe('validated')
    expect(updated.gbhRouteId).toBe('gbh_123')
    expect(updated.aiGenerated).toBe(false)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)

    const got = repo.get(created.id)
    expect(got!.status).toBe('validated')
    expect(got!.gbhRouteId).toBe('gbh_123')
    expect(got!.gbhError).toBeUndefined()
    expect(got!.intent).toEqual(sampleIntent())
    expect(got!.content).toEqual(sampleContent())

    expect(() => repo.update('no-such-id', { status: 'draft' })).toThrow('route not found')

    db.close()
  })

  test('续编链路：航线与会话绑定后可经 findByRoute 与 get 完整恢复', () => {
    const db = openDb(':memory:')
    const routes = new RouteRepository(db)
    const conversations = new ConversationRepository(db)

    const route = routes.create({
      name: '沧海巡检',
      intent: sampleIntent(),
      content: sampleContent(),
      aiGenerated: true,
      status: 'draft',
    })
    const messagesJson = JSON.stringify({
      messages: [
        { role: 'user', text: '环绕沧海校区一圈' },
        { role: 'assistant', text: '航线已生成' },
      ],
    })
    const conv = conversations.create({ messagesJson })
    conversations.updateState(conv.id, messagesJson, route.id)

    const found = conversations.findByRoute(route.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(conv.id)
    expect(found!.routeId).toBe(route.id)

    const restoredRoute = routes.get(route.id)
    const restoredMessages = JSON.parse(found!.messagesJson) as { messages: { role: string; text: string }[] }
    expect(restoredRoute!.content).toEqual(sampleContent())
    expect(restoredMessages.messages).toHaveLength(2)
    expect(restoredMessages.messages[0].text).toBe('环绕沧海校区一圈')
    expect(restoredMessages.messages[1].text).toBe('航线已生成')

    db.close()
  })
})
