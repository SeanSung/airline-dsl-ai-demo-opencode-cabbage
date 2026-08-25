---
issue: 50
test_commands:
  - npx vitest run src/components/layout/NavRail.test.tsx src/components/layout/WorkspaceHeader.test.tsx src/components/layout/AppShell.test.tsx
verify_commands:
  - npm test
---

# app-shell-layout

## Builds

应用骨架从「全宽 TopBar + 三栏（history-aside | chat | map）」重构为「左 `NavRail` 图标导航栏 + 右主工作台（`WorkspaceHeader` + 对话列 + 地图列）」，历史通过 Sheet 抽屉打开，route 正确传递到 `RouteMap` / `GbhPanel`——**新布局结构 + 路由数据流可工作**（spec §3.4，T7 + T4）。

## Acceptance Criteria

- [ ] `NavRail`：64–72px 宽（`getBoundingClientRect().width ∈ [64,72]`），含「新对话」（Plus 图标，触发 `newConversation`）、「历史」（打开 Sheet 抽屉，内容 = `HistoryPanel`）、「设置」（`disabled` / `aria-disabled`），底部用户区占位（T7）
- [ ] Sheet 抽屉：`role="dialog"` 存在，`getByTestId('history-content')` 出现且全树 `getAllByTestId('history-content').length === 1`；关闭后内容从 DOM 卸载（T7）
- [ ] `WorkspaceHeader`：`getByTestId('workspace-header')` 存在，含 `header-title`（「新航线」/会话名）、`header-status`（状态点/徽章）、`new-conversation` 按钮、`header-param-chips`（route.intent 参数 chips）（T7）
- [ ] 旧 `topbar` / `history-aside` / `history-rail` testid 不存在（`queryByTestId` 返回 null）（T7）
- [ ] `WorkspaceHeader` 状态严格颜色+图标+文案成对：submitted/streaming → Loader2+「生成中」；route + aiGenerated → 绿+「已生成航线」；route + !aiGenerated → 琥珀「非 AI 生成」；error → 红（T7）
- [ ] `header-param-chips`：route 存在时渲染非空字段为 Badge；route 为 null 时不渲染（不占位挤压标题）（T7）
- [ ] route 从 `useAirlineChatContext()` 获取，传递给 `RouteMap` 与 `GbhPanel`（不再由 App props 透传）（T4）
- [ ] `AppShell` 删 `TopBar`、`history-aside`、`isWide` 常驻分支与 `useMediaQuery`（仅保留一个 `(min-width:1440px)` 切对话列宽度）（T7）
- [ ] `npm test` 通过

## Blocked By

- airline-chat-transport

## Implementation Notes

- `AppShell` 结构：`<div class="flex h-screen"> <NavRail/> <main class="flex min-w-0 flex-1 flex-col"> <WorkspaceHeader/> <div class="grid min-h-0 flex-1 [chat-col|map-col]"> {chat}{map} </div> </main> </div>`
- NavRail 内置 Sheet（side=left, `w-80`），关闭时历史内容不挂载
- 对话列/地图列宽度沿用 `420px | 1fr`（≥1440）与 `minmax(380px,420px) | 1fr`（1366）；NavRail 两断点恒显 `w-[68px]`
- `GbhPanel` / `RouteMap` 的 route prop 改为从 context 读取或由 AppShell map 区域注入，内部逻辑不变
- App.tsx 包 `AirlineChatProvider`，`HistoryPanel` 通过 context 调 `loadConversation`
