import Type from 'typebox'

const routeActionSchema = Type.Object({
  type: Type.Union([Type.Literal('takePhoto'), Type.Literal('hover'), Type.Literal('record')]),
  seconds: Type.Optional(Type.Number()),
  payloadLensIndex: Type.Optional(Type.String()),
})

export const intentSchema = Type.Object({
  name: Type.Optional(Type.String()),
  region: Type.String(),
  shape: Type.Literal('orbit'),
  center: Type.Object({ lat: Type.Number(), lng: Type.Number() }),
  radiusM: Type.Number(),
  count: Type.Optional(Type.Number()),
  heightM: Type.Number(),
  speedMps: Type.Number(),
  actions: Type.Array(routeActionSchema),
  gimbalPitchDeg: Type.Optional(Type.Number()),
  rthAltitudeM: Type.Optional(Type.Number()),
})
