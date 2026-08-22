import { describe, expect, it } from 'vitest'
import type { AirlineContent } from '@airline-dsl/shared'
import { buildCesiumEntities } from './cesium-entities'

function makeContent(): AirlineContent {
  return {
    name: '巡检航线',
    aircraft_model: 'M350',
    takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
    waypoints: [
      { lat: 22.531635, lng: 113.935066, altitude: 120, speed: 15, heading_mode: 'fixed', heading_angle: 0, turn_mode: 'clockwise', actions: [{ action_type: 'takePhoto', action_params: { payload_lens_index: 'wide' } }] },
      { lat: 22.532, lng: 113.936, altitude: 120, speed: 15, heading_mode: 'fixed', heading_angle: 0, turn_mode: 'clockwise', actions: [{ action_type: 'hover', action_params: { hover_time: 3 } }] },
      { lat: 22.5325, lng: 113.9365, altitude: 120, speed: 15, heading_mode: 'fixed', heading_angle: 0, turn_mode: 'clockwise', actions: [{ action_type: 'record', action_params: {} }] },
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

describe('buildCesiumEntities', () => {
  it('输出机巢标记 + N 个航点实体 + 闭合连线 + 徽标 + 信息浮层', () => {
    const entities = buildCesiumEntities(makeContent(), true)
    expect(entities.filter((e) => e.kind === 'nest')).toHaveLength(1)
    expect(entities.filter((e) => e.kind === 'waypoint')).toHaveLength(3)
    expect(entities.filter((e) => e.kind === 'route')).toHaveLength(1)
    expect(entities.filter((e) => e.kind === 'badge')).toHaveLength(1)
    expect(entities.filter((e) => e.kind === 'info')).toHaveLength(1)
  })

  it('机巢标记带「机巢」标签且位于起飞点', () => {
    const nest = buildCesiumEntities(makeContent(), true).find((e) => e.kind === 'nest')
    if (nest?.kind === 'nest') {
      expect(nest.label).toBe('机巢')
      expect(nest.lat).toBe(22.531635)
      expect(nest.lng).toBe(113.935066)
    } else {
      throw new Error('缺少 nest 实体')
    }
  })

  it('航线为闭合连线：首点等于尾点', () => {
    const route = buildCesiumEntities(makeContent(), true).find((e) => e.kind === 'route')
    if (route?.kind === 'route') {
      expect(route.positions.length).toBeGreaterThan(1)
      expect(route.positions[0].lng).toBe(route.positions[route.positions.length - 1].lng)
      expect(route.positions[0].lat).toBe(route.positions[route.positions.length - 1].lat)
    } else {
      throw new Error('缺少 route 实体')
    }
  })

  it('航线为 #38bdf8 且线宽 3px', () => {
    const route = buildCesiumEntities(makeContent(), true).find((e) => e.kind === 'route')
    if (route?.kind === 'route') {
      expect(route.color).toBe('#38bdf8')
      expect(route.width).toBe(3)
    } else {
      throw new Error('缺少 route 实体')
    }
  })

  it('航点按序号排序并携带动作文本图标', () => {
    const waypoints = buildCesiumEntities(makeContent(), true)
      .filter((e) => e.kind === 'waypoint')
      .sort((a, b) => (a.kind === 'waypoint' && b.kind === 'waypoint' ? a.index - b.index : 0))
    expect(waypoints.map((w) => (w.kind === 'waypoint' ? w.index : -1))).toEqual([1, 2, 3])
    expect(waypoints[0]?.kind === 'waypoint' && waypoints[0].icons).toContain('拍照')
    expect(waypoints[1]?.kind === 'waypoint' && waypoints[1].icons).toContain('悬停')
    expect(waypoints[2]?.kind === 'waypoint' && waypoints[2].icons).toContain('录像')
  })

  it('信息浮层含名称/航点/高度/速度/动作', () => {
    const info = buildCesiumEntities(makeContent(), true).find((e) => e.kind === 'info')
    if (info?.kind === 'info') {
      expect(info.name).toBe('巡检航线')
      expect(info.waypointCount).toBe(3)
      expect(info.height).toBe(120)
      expect(info.speed).toBe(15)
      expect(info.actions.length).toBeGreaterThan(0)
    } else {
      throw new Error('缺少 info 实体')
    }
  })

  it('aiGenerated=true 徽标为「AI 生成」', () => {
    const badge = buildCesiumEntities(makeContent(), true).find((e) => e.kind === 'badge')
    expect(badge?.kind === 'badge' && badge.text).toBe('AI 生成')
  })

  it('aiGenerated=false 徽标为「非 AI 生成」', () => {
    const badge = buildCesiumEntities(makeContent(), false).find((e) => e.kind === 'badge')
    expect(badge?.kind === 'badge' && badge.text).toBe('非 AI 生成')
  })
})
