import { useEffect, useRef, useState } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type * as CesiumModule from 'cesium'
import type { Viewer } from 'cesium'
import type { RouteData } from '../../state/types'
import { buildCesiumEntities, type CesiumEntityDescription, GLOBE_BASE_COLOR } from '../../lib/cesium-entities'
import { fetchMapToken } from '../../lib/map-token'
import { MapOverlayCard } from '../layout/MapOverlayCard'

// Cesium 会相对于此 base URL 解析 Workers/Assets/Widgets/ThirdParty。
// vite-plugin-static-copy 把 node_modules/cesium/Build/Cesium/* 拷贝到 /cesium/。
window.CESIUM_BASE_URL = '/cesium/'

/** 检测当前环境是否可创建 WebGL 上下文（Cesium Viewer 依赖）。jsdom/SSR 无 WebGL，直接跳过。 */
function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

export function RouteMap({ route }: { route: RouteData | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 单实例 Viewer：仅 mount 时创建一次（空态即初始化地球基座），后续 route 变化只增删实体。
  const viewerRef = useRef<Viewer | null>(null)
  const [badge, setBadge] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // 初始化一次：开场即挂载 Cesium Viewer（空态地球基座），无航线时只是暗色椭球而非纯黑。
  useEffect(() => {
    if (!containerRef.current) return
    if (!hasWebGL()) return // 测试/SSR 环境无 WebGL，跳过真实 Viewer 创建。
    let cancelled = false

    void (async () => {
      const Cesium = await import('cesium')
      if (cancelled || !containerRef.current || viewerRef.current) return
      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: false,
        // 无天地图 token 时退化为暗色椭球（非纯黑），与空态验收 4.1 一致。
        contextOptions: { webgl: { alpha: false } },
      })
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(GLOBE_BASE_COLOR)
      viewerRef.current = viewer
    })()

    return () => {
      cancelled = true
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [])

  // route 变化：仅在既有 Viewer 上增删实体，不重建 Viewer（P0 回归 4.1）。
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // 清空旧航线实体（保留 viewer 本身）。
    viewer.entities.removeAll()

    if (!route) {
      setBadge(null)
      setInfo(null)
      return
    }

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
    renderGeo(viewer, geo, CesiumModule)
    applyImagery(viewer)
  }, [route])

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

/** 叠加天地图/ArcGIS 影像图层；失败静默回退到暗色椭球。 */
function applyImagery(viewer: Viewer): void {
  void (async () => {
    try {
      const Cesium = await import('cesium')
      const token = await fetchMapToken()
      if (viewer.isDestroyed()) return
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
      // 无 token / 网络失败：保留暗色椭球基底，不抛错中断地图渲染。
    }
  })()
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
  void viewer.zoomTo(viewer.entities)
}
