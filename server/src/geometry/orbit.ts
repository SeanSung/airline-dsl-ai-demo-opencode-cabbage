import { METERS_PER_DEGREE, type GeoPoint } from '@airline-dsl/shared'

export interface OrbitWaypointsInput {
  center: GeoPoint
  radiusM: number
  count: number
}

export function orbitWaypoints({ center, radiusM, count }: OrbitWaypointsInput): GeoPoint[] {
  if (count < 3) {
    throw new Error(`count 必须 >= 3 才能成环，实际为 ${count}`)
  }
  const lngScale = Math.cos((center.lat * Math.PI) / 180)
  const points: GeoPoint[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI
    points.push({
      lat: center.lat + (Math.cos(angle) * radiusM) / METERS_PER_DEGREE,
      lng: center.lng + (Math.sin(angle) * radiusM) / (METERS_PER_DEGREE * lngScale),
    })
  }
  return points
}
