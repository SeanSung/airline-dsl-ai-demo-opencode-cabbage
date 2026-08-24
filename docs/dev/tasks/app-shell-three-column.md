---
issue: null
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - npm run build --workspace frontend
---

# app-shell-three-column

## Builds

三栏工作台骨架可工作：应用启动后呈现「顶栏 + 历史栏 · 对话栏 · 地图栏」的工作台布局；≥1440px 三栏并列，1366px 历史收为图标窄栏；现有 ChatPanel/HistoryPanel/RouteMap/GBHSubmitBar 被原样放入对应栏位并保持原有功能（发送、历史、地图、GBH 提交均可用）。本 task 只搭骨架与定位，不重写各业务组件内部样式。

## Acceptance Criteria

- [ ] 新增 `components/layout/AppShell.tsx`：顶栏 `TopBar`（产品标识「航线编辑 Agent」+「新对话」按钮，接 `newConversation`）+ 主体 Grid；Grid 列用 `minmax(0,…)` 防子项撑破
- [ ] ≥1440 布局：`[历史 280px][对话 420px][地图 1fr]`；1366 布局：`[图标栏 48px][对话 minmax(380px,420px)][地图 1fr]`，历史由 `HistoryRail` 图标按钮触发 Sheet 抽屉
- [ ] 每栏内部 `overflow-y-auto`；对话输入与 GBH 在各自容器底部 sticky 可见（本 task 先靠现有组件 + 定位 class 保证容器结构，输入框样式迁移属后续 task）
- [ ] 地图栏 `relative`，为后续地图浮卡提供定位上下文；RouteMap 填满该栏
- [ ] 历史抽屉用 shadcn `Sheet`，遮罩为 fixed overlay，打开不引起后页 reflow
- [ ] `App.tsx` 改为用 `AppShell` 组合，保留 `ChatProvider`、`onResume`/`onResubmit` 回调语义不变
- [ ] jsdom 组件测试：渲染 AppShell 断言三栏容器与 TopBar 存在；1366 断点下 HistoryRail 存在且历史列表包在 Sheet 内
- [ ] 回归：现有 ChatPanel/HistoryPanel/GBHSubmitBar/useChatStream 测试通过；`npm test` 全绿

## Blocked By

- setup-design-foundation

## Implementation Notes

- 断点用 Tailwind 任意值 variant `min-[1440px]:` 或在 `@theme` 自定义 `--breakpoint-xl:1440px`；不要依赖默认 xl=1280。
- 本 task 允许给现有业务组件**外层包裹容器 className**，但不重写组件内部 inline style（清零属后续切片）。
- 「新对话」按钮行为：调用现有 `useChatStream().newConversation` 并 `dispatch({type:'reset'})`——与原 ChatPanel 头部按钮逻辑一致，提升到 TopBar 后原 ChatPanel 头部按钮可移除或保留，避免重复触发。
- 地图栏高度跟随 Grid 行（`calc(100vh - 顶栏高)`），Cesium 容器能获得确定尺寸。
