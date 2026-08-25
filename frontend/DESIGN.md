---
name: 航线编辑 Agent
description: 深色"飞行控制台"设计系统——深蓝面板、青色雷达辉光，服务于对话式航线生成与 Cesium 3D 地图。
colors:
  bg-void: "#0b111e"
  surface-card: "#121a2b"
  surface-popover: "#0e1525"
  surface-muted: "#1d2434"
  surface-secondary: "#20283c"
  border-soft: "#283248"
  input-stroke: "#252d41"
  text-primary: "#f3f5f7"
  text-muted: "#97a3b4"
  primary-cyan: "#26b2f2"
  primary-cyan-bright: "#9fddf9"
  accent-deep: "#11465f"
  success-waypoint: "#2dbe7a"
  warning-fallback: "#f6a823"
  danger-text: "#e56161"
  danger-solid: "#d32222"
  # Cesium 3D 地图命令式实体（非 CSS，绕过 Tailwind token；对齐设计系统主色，仅在 cesium-entities.ts 使用）
  cesium-nest: "#2dbe7a"
  cesium-route: "#26b2f2"
typography:
  body:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
  metric:
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary-cyan}"
    textColor: "{colors.bg-void}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-cyan}"
    textColor: "{colors.bg-void}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input-field:
    backgroundColor: "{colors.bg-void}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  card-surface:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px"
  badge-status:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  bubble-user:
    backgroundColor: "{colors.primary-cyan}"
    textColor: "{colors.bg-void}"
    rounded: "{rounded.xl}"
    padding: "8px 14px"
  bubble-assistant:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "8px 14px"
---

# Design System: 航线编辑 Agent

## Overview

**Creative North Star: "飞行控制台 (Flight Console)"**

界面是一台无人机地面控制站的飞行控制台：冷调深蓝面板承托读数，青色如同雷达扫描光，标记唯一的"航向"——对话与航线。操作员（演示者）站在投影前，需要一眼读到状态、一下找到动作、一次提交验证。功能至上，但不靠密集堆叠威吓人；面板边缘、浮卡、Cesium 3D 地球融合成同一台仪器，而不是浮在地图上的白框。

系统用克制的色调分层代替厚重阴影制造纵深：背景、卡片、弹层是三级深面，1px 低对比边框界定边界，只有浮在地图上的卡片和抽屉才抬起阴影。青色（primary）是稀缺的注意力货币，只给主操作、当前航向与关键标识；状态（成功绿、降级琥珀、危险红）成对出现，颜色永远伴随图标/文案，投影与色弱场景下同样成立。

**Key Characteristics:**
- 深色三级表面（void → card → popover）+ 1px 柔边框，阴影仅用于浮层。
- 青色单一主色，稀缺使用，承担主操作与品牌辉光。
- 紧凑仪器密度（14px 正文、36px 控件、12px 间距），保证投影可读与信息密度；圆角中带柔和（卡片 12px、气泡 16px），向"柔和现代"靠拢而非冰冷军工。
- 地图即舞台：浮卡玻璃质感、覆盖受控，不遮挡航线主体。
- 所有状态四态可辨（生成中/成功/失败/降级），状态不靠颜色单独编码。

## Colors

冷调深蓝仪器底色 + 单一青色航向光，辅以绿/琥珀/红三个语义状态色。全部为深色主题，不实现亮色切换。

### Primary
- **航向青 (Primary Cyan)** (`#26b2f2`)：主按钮填充、用户气泡、发送/提交动作、聚焦环（ring）、品牌图标、关键链接与标题强调。是全屏最亮的冷色，稀缺出现。
- **亮青 (Primary Cyan Bright)** (`#9fddf9`)：深青底上的文字与悬停前景（accent-foreground），用于 hover 态文字对比。
- **深青面 (Accent Deep)** (`#11465f`)：ghost/outline 悬停时的填充底色，以同色系暗面承接交互。

### Secondary / Tertiary
- **次级表面 (Surface Secondary)** (`#20283c`)：次级按钮填充、"非 AI 生成"中性徽章底色。
- **静默表面 (Surface Muted)** (`#1d2434`)：草稿徽章等静默中性块的填充。

