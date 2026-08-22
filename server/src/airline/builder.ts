import {
  DEFAULT_AIRCRAFT_MODEL,
  DEFAULT_ALTITUDE_MODE,
  DEFAULT_EXIT_ON_RC_LOST,
  DEFAULT_FINISH_ACTION,
  DEFAULT_GLOBAL_HEIGHT,
  DEFAULT_GLOBAL_SPEED,
  DEFAULT_HEADING_MODE,
  DEFAULT_RTH_ALTITUDE,
  DEFAULT_TAKEOFF_SECURITY_HEIGHT,
  DEFAULT_TURN_MODE,
  type ActionParam,
  type AirlineContent,
  type GeoPoint,
  type Intent,
  type Waypoint,
} from '@airline-dsl/shared'

const HOVER_SECONDS_DEFAULT = 5
const PAYLOAD_LENS_INDEX_DEFAULT = 'wide'

function mountActions(intent: Intent): { first: ActionParam[]; last: ActionParam[] } {
  const first: ActionParam[] = []
  const last: ActionParam[] = []
  if (intent.gimbalPitchDeg !== undefined) {
    first.push({ action_type: 'gimbalRotate', action_params: { pitch_angle: intent.gimbalPitchDeg } })
  }
  for (const action of intent.actions) {
    if (action.type === 'takePhoto') {
      first.push({ action_type: 'takePhoto', action_params: { payload_lens_index: PAYLOAD_LENS_INDEX_DEFAULT } })
    } else if (action.type === 'hover') {
      first.push({ action_type: 'hover', action_params: { hover_time: action.seconds ?? HOVER_SECONDS_DEFAULT } })
    } else if (action.type === 'record') {
      first.push({ action_type: 'startRecord', action_params: { payload_lens_index: PAYLOAD_LENS_INDEX_DEFAULT } })
      last.push({ action_type: 'stopRecord', action_params: { payload_lens_index: PAYLOAD_LENS_INDEX_DEFAULT } })
    }
  }
  return { first, last }
}

export function buildAirlineContent(intent: Intent, waypointPositions: GeoPoint[]): AirlineContent {
  const { first, last } = mountActions(intent)
  const waypoints: Waypoint[] = waypointPositions.map((w, i) => ({
    lat: w.lat,
    lng: w.lng,
    altitude: intent.heightM,
    speed: intent.speedMps,
    heading_mode: DEFAULT_HEADING_MODE,
    heading_angle: 0,
    turn_mode: DEFAULT_TURN_MODE,
    actions: i === 0 ? first : i === waypointPositions.length - 1 ? last : [],
  }))
  return {
    name: intent.name ?? `${intent.region}-环绕-${Date.now()}`,
    aircraft_model: DEFAULT_AIRCRAFT_MODEL,
    takeoff: { lat: intent.center.lat, lng: intent.center.lng, altitude: 0 },
    waypoints,
    global_height: DEFAULT_GLOBAL_HEIGHT,
    global_speed: DEFAULT_GLOBAL_SPEED,
    finish_action: DEFAULT_FINISH_ACTION,
    rth_altitude: intent.rthAltitudeM ?? DEFAULT_RTH_ALTITUDE,
    takeoff_security_height: DEFAULT_TAKEOFF_SECURITY_HEIGHT,
    exit_on_rc_lost: DEFAULT_EXIT_ON_RC_LOST,
    altitude_mode: DEFAULT_ALTITUDE_MODE,
  }
}
