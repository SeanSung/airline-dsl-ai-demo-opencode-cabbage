---
issue: null
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - npm run build --workspace frontend
  - test "$(grep -rnE 'style=\{\{' frontend/src/components/map 2>/dev/null | wc -l)" -eq 0
  - test "$(grep -rnE '#[0-9a-fA-F]{3,8}' frontend/src/components/map 2>/dev/null | grep -v cesium | wc -l)" -eq 0
---

# map-panel-gbh-overlay

## Builds

地图区重设计完成：RouteMap 去除 inline 样式、与深色面板视觉融合；原底部遮挡式 GBHSubmitBar 迁移为地图内浮卡 GbhPanel（覆盖 Cesium ≤25%、可折叠、贴边不挡航点），提交 loading/成功(含 gbhRouteId)/失败(人类可读错误)三态可观察；GBH 校验失败不再把原始 JSON 抛给用户。

## Acceptance Criteria

- [ ] 新增 `lib/format-gbh-error.ts` 纯函数 + 表驱动单测：`{status:'invalid', errors}` → 中文字段级提示（无法解析时降级为「提交校验未通过，请检查航线参数」）；`{status:'error', message}` → 透传可读 message；网络异常 →「网络错误，请重试」；输出不含原始 JSON 特征字符 `{`、`"`
- [ ] GBHSubmitBar 迁移为 `components/map/GbhPanel.tsx`，放进新增 `components/layout/MapOverlayCard.tsx` 浮卡容器；保留 testid `gbh-bar`/`gbh-submit`/`gbh-status`
- [ ] MapOverlayCard 绝对定位贴地图边，`max-width`/`max-height` 约束覆盖面积 ≤25%，可折叠/收起；z-index 高于 Cesium canvas 但不压地图中心航点主体
- [ ] 提交 `POST /api/routes/:routeId/submit-gbh` 逻辑不变；loading 时按钮 disabled + 文案「正在提交模拟飞行…」；ok 显示 success 徽章 + gbhRouteId；error 经 `formatGbhError` 显示人类可读文本 + 重试按钮
- [ ] RouteMap 迁到 `components/map/`，去除 inline 布局/颜色样式（Cesium 命令式 `buildCesiumEntities` 入参与容器像素尺寸属白名单，逐处注释）；保留 `window.CESIUM_BASE_URL='/cesium/'`、widgets.css import、`fetchMapToken` 与底图回退、viewer 生命周期不变
- [ ] 全局降级位置：`aiGenerated=false` 时除 RouteCard 徽章外，GbhPanel/参数卡区域不显示 success 配色误导（降级态与成功态视觉可区分）
- [ ] jsdom 测试 mock Cesium 与 fetch：断言提交三态 DOM、error 文本经 formatGbhError（无 JSON）、浮卡存在面积约束 class、Cesium 实体构建参数不变；保留并更新原 GBHSubmitBar/RouteMap 测试意图
- [ ] 回归：`npm test` 全绿；dev 下目视 Cesium 控件未被 Tailwind preflight 破坏（否则按 design §9 豁免）

## Blocked By

- app-shell-three-column

## Implementation Notes

- formatGbhError 是表层行为增强，不改 API 契约；invalid.errors 结构未知，按"能提取则提取、否则降级文案"保守处理，单测覆盖 unknown 结构。
- Cesium 在 jsdom 不可用：沿用现有 mock 策略（mock `cesium` 模块、mock `fetchMapToken`），断言 entity 参数与 ref，不断言真实渲染。
- 浮卡覆盖面积约束用 class 表达（如 `max-w-[25%] max-h-[40%]`），真实像素占比归人工目检（design §T2）。
- 硬编码颜色白名单：仅 `cesium-entities.ts` 的 `Cesium.Color` 入参；其余一律 token。
