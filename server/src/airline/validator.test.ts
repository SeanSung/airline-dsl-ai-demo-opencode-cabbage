import { describe, expect, test } from 'bun:test'
import type { AirlineContent } from '@airline-dsl/shared'
import { validateAirlineContent } from './validator.js'

function validContent(): AirlineContent {
  return {
    name: '测试航线',
    aircraft_model: 'M350',
    takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
    waypoints: [
      {
        lat: 22.53,
        lng: 113.93,
        altitude: 100,
        speed: 10,
        heading_mode: 'fixed',
        heading_angle: 0,
        turn_mode: 'clockwise',
        actions: [{ action_type: 'takePhoto', action_params: { payload_lens_index: 'wide' } }],
      },
      {
        lat: 22.531,
        lng: 113.931,
        altitude: 120,
        speed: 15,
        heading_mode: 'fixed',
        heading_angle: 0,
        turn_mode: 'clockwise',
        actions: [],
      },
      {
        lat: 22.532,
        lng: 113.932,
        altitude: 120,
        speed: 15,
        heading_mode: 'fixed',
        heading_angle: 0,
        turn_mode: 'clockwise',
        actions: [{ action_type: 'stopRecord', action_params: { payload_lens_index: 'wide' } }],
      },
    ],
    global_height: 120,
    global_speed: 15,
    finish_action: 'goHome',
    rth_altitude: 100,
    takeoff_security_height: 50,
    exit_on_rc_lost: 'goContinue',
    altitude_mode: 'relativeToStartPoint',
  }
}

describe('airline.validateAirlineContent', () => {
  test('合法内容 → { ok: true }', () => {
    expect(validateAirlineContent(validContent())).toEqual({ ok: true })
  })

  test('非法机型/越界坐标/超限高度/非法速度 → errors 带字段路径', () => {
    const content = validContent()
    content.aircraft_model = 'M999' as never
    content.takeoff.lat = 91
    content.waypoints[0].lng = 181
    content.waypoints[1].altitude = 501
    content.waypoints[2].speed = 31

    const result = validateAirlineContent(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('aircraft_model')
      expect(paths).toContain('takeoff.lat')
      expect(paths).toContain('waypoints[0].lng')
      expect(paths).toContain('waypoints[1].altitude')
      expect(paths).toContain('waypoints[2].speed')
    }
  })

  test('下界越界（lat=-91、altitude=-1、speed=0）同样被拒绝', () => {
    const content = validContent()
    content.takeoff.lat = -91
    content.waypoints[0].altitude = -1
    content.waypoints[1].speed = 0

    const result = validateAirlineContent(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('takeoff.lat')
      expect(paths).toContain('waypoints[0].altitude')
      expect(paths).toContain('waypoints[1].speed')
    }
  })

  test('非法枚举值 → 错误定位到对应字段路径', () => {
    const content = validContent()
    content.finish_action = 'crash' as never
    content.exit_on_rc_lost = 'runaway' as never
    content.altitude_mode = 'ground' as never
    content.waypoints[0].heading_mode = 'spiral' as never
    content.waypoints[1].turn_mode = 'reverse' as never

    const result = validateAirlineContent(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('finish_action')
      expect(paths).toContain('exit_on_rc_lost')
      expect(paths).toContain('altitude_mode')
      expect(paths).toContain('waypoints[0].heading_mode')
      expect(paths).toContain('waypoints[1].turn_mode')
    }
  })

  test('waypoints 数量不足 3 → 拒绝且定位到 waypoints', () => {
    const content = validContent()
    content.waypoints = content.waypoints.slice(0, 2)

    const result = validateAirlineContent(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.map((e) => e.path)).toContain('waypoints')
    }
  })

  test('非法动作类型与参数 → 定位到 actions 路径', () => {
    const content = validContent()
    content.waypoints[0].actions = [
      { action_type: 'launchMissile', action_params: {} },
      { action_type: 'hover', action_params: {} },
    ]

    const result = validateAirlineContent(content)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('waypoints[0].actions[0].action_type')
      expect(paths).toContain('waypoints[0].actions[1].action_params')
    }
  })

  test('自定义校验常量 heightLimitM/speedLimitMps 可注入', () => {
    const content = validContent()
    content.waypoints[0].altitude = 200
    content.waypoints[1].speed = 25
    expect(validateAirlineContent(content)).toEqual({ ok: true })

    const result = validateAirlineContent(content, { heightLimitM: 100, speedLimitMps: 20 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('waypoints[0].altitude')
      expect(paths).toContain('waypoints[1].speed')
    }
  })
})
