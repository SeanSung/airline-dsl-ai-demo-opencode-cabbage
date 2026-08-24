# 前端布局重构 + AI 交互栏 — PRD

> 状态：Draft v1.0 · 2026-08-24
> 关联：`docs/prd/frontend-ui-redesign.md`（本 PRD 是其布局/对话层的演进修订）、`PRODUCT.md`、`docs/dev/research/ai-ui-composer-selection.md`
> 决策来源：`docs/dev/decision-map-layout-refactor.md`（dm-301 ~ dm-305 全部 resolved）
> Parent Issue（Flow Record）：#45 `frontend-layout-ai-composer`

---

## 1. Problem Statement

**谁**：航线编辑 Agent 的现场演示者、内部航线规划员，以及观看演示的领导/客户。

**什么问题**：
1. 现有「全宽 TopBar + 三栏（历史 280｜对话 420｜地图 1fr）」中，历史会话列表常驻占据整列，视觉上更像后台三栏表，而缺少参考图（Mindtrip）那种「左侧应用导航 + 右侧主工作台」的主次层次与专注感。
2. 全宽顶栏横跨左栏与主区，右主内容没有自己的标题/状态承托；当前航线的状态（生成中/已生成/降级）与参数摘要没有一个一眼可读的落点。
3. 对话输入区是一条普通的 `input + 发送按钮` 表单条，缺乏成熟 AI 产品的「大圆角 composer + 空态问候 + 建议 prompt」的欢迎感与交互完成度；流式生成期间无法中止，多行输入不支持，状态反馈弱。

**不解决的成本**：演示时界面的「agent 原生」叙事被传统后台布局削弱；后续若要加入停止生成、多轮重生成等能力，缺少一个成型的 composer 基座。

## 2. Thesis（why build it）

参考 Mindtrip 的应用骨架（左应用导航 + 右主区，右主区自带标题/状态栏，对话与地图同处一个主区，底部大圆角 AI composer），把现有三栏重构为**图标导航栏 + 右主工作台**结构，并引入成熟 AI chat 组件基座（shadcn 官方 chat 组件 + Vercel `useChat`）替换手写的流式状态与消息滚动。

- **为什么是重构而非新增**：左导航、顶栏、composer 是骨架级变更，在现有结构上叠加会产生双顶栏/双历史入口，必须干净切换。
- **为什么用现成方案**：流式滚动锚定、停止/重生成、消息可访问性是 AI UI 最易出错的部分，shadcn 官方 chat 组件（2026-06）与 `@ai-sdk/react` 已覆盖，且原生兼容 React 19 + Tailwind v4 + 现有深色 token，侵入性最低。

## 3. Goals / Non-goals

**Goals**
- 左栏由 280px 会话列表改为 64–72px 图标导航栏；会话历史改为左滑覆盖式抽屉（复用 Sheet）。
- 移除全宽 TopBar；右主区新增内嵌顶部标题/状态栏（会话标题 + 状态点 + 航线参数 chips + 新对话）。
- 对话列底部实现大圆角 AI composer（空态问候 + 建议 prompt、多行自适应、流式停止、Enter/Shift+Enter）。
- 流式对话状态迁移到 `@ai-sdk/react` 的 `useChat`，消息渲染采用 shadcn 官方 chat 组件（message-scroller/bubble/marker）。
- 现有产品功能、生成管线、GBH 链路、深色设计 token 不变。

**Non-goals（本次明确不做）**
- ❌ 不变更后端 API、SSE 事件协议、数据模型、GBH 链路（仅前端 transport 适配）。
- ❌ 不做附件/文件上传、语音输入、模型选择器、模式 tab（composer 的 `+` 与导航「设置」渲染为 disabled 占位，不接功能）。
- ❌ 不新增 Explore/Saved/Trips 等不存在的产品页面或导航入口。
- ❌ 不做平板/手机适配（沿用 ≥1366 桌面-only）。
- ❌ 不做亮色主题、不引入第二套 UI 库或 CSS-in-JS。
- ❌ 不做地图手动拖点编辑。

