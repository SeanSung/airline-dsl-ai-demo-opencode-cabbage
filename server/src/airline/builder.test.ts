import { describe, expect, test } from 'bun:test'
import type { Intent, Waypoint } from '@airline-dsl/shared'
import { buildAirlineContent } from './builder.js'

const baseIntent: Intent = {
  region: '沧海校区',
  shape: 'orbit',
  center: { lat: 22.531635, lng: 113.935066 },
  radiusM: 200,
  count: 4,
  heightM: 120,
  speedMps: 15,
  actions: [],
}

function fixedWaypoints(intent: Intent): Waypoint[] {
  const offsets = [
    { lat: 0.001, lng: 0 },
    { lat: 0, lng: 0.001 },
    { lat: -0.001, lng: 0 },
    { lat: 0, lng: -0.001 },
  ]
  return offsets.map((o) => ({
    lat: intent.center.lat + o.lat,
    lng: intent.center.lng + o.lng,
    altitude: 999,
    speed: 999,
    heading_mode: 'followWayline',
    heading_angle: 45,
    turn_mode: 'counterClockwise',
    actions: [],
  }))
}

describe('airline.buildAirlineContent', () => {
  test('顶层字段按 §7.1 映射：takeoff=center、M350、全局参数与飞行行为默认值', () => {
    const content = buildAirlineContent({ ...baseIntent, name: '沧海巡检' }, fixedWaypoints)
    expect(content.name).toBe('沧海巡检')
    expect(content.aircraft_model).toBe('M350')
    expect(content.takeoff).toEqual({ lat: 22.531635, lng: 113.935066, altitude: 0 })
    expect(content.global_height).toBe(120)
    expect(content.global_speed).toBe(15)
    expect(content.finish_action).toBe('goHome')
    expect(content.rth_altitude).toBe(100)
    expect(content.takeoff_security_height).toBe(50)
    expect(content.exit_on_rc_lost).toBe('goContinue')
    expect(content.altitude_mode).toBe('relativeToStartPoint')
  })

  test('name 缺省时自动生成「region-环绕-时间戳」', () => {
    const content = buildAirlineContent(baseIntent, fixedWaypoints)
    expect(content.name).toMatch(/^沧海校区-环绕-\d+$/)
  })

  test('默认生成器产出 count 个以 center 为圆心、radiusM 为半径的航点', () => {
    const content = buildAirlineContent(baseIntent)
    expect(content.waypoints).toHaveLength(4)
    const r = Math.hypot(
      content.waypoints[0].lat - baseIntent.center.lat,
      content.waypoints[0].lng - baseIntent.center.lng,
    )
    expect(r).toBeGreaterThan(0)
    for (const w of content.waypoints) {
      expect(Math.abs(w.lat - baseIntent.center.lat)).toBeLessThanOrEqual(0.002)
      expect(Math.abs(w.lng - baseIntent.center.lng)).toBeLessThanOrEqual(0.002)
    }
  })

  test('waypoint 字段映射：altitude=heightM、speed=speedMps、heading_mode/fixed、heading_angle=0、turn_mode/clockwise', () => {
    const content = buildAirlineContent(baseIntent, fixedWaypoints)
    expect(content.waypoints).toHaveLength(4)
    for (const w of content.waypoints) {
      expect(w.altitude).toBe(120)
      expect(w.speed).toBe(15)
      expect(w.heading_mode).toBe('fixed')
      expect(w.heading_angle).toBe(0)
      expect(w.turn_mode).toBe('clockwise')
    }
    expect(content.waypoints[0].lat).toBeCloseTo(22.532635, 9)
    expect(content.waypoints[1].lng).toBeCloseTo(113.936066, 9)
  })

  test('动作挂载：gimbalRotate/takePhoto/hover/startRecord 在首航点、stopRecord 在末航点', () => {
    const content = buildAirlineContent(
      {
        ...baseIntent,
        actions: [{ type: 'takePhoto' }, { type: 'hover', seconds: 8 }, { type: 'record' }],
        gimbalPitchDeg: 60,
      },
      fixedWaypoints,
    )
    expect(content.waypoints[0].actions).toEqual([
      { action_type: 'gimbalRotate', action_params: { pitch_angle: 60 } },
      { action_type: 'takePhoto', action_params: { payload_lens_index: 'wide' } },
      { action_type: 'hover', action_params: { hover_time: 8 } },
      { action_type: 'startRecord', action_params: { payload_lens_index: 'wide' } },
    ])
    expect(content.waypoints[3].actions).toEqual([
      { action_type: 'stopRecord', action_params: { payload_lens_index: 'wide' } },
    ])
    expect(content.waypoints[1].actions).toEqual([])
    expect(content.waypoints[2].actions).toEqual([])
  })

  test('hover 未指定 seconds 时 hover_time 默认 5', () => {
    const content = buildAirlineContent({ ...baseIntent, actions: [{ type: 'hover' }] }, fixedWaypoints)
    expect(content.waypoints[0].actions).toEqual([{ action_type: 'hover', action_params: { hover_time: 5 } }])
  })

  test('未提供 gimbalPitchDeg 时不挂载 gimbalRotate', () => {
    const content = buildAirlineContent({ ...baseIntent, actions: [{ type: 'takePhoto' }] }, fixedWaypoints)
    expect(content.waypoints[0].actions).toEqual([
      { action_type: 'takePhoto', action_params: { payload_lens_index: 'wide' } },
    ])
  })
})
