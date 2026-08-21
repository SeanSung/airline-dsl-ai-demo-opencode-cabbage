import { describe, expect, test } from 'bun:test'
import type { Intent } from '@airline-dsl/shared'
import { mergeIntent } from './merge.js'

describe('mergeIntent', () => {
  test('先给 center 后补 heightM，center 不被覆盖', () => {
    const draft: Partial<Intent> = { center: { lat: 22.531635, lng: 113.935066 } }
    const result = mergeIntent({ heightM: 120 }, draft)
    expect(result.center).toEqual({ lat: 22.531635, lng: 113.935066 })
    expect(result.heightM).toBe(120)
  })

  test('partial 非 undefined 字段覆盖 draft 同名字段', () => {
    const result = mergeIntent(
      { radiusM: 300, heightM: 150 },
      { radiusM: 200, heightM: 120 },
    )
    expect(result.radiusM).toBe(300)
    expect(result.heightM).toBe(150)
  })

  test('draft 与 partial 均未提供的字段保持 undefined', () => {
    const result = mergeIntent({ radiusM: 200 }, { heightM: 120 })
    expect(result.radiusM).toBe(200)
    expect(result.heightM).toBe(120)
    expect(result.actions).toBeUndefined()
    expect(result.count).toBeUndefined()
  })

  test('partial 显式 undefined 不覆盖 draft 已有值', () => {
    const result = mergeIntent({ radiusM: undefined }, { radiusM: 200 })
    expect(result.radiusM).toBe(200)
  })

  test('draft 省略时仅保留 partial 非 undefined 字段', () => {
    const result = mergeIntent({ radiusM: 200, heightM: undefined })
    expect(result.radiusM).toBe(200)
    expect(result.heightM).toBeUndefined()
  })

  test('不修改输入对象（纯函数）', () => {
    const draft: Partial<Intent> = { center: { lat: 22.531635, lng: 113.935066 } }
    const partial: Partial<Intent> = { heightM: 120 }
    mergeIntent(partial, draft)
    expect(draft).toEqual({ center: { lat: 22.531635, lng: 113.935066 } })
    expect(partial).toEqual({ heightM: 120 })
  })
})
