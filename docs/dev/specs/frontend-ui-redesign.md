# 技术方案：frontend-ui-redesign

- 日期：2026-08-24
- 状态：Draft（Planning Baseline 候选）
- 关联 PRD：`docs/prd/frontend-ui-redesign.md`
- 关联 ADR：`docs/adr/2026-08-24-frontend-ui-redesign.md`
- Parent Issue：#30

> 范围严格限定前端表层：不变功能、管线、API、数据模型、Cesium 实体逻辑、server/shared 代码。

## 1. 目标与约束摘要

把"零设计资产 + inline style + 双栏硬挤"重构为"深色 token + shadcn 基础组件 + 三栏工作台"，并保持现有 29 个前端测试全绿、所有组件可观察行为契约不变。

- 新增依赖仅限 Tailwind v4 工具链 + shadcn/Radix + cva/clsx/tailwind-merge/lucide。
- 现有 props/state 语义不变（`RouteData`/`ChatMessage`/`ChatAction`/`SubmitStatus`/`RouteSummary`）。
- 测试栈不变：Vitest + RTL + jsdom；jsdom 无布局引擎，视觉/尺寸类断言需明确划到人工目检或浏览器 verify。

## 2. 目录结构

```
frontend/src/
├── styles/
│   ├── theme.css            # @theme token 单一真相源 + :root 深色变量 + base 样式
│   └── globals.css          # @import "tailwindcss"; 引入 theme + 少量全局（html,body,#root 满高）
├── lib/
│   ├── cn.ts                # clsx + tailwind-merge
│   ├── cesium-entities.ts   # （不变，属白名单：命令式样式对象）
│   └── map-token.ts         # （不变）
├── components/
│   ├── ui/                  # shadcn copy 进来的基础组件（源码自有）
│   │   ├── button.tsx  input.tsx  textarea.tsx  card.tsx  badge.tsx
│   │   ├── tabs.tsx  dialog.tsx  sheet.tsx  tooltip.tsx  scroll-area.tsx
│   │   ├── separator.tsx  spinner.tsx  sonner.tsx(或 toast)
│   │   └── ...（按需 add，不预取未用组件）
│   ├── layout/
│   │   ├── AppShell.tsx     # 三栏 Grid 骨架 + 顶栏 + 断点（≥1440 三栏 / 1366 图标栏+抽屉）
│   │   ├── TopBar.tsx       # 产品标识 · 新对话 · 降级/连接状态
│   │   ├── HistoryRail.tsx  # 笔记本下的图标窄栏（≥1440 不渲染）
│   │   └── MapOverlayCard.tsx# 地图内浮卡容器（参数卡/GBH 结果卡共用，控覆盖面积）
│   ├── chat/
│   │   ├── ChatPanel.tsx    # 迁移自 components/ChatPanel，改 className
│   │   ├── MessageList.tsx  # 消息流 + 建议 + 错误栏（从 ChatPanel 拆出，纯展示）
│   │   ├── MessageBubble.tsx# 用户/assistant/error 三态气泡
│   │   ├── ChatComposer.tsx # 输入框 + 发送按钮（loading/disabled）
│   │   └── RouteCard.tsx    # 迁移；参数卡样式，可放到地图浮卡
│   ├── history/
│   │   ├── HistoryPanel.tsx # 迁移；大屏侧栏 / 笔记本 Sheet 抽屉 两种容器
│   │   └── RouteListItem.tsx# 单条航线：状态徽章 + 续编/再提交
│   ├── map/
│   │   ├── RouteMap.tsx     # 迁移；保留 CESIUM_BASE_URL/entities 逻辑，去掉 inline 布局样式
│   │   └── GbhPanel.tsx     # 从 GBHSubmitBar 迁移为地图浮卡（按钮 + 结果状态徽章）
│   └── state/  api/         # 不变
├── App.tsx                  # 组合 AppShell + 三栏 + ChatProvider
└── main.tsx                 # import './styles/globals.css'
```

不预建抽象：`MessageList`/`MessageBubble`/`ChatComposer` 仅在迁移 ChatPanel 时自然拆出（原 ChatPanel 已含 header/list/form/error，拆分降低单文件复杂度且便于测试），不为未来几何模板预留接口。

## 3. Design Token（theme.css）

