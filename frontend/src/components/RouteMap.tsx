import { useEffect, useRef, useState } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { Viewer } from 'cesium'
import type { RouteData } from '../state/chatReducer'
import { buildCesiumEntities, type CesiumEntityDescription } from '../lib/cesium-entities'
import { fetchMapToken } from '../lib/map-token'

// Cesium resolves Workers/Assets/Widgets/ThirdParty relative to this base URL.
// vite-plugin-static-copy serves node_modules/cesium/Build/Cesium/* at /cesium/.
window.CESIUM_BASE_URL = '/cesium/'

export function RouteMap({ route }: { route: RouteData | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [badge, setBadge] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!route || !containerRef.current) return
    const entities = buildCesiumEntities(route.content, route.aiGenerated)
    const badgeEntity = entities.find((e) => e.kind === 'badge')
    const infoEntity = entities.find((e) => e.kind === 'info')
    setBadge(badgeEntity?.kind === 'badge' ? badgeEntity.text : null)
    setInfo(
      infoEntity?.kind === 'info'
        ? `${infoEntity.name} · 航点 ${infoEntity.waypointCount} · 高度 ${infoEntity.height}m · 速度 ${infoEntity.speed}m/s · 动作 ${infoEntity.actions.join('、') || '无'}`
        : null,
    )
    const geo = entities.filter((e) => e.kind === 'nest' || e.kind === 'waypoint' || e.kind === 'route')

    let viewer: Viewer | null = null
    let cancelled = false

    void (async () => {
      const Cesium = await import('cesium')
      if (cancelled || !containerRef.current) return
      viewer = new Cesium.Viewer(containerRef.current, { baseLayer: false })
      renderGeo(viewer, geo, Cesium)
      try {
        const token = await fetchMapToken()
        if (!cancelled && viewer) {
          viewer.imageryLayers.addImageryProvider(
            new Cesium.WebMapTileServiceImageryProvider({
              url: `https://t0.tianditu.gov.cn/img_w/wmts?tk=${token}`,
              layer: 'img',
              style: 'default',
              tileMatrixSetID: 'w',
              format: 'image/jpeg',
            }),
          )
        }
      } catch {
        if (!cancelled && viewer) {
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            }),
          )
        }
      }
    })()

    return () => {
      cancelled = true
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
    }
  }, [route])

  return (
    <div className="route-map-wrap" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <div className="route-map" ref={containerRef} data-testid="route-map" style={{ position: 'absolute', inset: 0 }} />
      {badge && (
        <div
          data-testid="map-badge"
          style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(15,23,42,0.92)', color: '#38bdf8', padding: '4px 10px', borderRadius: 4, fontSize: 13 }}
        >
          {badge}
        </div>
      )}
      {info && (
        <div
          data-testid="map-info"
          style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.92)', color: '#fff', padding: '8px 12px', borderRadius: 4, fontSize: 13 }}
        >
          {info}
        </div>
      )}
    </div>
  )
}

function renderGeo(viewer: Viewer, entities: CesiumEntityDescription[], Cesium: typeof import('cesium')): void {
  for (const e of entities) {
    if (e.kind === 'nest') {
      viewer.entities.add({
        id: e.id,
        position: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, e.height),
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(e.color) },
        label: { text: e.label, pixelOffset: new Cesium.Cartesian2(0, -18), fillColor: Cesium.Color.WHITE, font: '14px sans-serif' },
      })
    } else if (e.kind === 'waypoint') {
      viewer.entities.add({
        id: e.id,
        position: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, e.height),
        point: { pixelSize: 6, color: Cesium.Color.WHITE },
        label: { text: String(e.index), pixelOffset: new Cesium.Cartesian2(0, -14), fillColor: Cesium.Color.WHITE, font: '12px sans-serif' },
      })
    } else if (e.kind === 'route') {
      viewer.entities.add({
        id: e.id,
        polyline: {
          positions: e.positions.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height)),
          width: e.width,
          material: Cesium.Color.fromCssColorString(e.color),
        },
      })
    }
  }
  void viewer.zoomTo(viewer.entities)
}