> **对既有 PRD 约束的明确覆盖**：`frontend-ui-redesign.md` v1.0 第 10 节曾要求「现有组件功能契约与 props 语义保持不变，现有测试须继续通过」。dm-304 已决策流式状态由 `useChat` 完全接管，故本批次**移除** `chatReducer`/`useChatStream` 并重写其测试；`ChatPanel`/`HistoryPanel`/`RouteMap`/`GbhPanel` 的对外可视行为保持，但内部接线更换。这是对该约束的有意覆盖，不是遗漏。

## 4. 目标用户与场景

沿用 PRODUCT.md：投影/大屏前演示「沧海校区环绕巡检航线」的对话式生成与 GBH 验证。重构须强化开场观感（空态问候 + 大 composer）、生成中的状态可读（顶栏状态点、composer 停止按钮）与主区专注度（图标导航不抢戏，地图与对话共处一个舞台）。

## 5. 产品形态

```
┌──────┬──────────────────────────────────────────────┐
│ 图标  │  顶部标题/状态栏：会话标题 · 状态点 · 参数chips · 新对话 │
│ 导航  ├──────────────────────────┬───────────────────┤
│      │  对话列                    │                   │
│ ✦新   │  （空态：大字问候+助手语    │   Cesium 3D 地图   │
│ ≡历史 │    + 建议chips）           │   （主区域）        │
│ ⚙设置│  消息流（shadcn scroller）  │   航线参数浮卡      │
│      │                            │   GBH 浮卡         │
│      │  ┌──────────────────────┐  │                   │
│ 用户  │  │ +  输入框…        ➤  │  │                   │
│      │  └──────────────────────┘  │                   │
└──────┴──────────────────────────┴───────────────────┘
```

### 5.1 左图标导航栏
- 宽度 64–72px，卡片面 + 右 1px 边框，纵向排列图标+小字导航项。
- 真实入口：**新对话**（Plus 图标，点击触发新会话）、**历史**（History/Menu 图标，点击打开左侧 Sheet 抽屉展示会话列表，复用现有 HistoryPanel 内容）。
- **设置**项渲染为 disabled（齿轮图标，无功能）。
- 底部用户区占位（仿图），无可点击假菜单项。
- 导航项在 1920 与 1366 两断点下行为一致（图标导航栏不再像旧版那样在 ≥1440 常驻历史列表——历史统一走抽屉）。

### 5.2 右主区顶部标题/状态栏
- 位于右主区顶部，高约 48px，卡片面 + 底 1px 边框，不跨左导航栏。
- 左：会话标题（新会话显示「新航线」，加载历史后显示会话/航线名）+ 状态点/徽章（生成中=转圈+「生成中」、已生成=绿点+「已生成航线」、降级=琥珀+「非 AI 生成」；颜色+图标+文案成对）。
- 中：当前航线参数摘要 chips（区域/高度/速度/动作，有航线后出现；无航线时该区为空，不占位挤压标题）。
- 右：「新对话」按钮（outline，sm）。
- 降级横幅全文与 GBH 结果不进顶栏（保留在对话区与地图浮卡）。

### 5.3 对话列与 AI composer
- 消息流采用 shadcn `MessageScroller` 系列组件，承担流式跟随、stick-to-bottom、jump-to-latest；气泡沿用现有深色样式（用户实底青、助手卡片面、错误危险色），语义 testid（`bubble-user`/`bubble-assistant`/`bubble-error`/`typing`）保留。
- **空态**：消息区居中显示大字问候「你好，今天规划条航线？」+ 助手一句话（带品牌星标图标），composer 上方浮 3 个现有 SUGGESTIONS 建议 prompt chip（`data-testid="suggestion"`，点击即提交）。
- **composer**：贴对话列底部，大圆角卡片（`rounded-2xl`/`rounded-3xl`）+ 1px 边框 + 轻微阴影；内为多行 `<textarea>`，左侧 `+` 按钮（disabled），右侧发送/停止按钮。
  - Enter 发送、Shift+Enter 插入换行；1–6 行内容自适应高度，超过 6 行后 textarea 内部纵向滚动。
  - 空闲态右侧纸飞机发送；流式中切换为 Square 停止图标，点击调用 `useChat` 的 `stop()` 中止当前生成（中止后已流出的文本保留，不回滚）。
  - 错误态：composer 上方 error-bar 显示人类可读错误（非 JSON/堆栈）。

