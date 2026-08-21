import { describe, expect, test } from 'bun:test'
import { openDb } from './db'
import { ConversationRepository } from './conversation-repository'

function sampleMessagesJson(): string {
  return JSON.stringify({
    messages: [{ role: 'user', text: '环绕沧海校区巡检一圈，高度 120 米' }],
    toolResults: [{ tool: 'generate_route', ok: true }],
  })
}

describe('ConversationRepository', () => {
  test('create 与 get 全往返，messagesJson 纯 JSON 无损', () => {
    const db = openDb(':memory:')
    const repo = new ConversationRepository(db)
    const messagesJson = sampleMessagesJson()

    const conv = repo.create({ messagesJson })

    expect(conv.id).toBeTruthy()
    expect(conv.createdAt).toBeTruthy()
    expect(conv.updatedAt).toBeTruthy()
    expect(conv.routeId).toBeUndefined()
    expect(conv.messagesJson).toBe(messagesJson)

    const got = repo.get(conv.id)
    expect(got).not.toBeNull()
    expect(got!.id).toBe(conv.id)
    expect(got!.messagesJson).toBe(messagesJson)
    expect(JSON.parse(got!.messagesJson).messages[0].text).toBe('环绕沧海校区巡检一圈，高度 120 米')
    expect(got!.createdAt).toBe(conv.createdAt)
    expect(got!.updatedAt).toBe(conv.updatedAt)

    expect(repo.get('no-such-id')).toBeNull()

    db.close()
  })

  test('updateState 更新 messagesJson 与 routeId 并刷新 updatedAt', async () => {
    const db = openDb(':memory:')
    const repo = new ConversationRepository(db)
    const conv = repo.create({ messagesJson: sampleMessagesJson() })
    await Bun.sleep(2)
    const newJson = JSON.stringify({ messages: [{ role: 'assistant', text: '请补充飞行高度' }] })

    repo.updateState(conv.id, newJson, 'route-1')

    const got = repo.get(conv.id)
    expect(got!.messagesJson).toBe(newJson)
    expect(got!.routeId).toBe('route-1')
    expect(got!.updatedAt > conv.updatedAt).toBe(true)
    expect(got!.createdAt).toBe(conv.createdAt)

    db.close()
  })

  test('findByRoute 返回绑定航线的会话，未绑定返回 null', async () => {
    const db = openDb(':memory:')
    const repo = new ConversationRepository(db)
    const bound = repo.create({ messagesJson: sampleMessagesJson() })
    repo.create({ messagesJson: JSON.stringify({ messages: [] }) })
    await Bun.sleep(2)
    const boundJson = JSON.stringify({ messages: [{ role: 'assistant', text: '航线已生成' }] })
    repo.updateState(bound.id, boundJson, 'route-1')

    const found = repo.findByRoute('route-1')

    expect(found).not.toBeNull()
    expect(found!.id).toBe(bound.id)
    expect(found!.messagesJson).toBe(boundJson)
    expect(found!.routeId).toBe('route-1')

    expect(repo.findByRoute('no-such-route')).toBeNull()

    db.close()
  })
})
