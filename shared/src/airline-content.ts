import type { GeoPoint } from './intent.js'

export type AircraftModel =
  | 'M30'
  | 'M30T'
  | 'M350'
  | 'M3E'
  | 'M3T'
  | 'M3M'
  | 'M3TA'
  | 'M3D'
  | 'M3TD'
  | 'M4E'
  | 'M4T'
  | 'M4D'
  | 'M4TD'
  | 'M400'

export const AIRCRAFT_MODELS: AircraftModel[] = [
  'M30',
  'M30T',
  'M350',
  'M3E',
  'M3T',
  'M3M',
  'M3TA',
  'M3D',
  'M3TD',
  'M4E',
  'M4T',
  'M4D',
  'M4TD',
  'M400',
]

export type FinishAction = 'goHome' | 'noAction' | 'autoLand' | 'backToFirstPoint'
export type ExitOnRcLost = 'goContinue' | 'executeLostAction'
export type AltitudeMode = 'relativeToStartPoint' | 'absolute' | 'AGL'
export type HeadingMode = 'followWayline' | 'towardPOI' | 'manually' | 'fixed'
export type TurnMode = 'clockwise' | 'counterClockwise'

export interface ActionParam {
  action_type: string
  action_params: Record<string, unknown>
}

export interface Waypoint {
  lat: number
  lng: number
  altitude: number
  speed: number
  heading_mode: HeadingMode
  heading_angle: number
  turn_mode: TurnMode
  actions: ActionParam[]
}

export interface AirlineContent {
  name: string
  aircraft_model: AircraftModel
  takeoff: { lat: number; lng: number; altitude: number }
  waypoints: Waypoint[]
  global_height: number
  global_speed: number
  finish_action: FinishAction
  rth_altitude: number
  takeoff_security_height: number
  exit_on_rc_lost: ExitOnRcLost
  altitude_mode: AltitudeMode
}

export interface TakeoffPoint {
  lat: number
  lng: number
  altitude: number
}

export interface Poi extends TakeoffPoint {}

export { GeoPoint }
