import { describe, expect, test } from 'bun:test'
import Type from 'typebox'
import Schema from 'typebox/schema'
import { REQUIRED_INTENT_PARAMS } from '@airline-dsl/shared'
import { intentSchema } from './schema.js'

describe('intentSchema', () => {
  test('required 集合对齐 spec §6.1 与 shared REQUIRED_INTENT_PARAMS', () => {
    expect(intentSchema.required).toEqual([...REQUIRED_INTENT_PARAMS])
  })

  test('properties 覆盖全部 Intent 字段', () => {
    expect(Object.keys(intentSchema.properties)).toEqual([
      'name',
      'region',
      'shape',
      'center',
      'radiusM',
      'count',
      'heightM',
      'speedMps',
      'actions',
      'gimbalPitchDeg',
      'rthAltitudeM',
    ])
  })

  test('actions 允许空数组（无 minItems 限制）', () => {
    const actionsSchema = intentSchema.properties.actions as { minItems?: number; items?: unknown }
    expect(actionsSchema.minItems).toBeUndefined()
    expect(actionsSchema.items).toBeDefined()
  })

  test('空 actions 的完整 Intent 通过编译校验', () => {
    const check = Schema.Compile(intentSchema)
    expect(
      check.Check({
        region: '沧海校区',
        shape: 'orbit',
        center: { lat: 22.531635, lng: 113.935066 },
        radiusM: 200,
        heightM: 120,
        speedMps: 15,
        actions: [],
      }),
    ).toBe(true)
  })

  test('缺少必填字段的 Intent 校验失败', () => {
    const check = Schema.Compile(intentSchema)
    expect(
      check.Check({
        region: '沧海校区',
        shape: 'orbit',
        radiusM: 200,
        actions: [],
      }),
    ).toBe(false)
  })

  test('schema 可生成与 shared Intent 一致的静态类型', () => {
    type StaticIntent = Type.Static<typeof intentSchema>
    const intent: StaticIntent = {
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
