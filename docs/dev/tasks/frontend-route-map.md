---
issue: null
test_commands:
  - vitest run src/lib/cesium-entities.test.ts   # frontend/ 目录：buildCesiumEntities 纯函数单测
verify_commands:
  - npm test                                     # 根目录：仓库级回归通过
---

# frontend-route-map

## Builds

航线生成后地图渲染机巢/航点/闭合航线与信息浮层，底部操作条可一键提交 GBH 并展示提交状态（成功绿/失败红/错误透传）；天地图不可用时自动回退 Esri 底图——**地图预览与提交闭环可工作**（spec §11.1.1/§11.1.4）。

## Acceptance Criteria

- [ ] `lib/cesium-entities.ts`：`buildCesiumEntities(content, aiGenerated)` 纯函数 → 机巢标记 + N 个航点实体 + 首尾相连闭合连线 + 信息浮层数据；`aiGenerated` 影响徽标描述（Spec §12.11，单测不触碰真实 Cesium viewer）
- [ ] `RouteMap.tsx`：Cesium viewer 生命周期管理（useEffect 创建/销毁，组件卸载清理）
- [ ] 天地图 WMTS 底图（token 来自 `GET /api/map-token`，前端不接触环境变量）；加载失败/软渲染环境 → 回退 Esri World Imagery（配置项）
- [ ] `route_generated` 后地图渲染：`#38bdf8` 高亮 polyline（线宽 3px）、白色航点 + 序号 label、动作图标用文本图标（拍照/悬停/录像），信息浮层（名称/航点/高度/速度/动作）
- [ ] 底部操作条"一键提交 GBH"：调用 `POST /api/routes/:id/submit-gbh`；提交中 loading（"正在提交模拟飞行…"）、成功变绿"验证通过"并显示平台 routeId、失败变红 + 平台错误原样透传
- [ ] 回归：`npm test` 通过

## Blocked By

- frontend-chat-stream
- http-sse-api

## Implementation Notes

- viewer 生命周期与业务换算分离：`RouteMap.tsx` 是原生 Cesium 薄壳，业务数据全部走 `lib/cesium-entities.ts` 纯函数（spec §11），保证可单测
- 底图回退为可切换配置（PRD Open Question / §13 #4）
- 提交状态反馈对照 §11.1.4（loading/成功/失败三态）
