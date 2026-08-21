import {
  AIRCRAFT_MODELS,
  DEFAULT_HEIGHT_LIMIT_M,
  DEFAULT_SPEED_LIMIT_MPS,
  MIN_WAYPOINTS,
  type ActionParam,
  type AirlineContent,
} from '@airline-dsl/shared'

export interface ValidationError {
  path: string
  message: string
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] }

export interface ValidationLimits {
  heightLimitM?: number
  speedLimitMps?: number
}

const FINISH_ACTIONS = ['goHome', 'noAction', 'autoLand', 'backToFirstPoint']
const EXIT_ON_RC_LOST_VALUES = ['goContinue', 'executeLostAction']
const ALTITUDE_MODES = ['relativeToStartPoint', 'absolute', 'AGL']
const HEADING_MODES = ['followWayline', 'towardPOI', 'manually', 'fixed']
const TURN_MODES = ['clockwise', 'counterClockwise']
const ACTION_TYPE_WHITELIST = ['takePhoto', 'hover', 'gimbalRotate', 'startRecord', 'stopRecord']

function checkCoord(
  coord: { lat: number; lng: number },
  path: string,
  errors: ValidationError[],
): void {
  if (coord.lat < -90 || coord.lat > 90) {
    errors.push({ path: `${path}.lat`, message: '纬度越界 [-90, 90]' })
  }
  if (coord.lng < -180 || coord.lng > 180) {
    errors.push({ path: `${path}.lng`, message: '经度越界 [-180, 180]' })
  }
}

function checkActionParams(action: ActionParam, path: string, errors: ValidationError[]): void {
  const params = action.action_params
  if (action.action_type === 'hover' && typeof params.hover_time !== 'number') {
    errors.push({ path: `${path}.action_params`, message: 'hover 缺少数字类型 hover_time' })
  } else if (
    (action.action_type === 'takePhoto' ||
      action.action_type === 'startRecord' ||
      action.action_type === 'stopRecord') &&
    typeof params.payload_lens_index !== 'string'
  ) {
    errors.push({ path: `${path}.action_params`, message: `${action.action_type} 缺少字符串类型 payload_lens_index` })
  } else if (action.action_type === 'gimbalRotate' && typeof params.pitch_angle !== 'number') {
    errors.push({ path: `${path}.action_params`, message: 'gimbalRotate 缺少数字类型 pitch_angle' })
  }
}

export function validateAirlineContent(
  content: AirlineContent,
  limits: ValidationLimits = {},
): ValidationResult {
  const heightLimitM = limits.heightLimitM ?? DEFAULT_HEIGHT_LIMIT_M
  const speedLimitMps = limits.speedLimitMps ?? DEFAULT_SPEED_LIMIT_MPS
  const errors: ValidationError[] = []

  if (!AIRCRAFT_MODELS.includes(content.aircraft_model)) {
    errors.push({ path: 'aircraft_model', message: `非法机型：${String(content.aircraft_model)}` })
  }

  checkCoord(content.takeoff, 'takeoff', errors)

  const waypoints = Array.isArray(content.waypoints) ? content.waypoints : []
  if (waypoints.length < MIN_WAYPOINTS) {
    errors.push({ path: 'waypoints', message: `航点数至少 ${MIN_WAYPOINTS} 个` })
  }
  waypoints.forEach((w, i) => {
    const base = `waypoints[${i}]`
    checkCoord(w, base, errors)
    if (w.altitude < 0 || w.altitude > heightLimitM) {
      errors.push({
        path: `${base}.altitude`,
        message: `第 ${i + 1} 个航点 altitude 超上限 ${heightLimitM}m`,
      })
    }
    if (w.speed < 1 || w.speed > speedLimitMps) {
      errors.push({
        path: `${base}.speed`,
        message: `第 ${i + 1} 个航点 speed 非法（应 ∈ [1, ${speedLimitMps}] m/s）`,
      })
    }
    if (!HEADING_MODES.includes(w.heading_mode)) {
      errors.push({ path: `${base}.heading_mode`, message: `非法 heading_mode：${String(w.heading_mode)}` })
    }
    if (!TURN_MODES.includes(w.turn_mode)) {
      errors.push({ path: `${base}.turn_mode`, message: `非法 turn_mode：${String(w.turn_mode)}` })
    }
    w.actions.forEach((a, j) => {
      const actionPath = `${base}.actions[${j}]`
      if (!ACTION_TYPE_WHITELIST.includes(a.action_type)) {
        errors.push({ path: `${actionPath}.action_type`, message: `非法动作类型：${a.action_type}` })
      }
      checkActionParams(a, actionPath, errors)
    })
  })

  if (!FINISH_ACTIONS.includes(content.finish_action)) {
    errors.push({ path: 'finish_action', message: `非法 finish_action：${String(content.finish_action)}` })
  }
  if (!EXIT_ON_RC_LOST_VALUES.includes(content.exit_on_rc_lost)) {
    errors.push({ path: 'exit_on_rc_lost', message: `非法 exit_on_rc_lost：${String(content.exit_on_rc_lost)}` })
  }
  if (!ALTITUDE_MODES.includes(content.altitude_mode)) {
    errors.push({ path: 'altitude_mode', message: `非法 altitude_mode：${String(content.altitude_mode)}` })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true }
}