`@theme` 定义 Tailwind 识别的 token；颜色用 HSL 通道变量（shadcn 标准），背景做多级表面层次以营造驾驶舱纵深。

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;

  /* 颜色：HSL 通道，utility 如 bg-background = hsl(var(--background)) */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-border: hsl(var(--border));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-accent: hsl(var(--accent));
  /* 状态色 */
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --color-destructive: hsl(var(--destructive));
  --color-info: hsl(var(--info));

  /* 间距/圆角/阴影用 radii/spacing 命名（Tailwind v4 自动映射） */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
}
:root {
  /* 深色科技驾驶舱色板（精确值在实现时微调，但必须全部走变量） */
  --background: 222 47% 6%;      /* #0a0f1a 级近黑蓝 */
  --card: 222 40% 10%;
  --muted: 220 30% 16%;
  --border: 215 28% 22%;
  --foreground: 210 40% 96%;
  --muted-foreground: 215 20% 65%;
  --primary: 199 89% 55%;        /* 科技青蓝，呼应 Cesium 地球/航线 */
  --primary-foreground: 222 47% 8%;
  --accent: 188 80% 50%;
  --success: 152 70% 45%;
  --warning: 38 85% 55%;
  --destructive: 0 72% 58%;
  --info: 199 89% 55%;
}
```

- 背景层级通过 `--background < --card < --muted` 三级表面拉开，地图面板用半透明 `bg-card/80 backdrop-blur` 与 Cesium 融合。
- 字体走系统字体栈为主（不强制网络字体，避免演示离线风险）；品牌字号/字重在 base 样式设定。
- **唯一真相源**：禁止在任何 `.tsx` 出现 `#xxx`/`rgb()`/`hsl()` 字面量（Cesium 命令式颜色除外，见 §7 白名单）。

## 4. 三栏布局与响应式（AppShell）

用 CSS Grid 描述列宽，断点 `xl: ≥1440px`（Tailwind 默认 xl=1280，需在 `@theme` 自定义 `--breakpoint-xl: 1440px`，或用 `min-[1440px]:` 任意值 variant）。

```
顶栏 h-14（sticky top-0）
Grid 主体（calc(100vh-3.5rem)）:
  ≥1440: [历史 280px] [对话 420px] [地图 1fr(取剩余，最大主区)]
  1366:  [图标栏 48px] [对话 minmax(380px,420px)] [地图 1fr]
         历史以 Sheet（右/左滑出抽屉）承载
  <1366: 不承诺（按三栏降级但不保证不碎，PRD 非目标）
```

- 列用 `minmax(0, …)` 防止 Grid 子项内容撑破导致整页横向滚动（PRD 9.2 `scrollWidth<=innerWidth` 的关键防线）。
- 每栏内部 `overflow-y-auto`；对话输入框（ChatComposer）与 GBH 提交按钮在各自容器内 `sticky bottom-0`，滚动时始终可见（9.2）。
- 地图栏 `relative`，`MapOverlayCard` 绝对定位贴右上/右下，`max-width` 与 `max-height` 约束覆盖面积 ≤25%（9.2）。浮卡可折叠以进一步释放地图。
- 历史抽屉用 shadcn `Sheet`，遮罩用其内置 overlay（fixed 定位，不触发布局 reflow，满足 9.2"无 reflow 跳动"）。

## 5. 组件迁移与行为保持

| 现有组件/模块 | 迁移后 | 行为契约（必须保持） |
|---|---|---|
| `App.tsx` | 拆为 `App.tsx`(组合) + `AppShell`/`TopBar` | `onResume`/`onResubmit` 回调语义、ChatProvider 包裹不变 |
| `ChatPanel` | `chat/ChatPanel` + `MessageList` + `MessageBubble` + `ChatComposer` | 发送/流式/建议/错误栏/RouteCard 渲染；`state.streaming` 时禁用发送；点击建议=发送 |
| `HistoryPanel` | `history/HistoryPanel`（大屏侧栏 / 笔记本 Sheet 复用同一内部列表） | `onResume(routeId, conversationId?)`、`onResubmit(routeId, setStatus)`；`open` 时 refresh；STATUS_LABEL 文案 |
| `GBHSubmitBar` | `map/GbhPanel`（地图浮卡） | 提交 `POST /api/routes/:id/submit-gbh`；loading 禁用；ok 显示 gbhRouteId；invalid/error 显示人类可读消息 |
| `RouteCard` | `chat/RouteCard` 或作为 `MapOverlayCard` 内容 | 展示 intent/content 字段；`route` 非空才渲染 |
| `RouteMap` | `map/RouteMap` | `window.CESIUM_BASE_URL='/cesium/'`、widgets.css import、`buildCesiumEntities`、`fetchMapToken`、props `route` 不变 |
| `chatReducer` | 不变 | 所有 action/state 语义不变 |
| `useChatStream` | 不变 | SSE 解析、conversationId 注册不变 |

