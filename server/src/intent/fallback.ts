import { DEFAULT_REGION, NEST_ANCHOR, type Intent } from '@airline-dsl/shared'

const SHAPE_RE = /环绕|绕|转圈/
const REGION_RE = /沧海|校区/
const RADIUS_RE = /半径\s*(\d+)/
const HEIGHT_HIGH_RE = /高(?:度)?\s*(\d+)/
const HEIGHT_METER_RE = /(\d+)米/
const SPEED_RE = /速度\s*(\d+)/

export function parseIntent(text: string): Partial<Intent> {
  const intent: Partial<Intent> = {}
  if (SHAPE_RE.test(text)) {
    intent.shape = 'orbit'
  }
  if (REGION_RE.test(text)) {
    intent.region = DEFAULT_REGION
    intent.center = NEST_ANCHOR
  }
  const radius = text.match(RADIUS_RE)
  if (radius) {
    intent.radiusM = Number(radius[1])
  }
  const heightHigh = text.match(HEIGHT_HIGH_RE)
  const heightMeter = text.match(HEIGHT_METER_RE)
  if (heightHigh) {
    intent.heightM = Number(heightHigh[1])
  } else if (heightMeter) {
    intent.heightM = Number(heightMeter[1])
  }
  const speed = text.match(SPEED_RE)
  if (speed) {
    intent.speedMps = Number(speed[1])
  }
  const actions: Intent['actions'] = []
  if (/拍|拍照/.test(text)) {
    actions.push({ type: 'takePhoto' })
  }
  if (/悬停/.test(text)) {
    actions.push({ type: 'hover' })
  }
  if (/录像|录制/.test(text)) {
    actions.push({ type: 'record' })
  }
  if (actions.length > 0) {
    intent.actions = actions
  }
  return intent
}
