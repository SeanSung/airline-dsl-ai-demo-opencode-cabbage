# Decision Map — 基于 DSL 航线编辑脚本的大疆航线编辑 Agent

> 需求澄清决策映射（flow-requirements）。航线编辑 Agent 批次（dm-001~dm-012）已于 2026-08-21 全部 resolved，PRD：`docs/prd/airline-dsl-edit-agent.md`。2026-08-24 新增 **UI 设计批次（dm-101 起）**：用户反馈"系统没有 UI 设计、UI 混乱"。✅ UI 批次全部前沿已 resolved，PRD：`docs/prd/frontend-ui-redesign.md`。
> **2026-08-24 布局重构批次（dm-301 起，全部 resolved）**：见独立决策映射 `docs/dev/decision-map-layout-refactor.md`；PRD `docs/prd/frontend-layout-ai-composer.md`；Parent Issue #45。核心决策：左栏改 64–72px 图标导航栏（历史走 Sheet 抽屉）、移除全宽顶栏改右主区内嵌标题/状态栏、底部大圆角 AI composer、流式状态迁移到 `@ai-sdk/react` useChat（完全接管，移除 chatReducer/useChatStream）。

## 背景事实（已调研）

- 参考来源 1：`~/project/yuchen-smart-ops/` — 一网统飞低空综合作业平台，含航线规划模块（Cesium 3D 打点编辑、AirlineContent、GBH 模拟飞行下发）
- 参考来源 2：`~/project/airline-dsl-ai-demo/` — 同想法的先行实现（Go+React+Cesium）。**用户决策（dm-001）：本方案完全独立创新，不以先行实现为输入**，仅作存在性背景记录
- 当前项目（本仓库 opencode-cabbage）：用 opencode + cabbage 插件从零起步
- UI 现状（2026-08-24 侦察）：前端 React19 + Vite + 原生 Cesium；所有样式为 inline `style={{}}`，无设计 token / CSS 框架 / 组件库；布局为左栏固定 420px（ChatPanel 上、HistoryPanel 下堆叠）+ 右栏（RouteMap 满铺、GBHSubmitBar 浮于底部）。

## Tickets — 航线编辑 Agent 批次（已 resolved）

| Slug | Blocked by | Status | Type | Question | Answer |
|------|-----------|--------|------|----------|--------|
| dm-001-relationship | — | resolved | Grilling | 本仓库与 airline-dsl-ai-demo 的关系（复刻/迁移/增强） | **完全独立创新**：仅以 yuchen-smart-ops 航线规划模块 + DSL 航线脚本模块为参考，不以先行实现为输入 |
| dm-002-edit-scope | — | resolved | Grilling | "编辑航线"的 MVP 范围（生成后改参数重生成 vs 逐点微调） | **自然语言微调重生成**：MVP 编辑 = 对话式改参重生成，不做地图手动拖点（符合 agent 原生定位） |
| dm-003-interaction | — | resolved | Grilling | 对话交互深度（单轮生成 vs 多轮澄清） | **多轮澄清缺参追问**：缺关键参数（区域/高度/速度/动作）时 agent 反问补齐，参数齐全后生成 |
| dm-004-output | — | resolved | Grilling | 最终产物的"标准大疆航线"形态与出口（KMZ/WPML 下载 vs 提交模拟平台验证） | **GBH 模拟飞行验证**：生成航线一键提交 GBH 验证，地图预览 + 验证状态，形成可飞行闭环 |
| dm-005-region | — | resolved | Grilling | 演示/落地区域与基准（地图范围、机巢/起飞点坐标） | **沧海校区/机巢**：默认区域沧海校区，机巢锚定 22.531635, 113.935066，WGS-84 基准 |
| dm-006-llm | — | resolved | Grilling | LLM 选型与 Key 管理（服务端持有，可插拔 provider） | **DeepSeek，服务端持 Key**：Key 放后端环境变量，前端永不接触，CORS 收敛 |
| dm-007-stack | — | resolved | Research | 技术栈选型（后端语言/前端框架/地图组件/存储） | **后端全 TS 单栈（Node/Bun）+ 前端 React+Vite+TS + 原生 Cesium（天地图底图）+ SQLite**。详见 `docs/dev/research/tech-stack-selection.md`（后经 dm-012 修订） |
| dm-008-actions | — | resolved | Grilling | 航行动作 MVP 范围（拍照/录像/云台/悬停/返航等最小集） | **最小集**：拍照/悬停/录像 + 高度/速度/云台角/返航配置，对齐 open-api 动作子集 |
| dm-009-geometry | — | resolved | Grilling | 航线几何形状 MVP 范围（环绕/直线/之字扫掠等模板） | **MVP 仅环绕**：聚焦环绕巡检单场景演示，直线/之字后续迭代 |
| dm-010-failure | — | resolved | Grilling | 生成/校验失败处理策略（agent 引导改正 vs 静默回退） | **引导改正 + 明示降级**：错误定位到字段并引导修正；LLM 不可用时规则降级兜底且明确标注"非 AI 生成" |
| dm-011-history | — | resolved | Grilling | 航线持久化与历史管理（落库、列表、加载续编） | **落库 + 历史列表 + 加载续编**：SQLite 落库，历史列表可查看/加载续编/再次提交 GBH |
| dm-012-pi-agent | — | resolved | Research | agent server 技术选型是否采用 pi agent toolkit（earendil-works/pi） | **方案 A：直接采用 pi npm 包**：`@earendil-works/pi-ai`（统一多 provider LLM API）+ `@earendil-works/pi-agent-core`（agent loop + tool 分发 + 事件流 + 多轮状态）。**后端全 TS 单栈**：几何生成/GBH 提交/SQLite/HTTP API 全部 TS 实现，与前端同语言。不引入 experimental 的 protocol/server/client。详见 `docs/dev/research/pi-agent-toolkit.md` |

