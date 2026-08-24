---
issue: 37
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - npm run build --workspace frontend
  - echo "JSX inline style (white-list excluded) must be 0:" && grep -rnE "style=\{\{" frontend/src --include="*.tsx" | grep -v "cesium-entities" | grep -v "RouteMap" | wc -l
  - echo "hard-coded colors in tsx (theme.css excluded) must be 0:" && grep -rnE "#[0-9a-fA-F]{3,8}|rgb(a)?\(|hsl(a)?\(" frontend/src --include="*.tsx" | grep -v "cesium" | wc -l
  - echo "business components import from ui:" && grep -rl "from '@/components/ui" frontend/src/components | wc -l
---

# visual-polish-and-tokens

## Builds

整个前端达到 PRD 第 9 节的「对外演示级」验收：深色设计语言贯穿三栏，token 为唯一真相源、基础组件集中复用、无残留 inline style/硬编码颜色，两断点（1366 / ≥1440）下无横向滚动、无截断重叠、对比度达 WCAG AA、四态视觉清晰可辨。这是收口切片，合并后 frontend-ui-redesign 功能完成。

## Acceptance Criteria

- [ ] 全量 `frontend/src/**/*.tsx` 扫描：JSX `style={{` 命中=0（白名单仅 cesium-entities 命令式对象与 RouteMap 容器运行时像素，逐处注释）；硬编码颜色/间距字面量=0（token 文件与 Cesium 除外）
- [ ] token 单源：颜色/间距/圆角/阴影/字体只定义在 `styles/theme.css` 的 `@theme`/`:root`；业务组件只通过 utility 或 `components/ui` 使用
- [ ] 基础组件集中 `components/ui/`；`chat`/`history`/`map`/`layout` 业务组件均从 `@/components/ui` import，无第二套 Button/Badge/Card 实现
- [ ] 四态视觉贯穿且互不可混淆：生成中（spinner+禁用）、成功（success 徽章+航线高亮）、失败（destructive+重试）、降级（warning「非 AI 生成」）
- [ ] 移除所有无样式的旧空 class（`chat-panel`/`chat-header`/`message-list`/`gbh-bar` 等已被 utility 取代的裸 class）；确认无残留未使用 import
- [ ] 人工目检（两断点）：`document.documentElement.scrollWidth <= window.innerWidth`；长会话/长历史走栏内滚动；输入框与 GBH 按钮 sticky 可见；浮卡覆盖 ≤25% 且不挡航点；抽屉开无 reflow；正文对比度 ≥4.5:1（抽查 ≥5 文本节点）
- [ ] 复用走查：以「新增一个直线模板航线界面」为假设，确认只需组合现有 token+ui 组件，无需新增基础组件或第二套样式（design §T5）
- [ ] 回归：`npm test` 全绿；`npm run build`（全 workspace）成功

## Blocked By

- chat-panel-redesign
- history-panel-responsive
- map-panel-gbh-overlay

## Implementation Notes

- 本 task 不引入新行为，只做收口：跨组件视觉对齐、扫描清零、旧 class/import 清理、人工目检与对比度抽查。
- 若扫描发现可固化的约束，优先在本 task 落地最小防护（如在 verify_commands 已有的 grep 基础上，可选加 ESLint `react/no-object-inline-style`；若引入 ESLint 链成本过高则以 grep verify 为门，并在 README 或贡献说明记录该约束）。
- 不实现亮色切换、平板/手机适配、Storybook（PRD non-goal）。
- 所有 `verify_commands` 中的扫描必须真正为 0 才通过；白名单项需在代码中逐行注释说明。
