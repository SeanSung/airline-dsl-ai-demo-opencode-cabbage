# Decision Map — 布局重构 + AI 交互栏批次（dm-301 起）

> 触发（2026-08-24）：用户要求参考 image.png 重构布局——(1) 左菜单栏 + 右主内容区；(2) 右主内容区顶部标题/状态栏；(3) 参考图中 AI 交互栏设计，调研 shadcn / windland 等成熟 AI UI 组件/框架。全部 Ticket 已 resolved，PRD：`docs/prd/frontend-layout-ai-composer.md`，Parent Issue：#45。
>
> 现状基线：`frontend/src/components/layout/AppShell.tsx` 已实现三栏（历史 280px | 对话 420px | 地图 1fr）+ 全宽 TopBar；样式已用 Tailwind + shadcn（Button/Sheet）。本批次在此基线上重构，非从零。
>
> 注意：image.png 已可读（Mindtrip 旅行规划界面）。左栏为窄应用导航菜单（图标+文字：Chats/Explore/Saved/Trips/Updates/Inspiration/Create + New chat + 用户卡），非会话历史列表；右主区顶部为内嵌标题/状态栏（行程名 + 筛选 chips + Invite/Trip），其下左为对话问候+大圆角 composer、右为地图。

## 背景事实

- 现有 PRD `docs/prd/frontend-ui-redesign.md` 锁定三栏工作台（历史·对话·地图）+ 顶栏 + 深色 token + shadcn/ui。
- 本次用户指令的 (1)(2) 与现有三栏**可能冲突**：图中"左菜单 + 右主内容（内含标题栏）"可能是把历史栏收成窄图标导航栏、把全局顶栏移入右主区，或把对话+地图合并为单一主区。需澄清。
- 前端已装：Tailwind v4、Radix dialog/slot/collapsible、shadcn 风格 Button/Sheet、lucide-react。**未装**任何 AI chat 专用组件库。
- 用户提及 "windland"——疑似拼写/记忆，可能指某 AI UI 框架或组件库，待调研核实。

## Tickets

