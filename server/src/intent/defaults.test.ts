import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_COUNT,
  DEFAULT_GIMBAL_PITCH_DEG,
  DEFAULT_REGION,
  DEFAULT_RTH_ALTITUDE_M,
  NEST_ANCHOR,
  type Intent,
} from '@airline-dsl/shared'
import { applyDefaults } from './defaults.js'

function baseIntent(): Intent {
  return {
    region: '沧海校区',
    shape: 'orbit',
    center: { lat: 22.531635, lng: 113.935066 },
    radiusM: 200,
    heightM: 120,
    speedMps: 15,
    actions: [],
  }
}

describe('applyDefaults', () => {
  test('补齐 count/gimbalPitchDeg/rthAltitudeM 默认值', () => {
    const result = applyDefaults(baseIntent())
    expect(result.count).toBe(DEFAULT_COUNT)
    expect(result.gimbalPitchDeg).toBe(DEFAULT_GIMBAL_PITCH_DEG)
    expect(result.rthAltitudeM).toBe(DEFAULT_RTH_ALTITUDE_M)
  })

  test('name 自动生成为 沧海校区-环绕-<timestamp>', () => {
    const result = applyDefaults(baseIntent())
    expect(result.name).toMatch(/^沧海校区-环绕-\d+$/)
  })

  test('region/center 缺失时默认沧海校区/机巢锚点', () => {
    const partial: Partial<Intent> = baseIntent()
    delete partial.region
    delete partial.center
    const result = applyDefaults(partial as Intent)
    expect(result.region).toBe(DEFAULT_REGION)
    expect(result.center).toEqual(NEST_ANCHOR)
  })

  test('已提供字段不被默认值覆盖', () => {
    const intent = baseIntent()
    intent.name = '自定义航线'
    intent.count = 16
    intent.gimbalPitchDeg = -45
    intent.rthAltitudeM = 50
    const result = applyDefaults(intent)
    expect(result.name).toBe('自定义航线')
    expect(result.count).toBe(16)
    expect(result.gimbalPitchDeg).toBe(-45)
    expect(result.rthAltitudeM).toBe(50)
  })

  test('不修改输入对象（纯函数）', () => {
    const intent = baseIntent()
    applyDefaults(intent)
    expect(intent.count).toBeUndefined()
    expect(intent.name).toBeUndefined()
  })
})