**错误人类可读化**：现有 `GBHSubmitBar` 把 `invalid.errors` 直接 `JSON.stringify`、App 的 `onResubmit` 同理。PRD 9.3 要求"非原始 JSON 直接展示"。迁移时新增一个纯函数 `formatGbhError(data)`：`invalid` → 从 errors 提取字段级消息拼成中文列表（无法解析时降级为"提交校验未通过，请检查航线参数"），`error` → 透传 message，网络异常 → "网络错误，请重试"。该函数加单元测试。这是表层行为的小幅增强，不改 API。

**降级标注**：`RouteData.aiGenerated === false` 时，在 TopBar（全局）+ RouteCard/参数卡显示 shadcn `Badge variant="warning"`「非 AI 生成 · 规则兜底」。现有 reducer 已携带 `aiGenerated`，无需改 state。

## 6. 四态反馈落地（映射 PRD 9.3）

| 态 | 可观察 DOM（jsdom 可断言） | 视觉（人工目检） |
|---|---|---|
| 生成中 | 发送按钮 `disabled` + 内含 Spinner / `data-state=loading`；assistant 气泡逐 delta 增长 | 流式打字动效、按钮 loading |
| 成功 | 地图实体由 `buildCesiumEntities` 产出（jsdom 下 mock Cesium，断言调用参数）；参数卡非空字段；GBH `data-testid=gbh-status` 含 gbhRouteId 文本 | success 徽章配色、航线高亮 |
| 失败 | `data-testid=error-bar` 或 GbhPanel 错误节点存在；文本经 `formatGbhError`（不含 `{`/`"` JSON 特征）；重试按钮存在 | destructive 配色 |
| 降级 | `data-testid=degraded-badge` 存在且文本含"非 AI 生成"（当 `aiGenerated=false`） | warning 配色，不与 success 混淆 |

Cesium 在 jsdom 中不可用，现有 `RouteMap` 测试策略需保持/调整为：mock `cesium` 模块与 `fetchMapToken`，断言 entity 构建参数与容器 ref，不断言真实渲染。

## 7. inline style 清零策略（PRD 9.4）

- 业务组件一律 Tailwind utility / `cn()`。
- **白名单**（保留 `style={{}}`，逐处加 `// eslint-disable-next-line` 或注释说明）：
  1. `cesium-entities.ts`：`new Entity({ polyline: { material: Color… } })` 等 Cesium 命令式 API 入参——这不是 JSX inline style，是 Cesium 配置对象，本就不受 JSX 扫描影响。
  2. `RouteMap` Cesium container 的运行时像素尺寸（若 Cesium Viewer 构造需要显式 sizing）——优先用 CSS class，确需运行时值才保留。
- 防回归：在 `frontend` 加 ESLint 规则 `react/no-object-inline-style`（项目当前无 ESLint 配置——见下"依赖"，若引入 ESLint 成本过高，改用 `verify_commands` 中的 grep 扫描作为门）。
- verify 扫描命令（写进相关 Task 的 `verify_commands`）：
  ```bash
  # JSX inline style 计数（白名单除外）应为 0
  grep -rnE "style=\{\{" frontend/src --include="*.tsx" | grep -v "cesium-entities" | wc -l
  # 硬编码颜色字面量（token 定义文件除外）应为 0
  grep -rnE "#[0-9a-fA-F]{3,8}|rgb(a)?\(|hsl(a)?\(" frontend/src --include="*.tsx" | grep -v "styles/theme.css" | wc -l
  ```

## 8. 依赖与配置变更

`frontend/package.json` 新增：
- `tailwindcss`、`@tailwindcss/vite`（devDeps）
- `class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`、`lucide-react`
- shadcn add 拉入的 `@radix-ui/react-*`（dialog/sheet/tooltip/tabs/scroll-area/separator/label 等，按需）
- 可选 `eslint` + `eslint-plugin-react` 以启用 inline-style 规则；若不想引入 ESLint 链，则用 §7 的 grep verify。

