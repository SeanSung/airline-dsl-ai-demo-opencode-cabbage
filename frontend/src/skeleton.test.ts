import { describe, expect, test } from 'vitest'
import { NEST_ANCHOR, type AirlineContent } from '@airline-dsl/shared'

describe('frontend skeleton', () => {
  test('workspace 可消费 @airline-dsl/shared 类型与常量', () => {
    expect(NEST_ANCHOR.lng).toBe(113.935066)
  })

  test('AirlineContent 类型可被类型检查消费', () => {
    const content: AirlineContent = {
      name: 'test',
      aircraft_model: 'M350',
      takeoff: { lat: 22.531635, lng: 113.935066, altitude: 0 },
      waypoints: [
        { lat: 22.531635, lng: 113.935066, altitude: 120, speed: 15, heading_mode: 'fixed', heading_angle: 0, turn_mode: 'clockwise', actions: [] },
      ],
      global_height: 120,
      global_speed: 15,
      finish_action: 'goHome',
      rth_altitude: 100,
      takeoff_security_height: 50,
      exit_on_rc_lost: 'goContinue',
      altitude_mode: 'relativeToStartPoint',
    }
    expect(content.waypoints.length).toBe(1)
  })
})
