---
issue: 52
test_commands:
  - npx vitest run
verify_commands:
  - npm test
  - grep -R "useChatStream\|chatReducer" frontend/src | wc -l
  - grep -R '<[A-Za-z]+[^>]*\bstyle={{' frontend/src --include='*.tsx' | wc -l
  - grep -R '#[0-9a-fA-F]\{3,8\}\|rgb(\|rgba(' frontend/src/components --include='*.tsx' | wc -l
---

# cleanup-regression

## Builds

旧 `chatReducer` / `useChatStream` 模块完全删除、零命中；inline-style 与硬编码颜色字面量回归扫描通过；`npm test` 全绿——**收尾回归门通过**（T9 + PRD 7.4 / 7.5）。

## Acceptance Criteria

- [ ] `grep -R "useChatStream\|chatReducer" frontend/src` 返回 0 命中（PRD 7.4）
- [ ] `grep -R "from '@ai-sdk/react'" frontend/src` ≥ 1 命中（PRD 7.4）
- [ ] `package.json` 含 `@ai-sdk/react` 依赖（PRD 7.4）
- [ ] `grep -R '<[A-Za-z]+[^>]*\bstyle={{' frontend/src --include='*.tsx'` 计数 0（白名单：Cesium 命令式实体图形属性与运行时像素尺寸，逐处注释）（PRD 7.5）
- [ ] `frontend/src/components/` 下业务组件不出现硬编码颜色字面量（`#xxx` / `rgb()` / `rgba()`）；token 文件与 `components/ui` 之外颜色字面量计数 0（PRD 7.5）
- [ ] 禁用的 `+` 与「设置」控件带 `disabled` / `aria-disabled` 且点击无反应（PRD 7.5）
- [ ] `npm test` 退出码 0，含迁移后的 transport 测试、AppShell/布局测试、ChatPanel/composer 测试、MapOverlayCard/format-gbh-error/cesium-entities 既有测试（PRD 7.4）
- [ ] 旧文件 `state/chatReducer.tsx` 与 `api/useChatStream.ts` 及其测试 `api/useChatStream.test.tsx` 已从仓库删除

## Blocked By

- agent-event-stream
- airline-chat-transport
- app-shell-layout
- chat-panel-composer

## Implementation Notes

- 删除顺序：先确保所有 import 已迁移到 `useAirlineChatContext()`，再删旧文件
- inline-style 白名单仅限 Cesium 命令式实体（`cesium-entities.ts`）与运行时像素尺寸（需逐行注释）
- 颜色扫描排除 `styles/theme.css`（token 文件）、`components/ui/`（shadcn copy-in）、`lib/map-token.ts`