### Neutral
- **虚空底 (Bg Void)** (`#0b111e`)：应用与对话列最底层背景。
- **卡片面 (Surface Card)** (`#121a2b`)：卡片、顶栏、历史栏、输入区、助手气泡的标准表面。
- **弹层面 (Surface Popover)** (`#0e1525`)：Sheet/抽屉等浮层表面，比卡片更沉以拉开层级。
- **主文字 (Text Primary)** (`#f3f5f7`)：正文与标题。
- **次文字 (Text Muted)** (`#97a3b4`)：辅助说明、占位符、图标、元信息。
- **柔边框 (Border Soft)** (`#283248`)：卡片、面板、分隔线的标准 1px 边框。
- **输入描边 (Input Stroke)** (`#252d41`)：输入框边框，略沉于柔边框。

### Semantic Status
- **航点绿 (Success Waypoint)** (`#2dbe7a`)：GBH 验证通过、已验证状态。文字用纯绿，底色以 `/10`、`/15` 半透明铺底。
- **降级琥珀 (Warning Fallback)** (`#f6a823`)：规则兜底"非 AI 生成"徽章的实底，深色上高可见。
- **危险文字 (Danger Text)** (`#e56161`)：深底上的错误文案/边框（对比度 ≥4.5:1）。
- **危险实底 (Danger Solid)** (`#d32222`)：destructive 按钮与错误气泡底（白字 ≥4.5:1）。

### Named Rules
**The One Voice Rule.** 青色主色出任意一屏的面积应保持稀缺（主操作、聚焦、品牌标识、用户气泡）；它的稀有度本身就是航向。中性表面和边框承担绝大部分面积。
**The Status Pair Rule.** 成功/降级/危险状态必须颜色 + 图标 + 文案三者至少成对出现，绝不以颜色作为唯一编码。
**The No White Box Rule.** 任何浮在 Cesium 地图上的卡片使用深色半透明卡片面（`bg-card/95`，支持 backdrop-filter 时 `/80` + 模糊），禁止不透明白底割裂地图。

## Typography

**Body Font:** Inter（西文）+ PingFang SC / Microsoft YaHei（中文），system-ui 兜底
**Label/Mono Font:** 无独立等宽字体；解析详情 JSON 使用浏览器默认等宽（`<pre>`）

**Character:** 单一无衬线字体栈，西文 Inter 给仪表读数以中性几何感，中文 PingFang/雅黑保证大屏清晰。整体紧凑、字重克制（正文 400、标题 600），不使用展示字重或衬线制造"科技感"。

### Hierarchy
- **Title** (600, 0.875rem/14px, line-height 1.4)：顶栏应用名、卡片标题、航线名、Sheet 标题。
- **Body** (400, 0.875rem/14px, line-height 1.5)：对话气泡、按钮、面板正文。主工作字号。
- **Metric** (400, 0.75rem/12px, line-height ~1.6)：航线元信息（区域/半径/高度/速度/动作）、辅助说明、GBH 结果。
- **Label** (500, 0.6875rem/11px, line-height 1.3)：状态徽章、标签、"非 AI 生成"标记、解析详情按钮。

### Named Rules
**The 14px Floor Rule.** 投影场景下工作字号不低于 12px；徽章标签可用 11px，但须 font-weight 500 且不承载长句。正文与按钮统一 14px。

## Layout

三栏工作台 + 顶栏，栅格列宽随断点切换：

- **顶栏**：高 48px（`h-12`），卡片面 + 底部 1px 边框；左起品牌图标（青）+ 应用名，右侧"新对话"按钮。
- **宽屏 ≥1440px（最佳 1920×1080）**：CSS grid 三列 `[280px | 420px | 1fr]`。历史常驻 280px 侧栏；对话列固定 420px；地图列 `1fr` 占满剩余，始终为右侧主区域。
- **笔记本 1366×768**：grid 三列 `[48px | minmax(380px,420px) | 1fr]`。历史收起为 48px 图标窄条（卡片面），点击经左侧 Sheet 抽屉（宽 320px）滑出；对话与地图保持并排，地图不降级为小预览。
- **<1366px**：不承诺适配（平板/手机非目标）。

每列 `min-h-0` + 内部 `overflow-y-auto`，超出内容在列内滚动；对话输入区与 GBH 提交按钮为 sticky/固定区，滚动时始终可见。列间用 1px `border-border` 分隔，不使用阴影分割。

