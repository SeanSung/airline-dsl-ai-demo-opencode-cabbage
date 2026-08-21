import { describe, expect, test } from 'bun:test'
import { NEST_ANCHOR } from '@airline-dsl/shared'
import { orbitWaypoints } from './orbit.ts'

describe('orbitWaypoints', () => {
  test('返回恰好 count 个 GeoPoint', () => {
    const points = orbitWaypoints({ center: NEST_ANCHOR, radiusM: 200, count: 8 })
    expect(points).toHaveLength(8)
    for (const p of points) {
      expect(typeof p.lat).toBe('number')
      expect(typeof p.lng).toBe('number')
    }
  })
})