### 5.4 地图列
- Cesium 地图为右主区右侧主区域，航线参数浮卡与 GBH 浮卡沿用现有 `MapOverlayCard` 定位，覆盖面积 ≤25%，不遮挡航线主体（沿用 ui-redesign PRD 9.2 约束）。
- 生成成功后地图高亮航线、参数浮卡与顶栏 chips 同步反映同一份 route 数据。

## 6. 技术选型（来自调研）

| 关注点 | 选型 | 说明 |
|--------|------|------|
| 消息滚动/气泡/标记 | **shadcn 官方 chat 组件**（`message-scroller message bubble attachment marker`，copy-in） | 仅管滚动/布局/可访问性，不接管数据；原生 React 19 + Tailwind v4 |
| 流式状态 | **`@ai-sdk/react` 的 `useChat`** | 完全接管 messages/status/stop/regenerate；自定义 transport 对接现有后端 SSE |
| composer | 自写（textarea + 按钮），shadcn Button/Textarea 原语 | 官方暂无独立 composer 组件 |
| 不引入 | assistant-ui、Ant Design X、CopilotKit、shadcn-chat | 分别因 runtime 侵入、antd+cssinjs 违反硬约束、过度工程、已停维护 |
| "windland" | 不存在该库（npm/web 三重核实） | — |

新增 npm 依赖仅限 `@ai-sdk/react`（及 `ai` 若 transport 类型需要）；shadcn chat 组件为 copy-in 源码，不是运行时依赖。后端 SSE 事件结构不变，前端 transport 把现有 `data: {AgentEvent}` 流桥接为 useChat 可消费的流。

## 7. 验收标准（Acceptance Criteria）

> 每条可独立判定 pass/fail，均含「判定：…」。验证分辨率：1920×1080 与 1366×768。

### 7.1 布局结构

- [ ] Given 应用在 ≥1366 宽度打开，When 渲染完成，Then 左侧为 64–72px 图标导航栏（含「新对话」「历史」「设置(禁用)」导航项与底部用户区），右侧为单列主工作区；判定：`getByTestId('nav-rail')` 存在且 `getBoundingClientRect().width` ∈ [64,72]；导航项可由文本/标签定位；`queryByTestId('history-aside')` 为 null（历史不再常驻侧栏）。
- [ ] Given 用户点击「历史」导航项，When Sheet 打开，Then 左侧滑出覆盖式抽屉（`role="dialog"`），内含会话历史列表，且历史列表在整棵树中只挂载一个实例；判定：`getByRole('dialog')` 存在、`getByTestId('history-content')` 出现且全树 `getAllByTestId('history-content').length === 1`；关闭后该内容从 DOM 卸载（不在隐藏 DOM 中空跑请求）。
- [ ] Given 应用渲染，When 查看右主区顶部，Then 存在内嵌标题/状态栏（不跨左导航栏），含会话标题、状态点/徽章、新对话按钮；判定：`getByTestId('workspace-header')` 存在，其 `getBoundingClientRect().left ≥ nav-rail 右边界`；`getByTestId('header-title')`、`getByTestId('header-status')`、`getByTestId('new-conversation')` 均存在；旧全宽 `getByTestId('topbar')` 不存在。
- [ ] Given 已生成航线，When 查看顶部状态栏，Then 中部显示航线参数摘要 chips（区域/高度/速度/动作中至少 1 个非空 chip）；判定：`getByTestId('header-param-chips')` 内 chip 数量 ≥1；无航线时该容器为空但不导致标题换行或溢出。

### 7.2 断点与无遮挡