间距以 4px 为基数：面板外边距 12px（`p-3`），列表项间距 8px（`gap-2`），卡片内边距 12px。

## Elevation & Depth

**以色调分层为主，阴影克制。** 三级深面（void `#0b111e` → card `#121a2b` → popover `#0e1525`）配合 1px 柔边框界定绝大多数层级关系；面板在 rest 状态是平的。阴影只在元素真正"浮起"于内容之上时出现——地图浮卡、Sheet 抽屉、弹出层。

### Shadow Vocabulary
- **`shadow-sm`**：卡片与气泡在深底上的轻微分离（航线结果卡、聊天气泡）。
- **`shadow-md`**：地图上的角标徽章（map-badge）。
- **`shadow-lg`**：浮在 Cesium 上的可折叠浮卡（MapOverlayCard）、Sheet 抽屉。
- **`bg-black/60` overlay**：Sheet 打开时的全屏遮罩，带淡入淡出。

### Named Rules
**The Flat-At-Rest Rule.** 表面静止时平整，靠背景色阶 + 边框区分层级；阴影是状态（浮起、悬停、抽屉）的响应，不是默认装饰。

## Shapes

中带柔和的仪器圆角语言：
- **输入框、按钮、小徽章容器**：`rounded-md`（8px）——功能控件保持利落。
- **卡片、列表项、面板**：`rounded-lg`（12px）——标准表面。
- **聊天气泡、大容器**：`rounded-2xl`（16px），且发言侧拐角收小（用户气泡 `rounded-br-sm`、助手/错误气泡 `rounded-bl-sm`）形成对话"尾巴"方向感。
- **状态徽章、标签、建议气泡按钮**：`rounded-full`（药丸形）。
- **边框统一 1px** `border-border`；错误态用 `border-destructive/30`。聚焦统一 `ring-2 ring-ring ring-offset-2`（ring 为青色）。

无剪切异形、无粗描边、无霓虹发光边。玻璃质感仅用于地图浮卡（`backdrop-blur` + 半透明卡片面），不用于常规面板。

## Components

### Buttons
- **Shape:** 8px 圆角，36px 高（`h-9`），14px 字重 500，图标 16px，`gap-2`，`transition-colors`。
- **Primary:** 实底航向青 `bg-primary` + 虚空底文字 `text-primary-foreground`；hover `bg-primary/90`。用于发送、提交 GBH。
- **Destructive:** 实底危险红 `bg-destructive-solid` + 白字；hover `/90`。
- **Outline:** 透明底 + 1px 柔边框；hover `bg-accent`（深青面）+ 亮青文字。用于"新对话""再次提交 GBH"。
- **Secondary:** `bg-secondary` 次级表面；hover `/80`。
- **Ghost:** 无描边无底；hover `bg-accent` + 亮青文字。用于图标按钮、续编。
- **Link:** 青色文字 + hover 下划线。
- **Sizes:** default `h-9 px-4`，sm `h-8 px-3 text-xs`，lg `h-10 px-8`，icon `h-9 w-9`。
- **State:** disabled `opacity-50 pointer-events-none`；loading 内联旋转 `Loader2` 图标 + `aria-busy`；focus `ring-2 ring-ring ring-offset-2`。

### Inputs / Fields
- 对话输入框：36px 高，虚空底 `bg-background`，1px `border-input`，8px 圆角，14px，左右 12px 内边距。
- Placeholder `text-muted-foreground`；focus 去除 outline 改 `ring-2 ring-ring`。
- 无独立标签（对话式单输入）；错误通过输入区下方的 error bar 传达。

### Cards / Containers
- **标准卡片**（RouteCard、RouteListItem）：`rounded-lg border border-border bg-card p-3 text-card-foreground`，`shadow-sm`。列表项 hover 边框转青 `hover:border-primary/40`。
- **MapOverlayCard（签名组件）**：可折叠浮卡，`rounded-lg border bg-card/95 shadow-lg backdrop-blur`（支持时 `/80`）；标题栏 1px 底边框 + 折叠 chevron；定位 class 由调用方传入（右下 GBH `w-72`、左下航线信息 `w-80`、角标徽章右上）。覆盖地图面积受控，不遮挡航线主体。
- **Sheet（抽屉）**：Radix Dialog 驱动，左/右滑入，`bg-card p-4 shadow-lg`，宽 `w-3/4 max-w-sm`（历史抽屉实际 `w-80`）；遮罩 `bg-black/60` 淡入淡出。

