import {
  DEFAULT_COUNT,
  DEFAULT_GIMBAL_PITCH_DEG,
  DEFAULT_REGION,
  DEFAULT_RTH_ALTITUDE_M,
  NEST_ANCHOR,
  type Intent,
} from '@airline-dsl/shared'

export function applyDefaults(intent: Partial<Intent>): Intent {
  return {
    ...(intent as Intent),
    name: intent.name ?? `${intent.region ?? DEFAULT_REGION}-环绕-${Date.now()}`,
    region: intent.region ?? DEFAULT_REGION,
    center: intent.center ?? NEST_ANCHOR,
    count: intent.count ?? DEFAULT_COUNT,
    gimbalPitchDeg: intent.gimbalPitchDeg ?? DEFAULT_GIMBAL_PITCH_DEG,
    rthAltitudeM: intent.rthAltitudeM ?? DEFAULT_RTH_ALTITUDE_M,
  }
}
