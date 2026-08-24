# ADR：Cesium Viewer 生命周期与实体同步分离

- 日期：2026-08-24
- 状态：Accepted
- 关联 PRD：`docs/prd/frontend-impeccable-hardening.md`
- 关联技术方案：`docs/dev/specs/frontend-impeccable-hardening.md`

## 背景

现状 `RouteMap` 用单个 `useEffect(..., [route])` 管理 Cesium：

- effect 在 `route` 为 null 时提前 `return`，**根本不创建 Viewer**；
- 每次 `route` 变化都 `new Viewer(...)` 并在 cleanup `viewer.destroy()`。

导致两个问题：
1. 生成航线前右侧地图列为纯黑矩形（无 `.cesium-widget canvas`），违背"地图即舞台"定位（审计 P2）。
2. 每次切换航线都销毁重建 Viewer，地球闪烁重载（性能与观感问题）。

PRD 4.1 要求：空态即渲染地球基座，route 变化只增删实体、不重建 Viewer。

## 决策

把 Viewer 生命周期与实体同步拆成两个关注点：

- **Mount effect（`[]`）**：动态 import Cesium → `new Viewer` 一次 → 加载底图（天地图，失败回退 ArcGIS）→ 相机定位到沧海校区/机巢 → unmount 时 destroy。
- **Sync effect（`[route]`）**：在已有 Viewer 上 `removeAll()` 后按最新 route `renderGeo`；route 为 null 时只清空实体、保留地球。

用 `routeRef` 保存最新 prop，在 mount effect 异步创建完 Viewer 后主动 sync 一次，覆盖"首个 route 在 Viewer 就绪前到达"的竞态；不引入状态机或第三方抽象。

## 备选方案

1. **保持单 effect，去掉 route=null 的提前 return，让 Viewer 始终创建**：仍会在每次 route 变化时 destroy+new Viewer，无法满足"不重建 Viewer"的 AC 3.2，且每次闪烁。否决。
2. **空态用深色占位卡片，不加载 Cesium**：用户在 dm-202 明确选择"开场即初始化地球基座"。否决。
3. **引入 map-controller 类/抽象层管理 Viewer**：当前只有 RouteMap 一个消费者，无第二 Adapter，属"为未来预留的抽象"，违反 flow-design 的 Seam 原则。否决。两个 effect + ref 是满足 AC 的最小方案。

## 后果

- 正面：空态即 3D 地球，开场观感符合控制台定位；切换航线无闪烁；接口 `RouteMap({route})` 不变，调用者零改动。
- 代价/风险：首屏即加载 Cesium 与请求底图瓦片（无 token 时回退 ArcGIS，完全离线时为暗色椭球，仍满足"非纯黑" AC）；需正确处理动态 import 竞态（routeRef + 就绪后 sync 一次）。
- 测试：Cesium 依赖 WebGL，jsdom 无法挂载，空态/不重建行为用运行时浏览器 smoke 验证（canvas 尺寸、像素亮度、canvas 节点身份不变），不为此引入生产抽象或脆弱单测。