- [ ] Given 1920×1080 与 1366×768 两个分辨率，When 渲染主工作台（含长消息列表与多航线历史），Then 无整页横向滚动，三区域（导航/对话/地图）互不重叠，对话输入 composer 与 GBH 提交按钮始终可见；判定：断言 `document.documentElement.scrollWidth <= window.innerWidth + 1`；两分辨率分别截图走查「无重叠/无截断/composer 与 GBH 按钮可见」清单。
- [ ] Given 长对话（消息数 >30），When 滚动消息列表，Then composer 始终贴底固定不随消息滚走，地图浮卡不覆盖 Cesium 上的环绕圆/航点主体；判定：滚动 composer 节点 `getBoundingClientRect().bottom` 与对话列底部之差 ≤ 4px；目检航线主体在未遮挡区域可见（地图浮卡覆盖面积 ≤25%）。

### 7.3 AI composer 行为与四态

- [ ] Given 空会话（无消息、非流式），When 查看对话列，Then 居中显示大字问候标题与助手一句话，composer 上方存在 3 个建议 prompt 且点击任一即发送该文本；判定：`getByTestId('composer-greeting')`、`getAllByTestId('suggestion').length === 3`；`fireEvent.click(suggestion)` 后该文本作为用户消息出现（`bubble-user`）。
- [ ] Given composer 聚焦，When 按 Enter，Then 发送当前文本；When 按 Shift+Enter，Then 在 textarea 内插入换行而不发送；判定：`fireEvent.keyDown(textarea,{key:'Enter'})` 触发发送（产生 `bubble-user`）；`fireEvent.keyDown(textarea,{key:'Enter',shiftKey:true})` 不发送且 textarea 值含换行。
- [ ] Given 输入多行文本（1→7 行），When 内容增长，Then composer 高度在 1–6 行内随内容增长，超过 6 行后 textarea 内部纵向滚动而 composer 整体高度不再增长；判定：逐行灌入文本测量 textarea/clientHeight，第 1–6 行递增、第 7 行时 scrollHeight > clientHeight 且 composer 外层高度不再增大。
- [ ] Given 正在流式生成，When 查看 composer 右侧按钮，Then 显示停止图标（Square）而非纸飞机；点击后生成中止，已流出的助手文本保留；判定：流式期间 `getByTestId('composer-stop')` 存在（`queryByTestId('composer-send')` 为 null）；`fireEvent.click(stop)` 后 fetch/流被中止（spy/fake transport 断言 abort 被调用），`bubble-assistant` 文本不被清空。
- [ ] Given 生成成功，When 查看界面，Then 助手气泡、地图航线、顶栏状态徽章（绿色「已生成航线」）、参数 chips、RouteCard 反映同一份 route；判定：`getByTestId('header-status')` 含成功态文案/图标；`getByTestId('bubble-assistant')`、地图 canvas 实体、`getByTestId('header-param-chips')`、RouteCard 同时存在。
- [ ] Given 校验失败/后端错误，When 错误到达，Then composer 上方显示人类可读错误条（`role="alert"`），文本不含原始 JSON 堆栈花括号；判定：`getByRole('alert')` 存在，其 `textContent` 不匹配 `/[{}]\s*"/`；存在可重试入口（重发/再生成按钮可点）。
- [ ] Given LLM 不可用走规则兜底，When 降级发生，Then 界面显示琥珀色「非 AI 生成」徽章且不与成功态同色；判定：`getByTestId('fallback-badge')` 存在且计算样式背景色为琥珀系（非成功绿、非主青）。

### 7.4 useChat 迁移与测试

- [ ] Given 前端代码库，When 检查流式状态实现，Then 使用 `@ai-sdk/react` 的 `useChat`，旧 `chatReducer`/`useChatStream` 模块被移除，业务组件不再 import 它们；判定：`grep -R "useChatStream\|chatReducer" frontend/src` 返回 0 命中；`grep -R "from '@ai-sdk/react'" frontend/src` ≥1；`package.json` 含 `@ai-sdk/react`。
- [ ] Given 现有 SSE 后端（`data: <AgentEvent JSON>`），When useChat 自定义 transport 发起对话，Then text_delta 增量渲染为助手气泡、route_generated 更新 route 状态（含 aiGenerated 标记）、error 进入错误态；判定：迁移/重写后的测试（fake SSE body + stub fetch）断言三事件对应的 DOM/状态，等价覆盖原 `useChatStream.test.tsx` 的三条用例，`npm test` 全绿。
- [ ] Given `npm test`（回归命令），When 在 frontend 运行，Then 全部测试通过（含迁移后的 transport 测试、AppShell/布局测试、ChatPanel/composer 测试、MapOverlayCard/format-gbh-error/cesium-entities 既有测试）；判定：`npm test` 退出码 0。

