import { describe, expect, test } from 'bun:test'
import { REQUIRED_INTENT_PARAMS, type Intent } from '@airline-dsl/shared'
import { validateIntentParams } from './validate.js'
import { requiredIntentParams } from './index.js'

describe('validateIntentParams', () => {
  test('空 partial 返回全部 required 缺失字段', () => {
    expect(validateIntentParams({})).toEqual({ ok: false, missing: [...REQUIRED_INTENT_PARAMS] })
  })

  test('缺 radiusM/heightM 时 missing 清单确定性可断言（region/center 有默认值不追问）', () => {
    const result = validateIntentParams({
      shape: 'orbit',
      center: { lat: 22.531635, lng: 113.935066 },
      speedMps: 15,
      actions: [],
    })
    expect(result).toEqual({ ok: false, missing: ['radiusM', 'heightM'] })
  })

  test('完整 partial 返回 ok: true', () => {
    const result = validateIntentParams({
      region: '沧海校区',
      shape: 'orbit',
      center: { lat: 22.531635, lng: 113.935066 },
      radiusM: 200,
      heightM: 120,
      speedMps: 15,
      actions: [],
    })
    expect(result).toEqual({ ok: true })
  })

  test('显式 undefined 字段视为缺失', () => {
    const partial: Partial<Intent> = { radiusM: undefined }
    const result = validateIntentParams(partial)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toContain('radiusM')
    }
  })

  test('requiredIntentParams 复用 shared REQUIRED_INTENT_PARAMS', () => {
    expect(requiredIntentParams).toEqual([...REQUIRED_INTENT_PARAMS])
  })
})
