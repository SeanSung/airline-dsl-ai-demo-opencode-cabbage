export interface GeoPoint {
  lat: number
  lng: number
}

export type RouteActionType = 'takePhoto' | 'hover' | 'record'

export interface RouteAction {
  type: RouteActionType
  seconds?: number
  payloadLensIndex?: string
}

export interface Intent {
  name?: string
  region: string
  shape: 'orbit'
  center: GeoPoint
  radiusM: number
  count?: number
  heightM: number
  speedMps: number
  actions: RouteAction[]
  gimbalPitchDeg?: number
  rthAltitudeM?: number
}

export const REQUIRED_INTENT_PARAMS = [
  'region',
  'shape',
  'center',
  'radiusM',
  'heightM',
  'speedMps',
  'actions',
] as const

export const DEFAULT_REGION = '沧海校区'
export const DEFAULT_SHAPE = 'orbit' as const
export const DEFAULT_COUNT = 8
export const DEFAULT_GIMBAL_PITCH_DEG = -90
export const DEFAULT_RTH_ALTITUDE_M = 100
