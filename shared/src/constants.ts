import type { GeoPoint } from './intent.js'

export const NEST_ANCHOR: GeoPoint = { lat: 22.531635, lng: 113.935066 }

export const METERS_PER_DEGREE = 111000

export const DEFAULT_GLOBAL_HEIGHT = 120
export const DEFAULT_GLOBAL_SPEED = 15
export const DEFAULT_FINISH_ACTION = 'goHome'
export const DEFAULT_RTH_ALTITUDE = 100
export const DEFAULT_TAKEOFF_SECURITY_HEIGHT = 50
export const DEFAULT_EXIT_ON_RC_LOST = 'goContinue'
export const DEFAULT_ALTITUDE_MODE = 'relativeToStartPoint'
export const DEFAULT_AIRCRAFT_MODEL = 'M350'
export const DEFAULT_HEADING_MODE = 'fixed'
export const DEFAULT_TURN_MODE = 'clockwise'

export const DEFAULT_HEIGHT_LIMIT_M = 500
export const DEFAULT_SPEED_LIMIT_MPS = 30
export const MIN_WAYPOINTS = 3