| Slug | Blocked by | Status | Type | Question | Answer |
|------|-----------|--------|------|----------|--------|
| dm-301-layout-delta | — | resolved | Grilling | 参考图的"左菜单+右主内容（顶部标题栏）"相对现有三栏+全宽顶栏的具体结构差异是什么？左菜单是窄图标导航栏还是历史会话列表？右主内容是否把对话与地图合并为一个区域？ | **左栏改为窄图标导航栏 + 历史抽屉**：左栏由 280px 会话列表收成约 64–72px 图标导航栏（图标+小字，只放真实存在的入口：新对话、历史、设置/关于；不为不存在的 Explore/Saved/Trips 造假入口）；点「历史」从左滑出覆盖式抽屉展示会话列表（复用现有 Sheet）。移除全宽 TopBar，改为**右主区内嵌顶部标题/状态栏**。右主区 = 顶部标题/状态栏 + 其下对话与地图并排（对话左、地图右，保留现有 420px 对话列语义）。验收：1920×1080 下左栏宽度为 64–72px 且含图标+文字导航项；历史列表默认不在 DOM 常驻、点「历史」后出现 Sheet 抽屉（role=dialog）；右主区顶部存在标题/状态栏且不跨左栏；1366×768 下左栏保持图标栏、对话与地图不重叠；判定：DOM 断言（导航栏 testid、Sheet role=dialog、状态栏 testid）+ 两分辨率截图走查 |
| dm-302-composer-visual | dm-301 | resolved | Grilling | 图中 AI 交互栏的精确形态：位置（底部常驻/居中欢迎屏/浮层）、外形（圆角药丸/卡片）、包含元素（输入框、发送、附件、模型选择、模式 tab、建议 chips、语音等）、空态与对话中态差异 | **贴底大圆角卡片 + 空态问候**：composer 始终贴对话列底部；空态显示大字问候（「你好，今天规划条航线？」）+ 助手一句话 + composer 上方浮 1–3 个建议 prompt chip；对话态消息区在 composer 上方滚动。外形：大圆角卡片（rounded-2xl/3xl）+ 1px 描边 + 轻微阴影，多行自动增高（1–6 行后内部滚动）；左侧 `+` 按钮、右侧纸飞机发送；**不做语音按钮、不做模型选择器/模式 tab**（图中语音按钮为装饰，MVP 无语音能力）。验收：空态下存在问候标题与 ≥1 个建议 chip（data-testid=suggestion 仍存在）；composer 位于对话列底部且不随消息滚动（sticky/固定）；流式中发送按钮切换为停止动作（见 dm-304）；判定：DOM 断言 + 1920/1366 截图走查 |
| dm-303-ai-ui-research | — | resolved | Research | 成熟 AI chat UI 实现方案：shadcn 官方/社区 AI 组件、assistant-ui、Ant Design X、Vercel AI SDK UI、"windland" 真身、CopilotKit 等；与现有 React19+Tailwind v4+shadcn 栈的契合度与侵入性 | **最小侵入组合**：(a) shadcn 官方 chat 组件（2026-06 发布：`message-scroller message bubble attachment marker`，copy-in，原生 React19+Tailwind v4，仅管滚动/气泡/附件/标记，不接管数据）；(b) `@ai-sdk/react` 的 `useChat`（仅流式状态 hook，可自定义 SSE transport 对接现有后端）；(c) composer 输入框自写或从 prompt-kit/AI Elements 精选 copy-in。**不引入** assistant-ui（自带 runtime 接管状态）、Ant Design X（需 antd+cssinjs，违反硬约束）、CopilotKit（全栈过度工程）、shadcn-chat（作者已停维护）。**"windland" 经 npm/web 三重核实不存在该库。** 新增依赖仅限 `@ai-sdk/react`；其余为 copy-in 源码，无第二套 UI 库/运行时。详见 `docs/dev/research/ai-ui-composer-selection.md`。选型不直接产生用户可见行为，无附验收 |
| dm-304-composer-behavior | dm-302, dm-303 | resolved | Grilling | AI 交互栏的行为细节：流式状态方案、空态建议 prompts、流式中禁用/停止、多行自适应高度、快捷键、错误态、与地图/参数卡的状态联动、顶栏内容、占位元素 | **(a) 流式状态完全采用 `@ai-sdk/react` 的 `useChat`**：messages/streaming/stop/regenerate 全由 useChat 管，自定义 transport 对接现有后端 SSE；route/errorBar/GBH 等领域状态也纳入 useChat 的 data/tool part 或随附状态（完全接管，不保留独立 chatReducer/useChatStream）；重写 `useChatStream.test.tsx` 为 useChat transport 层测试；组件对外 props 语义尽量保持但内部接线更换。**(b) composer 行为**：Enter 发送、Shift+Enter 换行；多行 1–6 行自适应、超出内部滚动；空态建议 chips 沿用现有 SUGGESTIONS 三条；流式中发送按钮切换为停止图标（Square），点击调 `stop()` 中止；错误态沿用 error-bar（人类可读文本，非 JSON/堆栈）；生成成功后地图高亮、RouteCard/参数卡与顶栏 chips 同步显示结构化意图。**(c) 顶部标题/状态栏（右主区内嵌）**：左=会话标题（新会话「新航线」/加载历史后为会话名）+ 状态点（生成中/已生成/降级「非 AI」，颜色+图标+文案成对）；中=当前航线参数摘要 chips（区域/高度/速度/动作，生成后出现）；右=「新对话」按钮；降级横幅与 GBH 状态不进顶栏。**(d) 占位元素保留并禁用**：composer 左侧 `+` 按钮渲染为 disabled（无附件能力），左导航栏「设置」图标项渲染为 disabled；不造假功能、不出现点击无反应的 enabled 控件。验收：useChat 接线存在且旧 useChatStream/chatReducer 被移除；流式中点发送按钮=stop（abort 当前请求，DOM 出现停止图标）；Enter 发送、Shift+Enter 插入换行（多行 textarea）；空态 3 个 suggestion 可点提交；顶栏含标题 testid、状态点、生成后 ≥1 参数 chip、新对话按钮；disabled 控件含 disabled 属性；判定：组件测试（点发送→中止、键盘事件、disabled 断言）+ DOM 断言 + 现有测试迁移后全绿 |
| dm-305-acceptance | dm-304 | resolved | Grilling | 本批次可判定验收标准（布局结构断言、断点、AI 栏各状态 DOM 断言、无 inline style 回归、现有测试通过） | 见 PRD `docs/prd/frontend-layout-ai-composer.md` 第 7 节「验收标准」：布局结构（7.1）、断点（7.2）、AI composer 四态与键盘行为（7.3）、useChat 迁移与测试（7.4）、视觉/inlinestyle/硬编码颜色回归（7.5）。每条含 DOM 断言/命令/目检判定方法 |