### 7.5 视觉一致性与硬编码回归

- [ ] Given `frontend/src/**/*.tsx`，When 扫描，Then JSX `style={{ ... }}` 出现次数为 0（白名单：Cesium 命令式实体图形属性与运行时像素尺寸，逐处注释）；且业务组件不出现硬编码颜色字面量（`#xxx`/`rgb()`/`rgba()`）；判定：正则扫描 `<[A-Za-z]+[^>]*\bstyle=\{\{` 计数 0（白名单逐行核对）；token 文件与 `components/ui` 之外颜色字面量计数 0。
- [ ] Given composer、导航栏、顶栏、气泡，When 在两分辨率下目检，Then 全部颜色/间距/圆角引用现有深色设计 token，无第二套圆角或配色，正文与背景对比度 ≥4.5:1；判定：截图走查 + 对比度抽查 ≥5 处文本节点 ≥4.5:1。
- [ ] Given 禁用的 `+` 与「设置」控件，When 查看，Then 二者带 `disabled`/`aria-disabled` 且点击无反应；判定：`toBeDisabled()` 或 `aria-disabled="true"` 断言通过，点击不触发回调/导航。

## 8. 技术约束（供 flow-design）

- 前端栈不变：React 19 + Vite + TypeScript + 原生 Cesium + Tailwind v4；新增依赖仅 `@ai-sdk/react`（必要时 `ai`）。
- shadcn chat 组件通过 `npx shadcn@latest add message-scroller message bubble attachment marker` copy 进 `components/ui/`，须与现有 `components.json` 配置一致。
- useChat 自定义 transport 须把后端现有 SSE（`AgentEvent`：text_delta/route_generated/error 等）映射为 useChat 流；route/errorBar 等领域状态以 data part 或伴随状态承载。
- 深色 token（`frontend/src/styles/theme.css`）为唯一真相源；composer 圆角/边框/阴影走 token 语义类。
- 现有 testid 契约（`message-list`/`bubble-*`/`suggestion`/`typing`/`error-bar`/`new-conversation`/`history-content`）保留或在迁移测试中显式更新。
- Node ≥22.19，npm workspaces 结构不变。

## 9. Open Questions（移交 design 阶段）

- [ ] useChat 自定义 transport 的具体 data part 编码（route/errorBar 如何随流携带）与后端 SSE 的精确映射。
- [ ] shadcn add 后 message-scroller 与现有深色气泡样式的融合方式（Bubble variant 映射）。
- [ ] 顶部状态栏参数 chips 的具体字段顺序、空态布局、与 RouteCard 的数据单一来源。
- [ ] 导航栏宽度精确值（64 vs 72）、图标+小字的字号/间距、用户区占位内容。
- [ ] composer `rounded-2xl` vs `rounded-3xl`、阴影强度、与对话列内边距的精确数值。
- [ ] AppShell 测试中 `topbar`/`history-aside`/`history-rail` 等 testid 的迁移映射（旧三栏语义 → 新导航/抽屉语义）。

## 10. 演示验收（Door check）

1920×1080 投影下：左图标导航栏收起历史、右主区顶栏显示「新航线」→ 空态大字问候 + 3 建议 + 大圆角 composer → 点击建议，流式输出时 composer 显示停止按钮、顶栏状态点转「生成中」→ 航线生成，地图高亮、顶栏 chips 与状态转「已生成航线」→ 一键提交 GBH，结果在地图浮卡醒目；全程无横向滚动、无 inline style、composer 始终贴底，深色驾驶舱风格统一。

---

*PRD 由 flow-requirements 澄清生成（dm-301~dm-305）；transport 实现、shadcn 组件融合、token 精确数值属 flow-design 范围。*
