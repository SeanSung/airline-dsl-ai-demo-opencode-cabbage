import { useCallback, useEffect, useRef, useState } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type * as CesiumModule from 'cesium'
import type { Viewer } from 'cesium'
import type { RouteData } from '../../state/chatReducer'
import { buildCesiumEntities, type CesiumEntityDescription } from '../../lib/cesium-entities'
import { fetchMapToken } from '../../lib/map-token'
import { MapOverlayCard } from '../layout/MapOverlayCard'

// Cesium 会相对于此 base URL 解析 Workers/Assets/Widgets/ThirdParty。
// vite-plugin-static-copy 把 node_modules/cesium/Build/Cesium/* 拷贝到 /cesium/。
window.CESIUM_BASE_URL = '/cesium/'

// 机巢锚点（与 dm-005 一致），空态相机定位到此视角（沧海校区）。
const NEST_LNG = 113.935066
const NEST_LAT = 22.531635
const DEFAULT_ALTITUDE = 1500

export function RouteMap({ route }: { route: RouteData | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const cesiumRef = useRef<typeof CesiumModule | null>(null)
  // 保存最新 route，供 mount 完成后的首帧 sync 使用，避免动态 import 竞态。
  const routeRef = useRef<RouteData | null>(route)
  routeRef.current = route

  const [ready, setReady] = useState(false)
  const [badge, setBadge] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // route 变化只增删实体，不重建 Viewer（4.1 回归 + 空态地球基座保持）。
  const syncRoute = useCallback((viewer: Viewer, Cesium: typeof CesiumModule, current: RouteData | null) => {
    viewer.entities.removeAll()
    setBadge(null)
    setInfo(null)
    if (!current) return
    const entities = buildCesiumEntities(current.content, current.aiGenerated)
    const badgeEntity = entities.find((e) => e.kind === 'badge')
    const infoEntity = entities.find((e) => e.kind === 'info')
    setBadge(badgeEntity?.kind === 'badge' ? badgeEntity.text : null)
    setInfo(
      infoEntity?.kind === 'info'
        ? `${infoEntity.name} · 航点 ${infoEntity.waypointCount} · 高度 ${infoEntity.height}m · 速度 ${infoEntity.speed}m/s · 动作 ${infoEntity.actions.join('、') || '无'}`
        : null,
    )
    const geo = entities.filter((e) => e.kind === 'nest' || e.kind === 'waypoint' || e.kind === 'route')
    renderGeo(viewer, geo, Cesium)
  }, [])

  // Mount effect（仅一次）：动态 import Cesium + 创建 Viewer + 空态相机；route=null 也有地球基座。
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    void (async () => {
      const Cesium = await import('cesium')
      if (cancelled || !containerRef.current) return
      const viewer = new Cesium.Viewer(containerRef.current, { baseLayer: false })
      cesiumRef.current = Cesium
      viewerRef.current = viewer
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(NEST_LNG, NEST_LAT, DEFAULT_ALTITUDE),
      })
      await addBaseLayer(viewer, Cesium)
      if (cancelled) {
        viewer.destroy()
        viewerRef.current = null
        cesiumRef.current = null
        return
      }
      setReady(true)
      // 首帧：用 mount 期间到达的最新 route 立即同步一次，覆盖 import 竞态。
      syncRoute(viewer, Cesium, routeRef.current)
    })()
    return () => {
      cancelled = true
      const v = viewerRef.current
      if (v && !v.isDestroyed()) v.destroy()
      viewerRef.current = null
      cesiumRef.current = null
      setReady(false)
    }
  }, [syncRoute])

  // Sync effect：Viewer 就绪后，route 变化只增删实体。
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || !Cesium) return
    syncRoute(viewer, Cesium, route)
  }, [route, ready, syncRoute])

  return (
    // 外层 flex-1 占满地图列剩余高度；relative 为浮卡提供定位上下文。
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Cesium Viewer 挂载节点：用类名 absolute inset-0 撑满父容器即可，
          Cesium 会自动读取容器 clientWidth/clientHeight，无需行内像素尺寸。 */}
      <div ref={containerRef} data-testid="route-map" className="absolute inset-0 h-full w-full" />
      {badge && (
        <div
          data-testid="map-badge"
          className="absolute right-3 top-3 rounded-md border border-border bg-card/95 px-2.5 py-1 text-xs font-medium text-primary shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/80"
        >
          {badge}
        </div>
      )}
      {info && (
        <MapOverlayCard
          title="航线信息"
          className="bottom-3 left-3 w-80 max-w-[calc(100%-1.5rem)]"
          defaultOpen={false}
        >
          <span data-testid="map-info" className="leading-relaxed text-muted-foreground">
            {info}
          </span>
        </MapOverlayCard>
      )}
    </div>
  )
}

async function addBaseLayer(viewer: Viewer, Cesium: typeof CesiumModule): Promise<void> {
  try {
    const token = await fetchMapToken()
    viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapTileServiceImageryProvider({
        url: `https://t0.tianditu.gov.cn/img_w/wmts?tk=${token}`,
        layer: 'img',
        style: 'default',
        tileMatrixSetID: 'w',
        format: 'image/jpeg',
      }),
    )
  } catch {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      }),
    )
  }
}

function renderGeo(viewer: Viewer, entities: CesiumEntityDescription[], Cesium: typeof CesiumModule): void {
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
  if (viewer.entities.values.length > 0) void viewer.zoomTo(viewer.entities)
}
