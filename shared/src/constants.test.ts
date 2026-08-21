import { describe, expect, test } from 'bun:test'
import {
  NEST_ANCHOR,
  METERS_PER_DEGREE,
  DEFAULT_GLOBAL_HEIGHT,
  DEFAULT_GLOBAL_SPEED,
  DEFAULT_FINISH_ACTION,
  DEFAULT_RTH_ALTITUDE,
  DEFAULT_TAKEOFF_SECURITY_HEIGHT,
  DEFAULT_EXIT_ON_RC_LOST,
  DEFAULT_ALTITUDE_MODE,
  DEFAULT_AIRCRAFT_MODEL,
  DEFAULT_HEADING_MODE,
  DEFAULT_TURN_MODE,
  DEFAULT_HEIGHT_LIMIT_M,
  DEFAULT_SPEED_LIMIT_MPS,
  MIN_WAYPOINTS,
  REQUIRED_INTENT_PARAMS,
  DEFAULT_COUNT,
  DEFAULT_GIMBAL_PITCH_DEG,
  DEFAULT_RTH_ALTITUDE_M,
  DEFAULT_REGION,
} from '../src/index.js'

describe('constants', () => {
  test('机巢锚点为沧海校区 WGS-84 坐标', () => {
    expect(NEST_ANCHOR).toEqual({ lat: 22.531635, lng: 113.935066 })
  })

  test('几何换算常量为 111000 m/deg', () => {
    expect(METERS_PER_DEGREE).toBe(111000)
  })

  test('open-api 全局参数默认值对齐契约', () => {
    expect(DEFAULT_GLOBAL_HEIGHT).toBe(120)
    expect(DEFAULT_GLOBAL_SPEED).toBe(15)
    expect(DEFAULT_FINISH_ACTION).toBe('goHome')
    expect(DEFAULT_RTH_ALTITUDE).toBe(100)
    expect(DEFAULT_TAKEOFF_SECURITY_HEIGHT).toBe(50)
    expect(DEFAULT_EXIT_ON_RC_LOST).toBe('goContinue')
    expect(DEFAULT_ALTITUDE_MODE).toBe('relativeToStartPoint')
  })

  test('机型与航向默认值', () => {
    expect(DEFAULT_AIRCRAFT_MODEL).toBe('M350')
    expect(DEFAULT_HEADING_MODE).toBe('fixed')
    expect(DEFAULT_TURN_MODE).toBe('clockwise')
  })

  test('校验常量', () => {
    expect(DEFAULT_HEIGHT_LIMIT_M).toBe(500)
    expect(DEFAULT_SPEED_LIMIT_MPS).toBe(30)
    expect(MIN_WAYPOINTS).toBe(3)
  })
})

describe('intent 契约', () => {
  test('required 集合对齐 spec §6.1', () => {
    expect([...REQUIRED_INTENT_PARAMS]).toEqual([
      'region',
      'shape',
      'center',
      'radiusM',
      'heightM',
      'speedMps',
      'actions',
    ])
  })

  test('默认值', () => {
    expect(DEFAULT_REGION).toBe('沧海校区')
    expect(DEFAULT_COUNT).toBe(8)
    expect(DEFAULT_GIMBAL_PITCH_DEG).toBe(-90)
    expect(DEFAULT_RTH_ALTITUDE_M).toBe(100)
  })
})
