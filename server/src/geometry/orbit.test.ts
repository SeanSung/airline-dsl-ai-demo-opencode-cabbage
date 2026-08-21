import { describe, expect, test } from 'bun:test'
import { METERS_PER_DEGREE, NEST_ANCHOR, type GeoPoint } from '@airline-dsl/shared'
import { orbitWaypoints } from './orbit.ts'

const CENTER: GeoPoint = { lat: NEST_ANCHOR.lat, lng: NEST_ANCHOR.lng }

function distanceM(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE
  const dLng = (b.lng - a.lng) * METERS_PER_DEGREE * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

describe('orbitWaypoints', () => {
  test('返回恰好 count 个 GeoPoint', () => {
    const points = orbitWaypoints({ center: CENTER, radiusM: 200, count: 8 })
    expect(points).toHaveLength(8)
    for (const p of points) {
      expect(typeof p.lat).toBe('number')
      expect(typeof p.lng).toBe('number')
    }
  })

  test('任取航点与 center 球面距离 ≈ radiusM', () => {
    const radiusM = 200
    const points = orbitWaypoints({ center: CENTER, radiusM, count: 8 })
    const tolerance = radiusM * 0.005
    for (const p of points) {
      expect(distanceM(CENTER, p)).toBeGreaterThan(radiusM - tolerance)
      expect(distanceM(CENTER, p)).toBeLessThan(radiusM + tolerance)
    }
  })

  test('相邻航点角间距 = 360/count 度', () => {
    const count = 8
    const points = orbitWaypoints({ center: CENTER, radiusM: 200, count })
    const span = 360 / count
    const bearings = points.map((p) => bearingDeg(CENTER, p))
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count
      let delta = bearings[next] - bearings[i]
      if (delta < 0) delta += 360
      expect(delta).toBeCloseTo(span, 1)
    }
  })

  test('count < 3 抛参数错误', () => {
    expect(() => orbitWaypoints({ center: CENTER, radiusM: 200, count: 2 })).toThrow()
    expect(() => orbitWaypoints({ center: CENTER, radiusM: 200, count: 1 })).toThrow()
    expect(() => orbitWaypoints({ center: CENTER, radiusM: 200, count: 0 })).toThrow()
  })

  test('纯函数：同输入同输出且不改动输入', () => {
    const input = { center: CENTER, radiusM: 200, count: 8 }
    const first = orbitWaypoints(input)
    const second = orbitWaypoints(input)
    expect(second).toEqual(first)
    expect(input.center.lat).toBe(CENTER.lat)
    expect(input.center.lng).toBe(CENTER.lng)
  })
})