---

## Tickets — UI 设计批次（2026-08-24，全部 resolved）

> 触发：用户反馈"当前系统没有 UI 设计，UI 混乱"。PRD：`docs/prd/frontend-ui-redesign.md`。

| Slug | Blocked by | Status | Type | Question | Answer |
|------|-----------|--------|------|----------|--------|
| dm-101-ui-pain | — | resolved | Grilling | "UI 混乱"的核心痛点层次：视觉层 / 信息架构层 / 交互流程层 / 全面重设计 | **全面重设计**：视觉、信息架构、交互流程三者都不满意，以「对外演示级」标准从零做一套统一设计语言与界面，不保留现有 inline-style 结构 |
| dm-102-ui-direction | — | resolved | Grilling | 设计语言取向：组件库 vs Tailwind+自研组件 vs 纯 CSS token | **Tailwind CSS + shadcn/ui（Radix 无样式组件）+ 自研深色主题 token**：现代可高度定制、视觉独特不套壳；默认深色（契合 Cesium 地图场景） |
| dm-103-ui-canvas | — | resolved | Grilling | 目标画布与响应式：桌面大屏 / 平板 / 手机 / 单分辨率 | **桌面大屏优先，笔记本兼顾**：最佳 1920×1080，保证 ≥1440px 完整体验；1366×768 做「能用」级适配（不碎不遮）；平板/手机不支持；Cesium 地图始终为右侧主区域 |
| dm-104-design-system | — | resolved | Grilling | 设计系统沉淀程度：一次性视觉整理 vs 可复用 token + 基础组件库 vs 完整系统+文档 | **沉淀 token + 基础组件库**：design token（颜色/字体/间距/圆角/阴影/状态色）+ shadcn 基础组件主题化 + 布局骨架与通用业务组件（地图浮层/对话气泡/状态徽章/提交条），支撑后续迭代；不产出独立规范文档/Storybook |
| dm-105-layout | — | resolved | Grilling | 重设计后的布局骨架方向：地图为底+浮窗 / 左右两栏重构 / 三栏 / 对话为主 | **三栏：历史 · 对话 · 地图**：左窄栏历史/会话列表 + 中栏对话主区 + 右大栏 Cesium 地图；信息层级最清晰，对话与历史互不抢占；最佳 1920+ 大屏 |
| dm-106-narrow | — | resolved | Grilling | 1366×768 笔记本下三栏如何降级：历史收起为图标栏/抽屉、对话栏缩窄、地图保持 | **历史收起为图标栏 + 抽屉**：历史栏默认收成 ~48px 图标窄条（hover tooltip），点击「历史」按钮展开为覆盖抽屉；对话栏与地图栏保持并排，地图始终为右侧主区域 |

---

## Tickets — impeccable 审计加固批次（2026-08-24）

> 触发：`/impeccable audit` 对 frontend/ 产出 16/20 报告（1 P0 已在审计中修复、1 P1、3 P2、3 P3）。本批次把审计建议凝固为可验收需求。PRD：`docs/prd/frontend-impeccable-hardening.md`。

| Slug | Blocked by | Status | Type | Question | Answer |
|------|-----------|--------|------|----------|--------|
| dm-201-audit-scope | — | resolved | Grilling | 审计加固批次的范围边界 | **只做审计报告列出的加固项**：a11y 语义（标题层级/输入标签/减弱动效/focus ring）、Cesium 空态基座、实体色对齐；不做视觉重设计、不改触控目标（PRODUCT.md 明确桌面-only）。P0 地图坍缩已在审计中修复（AppShell map-column 加 `flex flex-col`），本批次仅以回归验收锁定 |
| dm-202-empty-map | — | resolved | Grilling | 生成航线前地图列呈现什么 | **开场即初始化 Cesium 地球基座**：Viewer 在 mount 时实例化并定位到机巢/沧海校区视角，route 到达只增删实体；无 TIANDITU_TOKEN 时退化为无瓦片暗色椭球，不得是纯黑矩形或空白。验收：空态下 `.cesium-widget canvas` 存在且高度=地图列高度，canvas 非纯黑（取中心像素亮度 > 阈值） |
| dm-203-cesium-colors | — | resolved | Grilling | Cesium 实体色 #34d399/#38bdf8 如何处理 | **统一到设计系统主色**：机巢用航点绿 #2dbe7a、航线用航向青 #26b2f2；同步更新 cesium-entities.test.ts 断言。验收：detector 对 frontend/src 零 color advisory；测试断言颜色为 #2dbe7a/#26b2f2 |