### Chips / Badges
- 药丸形 `rounded-full px-2 py-0.5 text-[11px] font-medium`。
- 状态徽章三色：草稿 `bg-muted/text-muted-foreground`、已验证 `bg-success/text-success-foreground`、失败 `bg-destructive-solid/text-destructive-foreground`。
- "非 AI 生成"徽章：在对话 RouteCard 中用琥珀实底 `bg-warning/text-warning-foreground`（最醒目）；在历史列表中用中性次级表面 `bg-secondary/text-secondary-foreground`。同事实、不同语境强调度。
- 澄清标签：`bg-info/15 text-info` 青底青字，列出待补参数。

### Chat Bubbles
- **用户**：右对齐，`max-w-[85%]`，实底青色 `bg-primary text-primary-foreground`，`rounded-2xl rounded-br-sm`，`shadow-sm`，`whitespace-pre-wrap`。
- **助手**：左对齐，卡片面 `bg-card text-foreground border border-border`，`rounded-2xl rounded-bl-sm`；可内嵌澄清标签、流式 spinner。
- **错误**：左对齐，`border-destructive/30 bg-destructive-solid/15 text-destructive`。
- 建议 prompt（空态）：药丸形 outline 按钮，`rounded-full border bg-card text-foreground`，hover 转青边框/深青底。

### Navigation
- 顶栏：48px 高，品牌图标（青 Plane 图标）+ 应用名 600，右对齐"新对话"outline sm 按钮。
- 历史栏头部：40px 高可折叠按钮行，`HistoryIcon`（青）+ 标题 + chevron；hover 深青面。
- 笔记本下历史收入 48px 图标窄条，居中 ghost icon 按钮触发 Sheet。

### Signature Component: GBH Submit Panel
右下角浮卡（`MapOverlayCard`），宽 288px（`w-72`），含：标题"提交 GBH"（青 Plane 图标）、全宽 primary sm 按钮"一键提交 GBH"。四态：idle 可提交；loading 按钮禁用 + spinner + "正在提交模拟飞行…"；ok 绿色对勾 + "验证通过 · {gbhRouteId}"；error 红色人类可读错误文案。切换航线时状态重置。

## Do's and Don'ts

### Do:
- **Do** 所有颜色、间距、圆角、阴影走 `frontend/src/styles/theme.css` 的 design token（Tailwind 语义类 `bg-primary`、`text-muted-foreground`、`border-border` 等）；`.tsx` 中不写颜色字面量。
- **Do** 用三级深面 + 1px 边框做层级，只给地图浮卡和抽屉用 `shadow-lg`。
- **Do** 在任何成功/失败/降级状态同时给出颜色、Lucide 图标和中文文案三者中的至少两个。
- **Do** 浮在 Cesium 上的卡片用 `MapOverlayCard`（深色半透明 + backdrop-blur），宽度受控（GBH `w-72`、航线信息 `w-80`），不遮挡航线主体。
- **Do** 控件保持 36px 高、14px 正文、`rounded-md`，确保投影大屏可读；卡片/气泡用 12–16px 圆角保留柔和现代感。
- **Do** 焦点用统一 `focus-visible:ring-2 ring-ring`，不要移除 outline 后不补 ring。
- **Do** Cesium 命令式实体图形使用内联样式对象（白名单，逐处注释）；其余 JSX 用 Tailwind class。

### Don't:
- **Don't** 在 `frontend/src` 业务组件里写硬编码颜色（`#xxx`/`rgb()`/`rgba()`）或承载主题值的内联 `style={{}}`。
- **Don't** 引入第二套 UI 库、CSS-in-JS，或实现亮色主题/主题切换。
- **Don't** 用青色填充大面积表面（主色保持稀缺）；也不要给中性面板加发光/霓虹边。
- **Don't** 用底部通栏浮条遮挡地图（旧 GBHSubmitBar 模式已废弃），改用角落受控浮卡。
- **Don't** 把原始 JSON/堆栈直接显示为错误；错误经 `formatGbhError` 转人类可读文案。
- **Don't** 把规则兜底结果伪装成 AI 生成；必须显示"非 AI 生成"徽章。
- **Don't** 在 <1366px 宽度上承诺可用；平板/手机不在 MVP 范围。