配置：
- `vite.config.ts`：plugins 数组加入 `tailwindcss()`（放在 `react()` 后）；保留现有 cesium static-copy 与 proxy。
- `components.json`：shadcn 配置（style: new-york 或 default、baseColor: neutral、cssVariables: true、tailwind.config 指向 v4 CSS 路径、aliases: `@/*` → `src/*`、ui → `components/ui`）。
- `tsconfig.json`：加 `"paths": { "@/*": ["./src/*"] }` 与 `vite-env.d.ts`（shadcn 用 `@/` 别名）。需在 `vite.config.ts` 配 `resolve.alias`。
- `main.tsx`：`import './styles/globals.css'`。
- `index.html`：`<html lang="zh-CN" class="dark">`（深色默认）。

## 9. Cesium 集成风险与预案

- **Tailwind preflight 与 Cesium widgets.css 冲突**：preflight 重置 button/input 等，可能影响 Cesium 自带控件（geocoder、navigation help button）。预案：
  1. 优先验证：启动 dev server 目视 Cesium 控件；
  2. 若冲突，在 `theme.css` 用 `@layer base` 对 `.cesium-widget, .cesium-viewer *` 做最小 reset 豁免（不全局关闭 preflight）；
  3. Cesium 容器设 `bg-transparent` 或深色背景与 UI 融合，避免默认蓝地球外的白边。
- **静态资源**：现有 `viteStaticCopy` + `CESIUM_BASE_URL` 不变。
- **地图浮卡遮挡**：浮卡 z-index 高于 Cesium canvas 但 ≤25% 面积；可折叠；航点主体（环绕圆）居中，浮卡贴边不压中心。

## 10. Testing Decisions

逐条映射 PRD §9。Test Level 区分：`unit`（Vitest 纯函数/reducer）、`component`（RTL + jsdom）、`scan`（grep/脚本 verify_command）、`manual`（浏览器 + 两断点目检，现有栈无法自动化）。

### T1 视觉一致性（PRD 9.1）
- Test Seam: `scan` —— 对 `frontend/src/**/*.tsx` 扫描硬编码颜色字面量与 inline style；`unit` —— token 定义存在且被 Tailwind 识别（`globals.css` 含 `@theme`）。
- Observable Result: 硬编码颜色命中数=0（白名单外）；同类基础控件均来自 `components/ui`（import 路径检查）。
- Test Level: `scan`（verify_command）+ `manual`（对比度 ≥4.5:1、无截断/重叠，两断点抽查 ≥5 文本节点）。
- 说明：对比度/像素重叠无 jsdom 布局，不可伪造为自动测试，明确 manual。

### T2 布局无遮挡/无硬挤（PRD 9.2）
- Test Seam: `component`（AppShell 渲染后 DOM 结构与 class 断言：三栏容器存在、列含 `minmax(0,…)`、滚动容器 class）；`scan`；`manual`。
- Observable Result:
  - AppShell 在 `≥1440` 渲染三个栏节点 + 顶栏；`1366` 宽度（jsdom 不能真改窗宽，但可断言 HistoryRail 存在且 HistoryPanel 包在 Sheet 内）渲染图标栏。
  - 无 `overflow` 致整页滚动的 class（断言 body/root 容器 class 含 `overflow-hidden`/`h-screen`，各栏 `min-w-0 overflow-y-auto`）。
  - `MapOverlayCard` 存在 `max-w`/`max-h` 约束 class（覆盖面积约束的代码表达）。
- Test Level: `component`（结构断言）+ `manual`（真实浏览器两断点：`scrollWidth<=innerWidth`、长列表滚动时输入框 sticky 可见、浮卡覆盖 ≤25%、抽屉打开无 reflow）。
- 说明：`scrollWidth<=innerWidth` 依赖真实布局，jsdom 恒为 0，归 manual 并在 verify 清单给出控制台断言语句。

