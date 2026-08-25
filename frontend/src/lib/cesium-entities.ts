import type { AirlineContent, Waypoint } from '@airline-dsl/shared'

export interface RoutePosition {
  lng: number
  lat: number
  height: number
}

/**
 * Cesium 地球无影像时的基底色：对齐设计系统 bg-void（暗色椭球，非纯黑块）。
 * 命令式 Cesium 颜色，绕过 Tailwind token；已在 DESIGN.md 登记 cesium 实体色。
 */
export const GLOBE_BASE_COLOR = '#0b111e'

export type CesiumEntityDescription =
  | { id: string; kind: 'nest'; lng: number; lat: number; height: number; label: string; color: string }
  | { id: string; kind: 'waypoint'; index: number; lng: number; lat: number; height: number; speed: number; icons: string[] }
  | { id: string; kind: 'route'; positions: RoutePosition[]; color: string; width: number }
  | { id: string; kind: 'badge'; text: string }
  | { id: string; kind: 'info'; name: string; waypointCount: number; height: number; speed: number; actions: string[] }

const ACTION_ICONS: Record<string, string> = {
  takePhoto: '拍照',
  hover: '悬停',
  record: '录像',
  startRecord: '录像',
  stopRecord: '录像',
  gimbalRotate: '悬停',
}

export function actionIcons(wp: Waypoint): string[] {
  const icons = new Set<string>()
  for (const action of wp.actions) {
    const icon = ACTION_ICONS[action.action_type]
    if (icon) icons.add(icon)
  }
  return [...icons]
}

export function buildCesiumEntities(content: AirlineContent, aiGenerated: boolean): CesiumEntityDescription[] {
  const { takeoff, waypoints } = content
  const positions: RoutePosition[] = [
    { lng: takeoff.lng, lat: takeoff.lat, height: takeoff.altitude },
    ...waypoints.map((wp) => ({ lng: wp.lng, lat: wp.lat, height: wp.altitude })),
    { lng: takeoff.lng, lat: takeoff.lat, height: takeoff.altitude },
  ]
  const waypointEntities = waypoints.map((wp, i) => ({
    id: `waypoint-${i}`,
    kind: 'waypoint' as const,
    index: i + 1,
    lng: wp.lng,
    lat: wp.lat,
    height: wp.altitude,
    speed: wp.speed,
    icons: actionIcons(wp),
  }))
  return [
    { id: 'nest', kind: 'nest', lng: takeoff.lng, lat: takeoff.lat, height: takeoff.altitude, label: '机巢', color: '#2dbe7a' },
    ...waypointEntities,
    { id: 'route', kind: 'route', positions, color: '#26b2f2', width: 3 },
    { id: 'badge', kind: 'badge', text: aiGenerated ? 'AI 生成' : '非 AI 生成' },
    {
      id: 'info',
      kind: 'info',
      name: content.name,
      waypointCount: waypoints.length,
      height: content.global_height,
      speed: content.global_speed,
      actions: content.waypoints.flatMap((wp) => wp.actions.map((a) => a.action_type)),
    },
  ]
}
