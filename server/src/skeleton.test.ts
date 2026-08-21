import { describe, expect, test } from 'bun:test'
import { DEFAULT_GLOBAL_HEIGHT, NEST_ANCHOR, type Intent } from '@airline-dsl/shared'

describe('server skeleton', () => {
  test('workspace 可消费 @airline-dsl/shared 类型与常量', () => {
    expect(DEFAULT_GLOBAL_HEIGHT).toBe(120)
    expect(NEST_ANCHOR.lat).toBe(22.531635)
  })

  test('Intent 类型可被类型检查消费', () => {
    const intent: Intent = {
      region: '沧海校区',
      shape: 'orbit',
      center: { lat: 22.531635, lng: 113.935066 },
      radiusM: 200,
      heightM: 120,
      speedMps: 15,
      actions: [],
    }
    expect(intent.radiusM).toBe(200)
  })
})