### T3 流程反馈四态（PRD 9.3）
- Test Seam: `component` —— 现有 ChatPanel/GBHSubmitBar 测试 seam 扩展；`unit` —— `formatGbhError`。
- Observable Result:
  - 生成中：`send` 触发后发送按钮 `disabled`，消息列表出现空 assistant 气泡（stream_start）。
  - 成功：route_generated 后参数卡字段非空；GBH mock fetch 返回 ok，`gbh-status` 文本含 gbhRouteId。
  - 失败：`formatGbhError(invalid)` 输出不含 `{`/`"`；GbhPanel 错误节点存在且文本为人类可读；重试按钮可点。
  - 降级：渲染 `aiGenerated=false` 的 route 时 `[data-testid=degraded-badge]` 存在，文本含"非 AI 生成"。
- Test Level: `component`（RTL，mock fetch / Cesium）+ `unit`（formatGbhError 表驱动）+ `manual`（断网/500/关 Key 真触发）。
- 复用现有：`ChatPanel.test.tsx`/`GBHSubmitBar.test.tsx`/`useChatStream.test.tsx` 的 mock 模式，不新建生产抽象。

### T4 inline style 清零（PRD 9.4）
- Test Seam: `scan` —— grep 计数（§7 命令）。
- Observable Result: `style={{` JSX 命中数=0（白名单逐行核对）；颜色/间距/字体/圆角/阴影未经 inline 承载。
- Test Level: `scan`（verify_command，作为 Task 的 verify_commands 之一）。
- 这是硬自动门：计数非 0 即 fail。

### T5 设计基座可复用（PRD 9.5）
- Test Seam: `scan` —— 目录与 import 检查；`unit` —— `cn()` 工具。
- Observable Result:
  - `components/ui/` 存在且 `Button` 等被业务组件 import（grep `from '@/components/ui/` 命中数 > 0）。
  - token 定义只在 `styles/theme.css`（`grep -r "@theme" frontend/src/styles` 命中 1 处）；业务组件无颜色字面量（与 T1 复用扫描）。
  - `cn()` 存在并被 ui 组件用于 variant 合并。
- Test Level: `scan` + `manual`（以"新增直线模板界面"为假设走查：是否需新增基础组件/第二套样式）。
- 说明：最后一项是架构判断，归 manual review。

### T6 回归（现有契约保持）
- Test Seam: 现有 `*.test.tsx`/`*.test.ts` 全套。
- Observable Result: 29 个现有测试全部通过；重命名/拆分后更新 import 与 testid（若 testid 变化需同步测试，但优先保留 `data-testid`：`gbh-bar`/`gbh-submit`/`gbh-status`/`history-panel`/`error-bar`）。
- Test Level: `component`+`unit`（`npm test`，CI 把关）。

## 11. 实施切片建议（供 flow-tasks 参考，非 Task 定义）

tracer-bullet 顺序，每片可独立验证、合并后仓库可工作：

1. **基座切片**：装 Tailwind v4 + shadcn 初始化 + theme.css + cn + 全局样式；`main.tsx` 引入；跑通现有测试（视觉暂不变或仅底色）。验收 T4/T5/T6 起点。
2. **AppShell + TopBar**：三栏 Grid + 断点 + 顶栏；把现有 ChatPanel/HistoryPanel/RouteMap/GBHSubmitBar 原样放进三栏（先不重样式），验证布局结构 T2 与回归 T6。
3. **基础组件 + ChatPanel 迁移**：add 需要的 ui 组件；ChatPanel 拆 MessageList/Bubble/Composer 并换 token；保留 testid，T3 生成中/错误 + T1。
4. **HistoryPanel 迁移 + 响应式**：RouteListItem 状态徽章；大屏侧栏 / 笔记本 Sheet；T2 响应式。
5. **地图区 + GbhPanel 浮卡**：RouteMap 去 inline + MapOverlayCard + GbhPanel 浮卡 + formatGbhError + 降级徽章；T3 全四态、T2 覆盖面积。
6. **RouteCard/参数卡 + 视觉打磨**：参数卡浮卡、Cesium 面板融合、状态色贯穿；T1 对比度、T5 复用走查；两断点人工目检。

每片合并后 main 可运行（dev server 能起、测试绿），不留空壳。

## 12. 非目标 / 不做

不改 server/shared/API/数据模型；不做平板手机适配；不做亮色切换（token 预留能力）；不产出 Storybook/独立规范站；不做地图手动编辑；不引入第二套 UI 库/CSS-in-JS；不重构 chatReducer/useChatStream/cesium-entities 的逻辑。
