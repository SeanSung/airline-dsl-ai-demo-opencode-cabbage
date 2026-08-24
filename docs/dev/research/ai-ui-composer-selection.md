# AI 交互栏（Chat Composer）现成实现方案选型调研

> 调研类型：Web 一手来源调研（GitHub / npm / 官方 docs）
> 调研日期：2026-08-24
> 调研者：@AiUiResearch（flow-research）
> 服务对象：航线编辑 Agent 前端重构 — AI 对话栏 / composer / conversation UI
> 结论性质：**推荐 + 证据 + 风险 + 落地建议**；决策权在 flow-design / 用户

---

## 0. 结论摘要（TL;DR）

| 决策点 | 推荐 | 关键证据 | 主要风险 |
|---|---|---|---|
| 对话滚动/消息行/气泡/附件/系统标记 | **shadcn 官方 chat 组件**（`message-scroller message bubble attachment marker`，2026-06 发布，copy-in） | 官方维护、Radix 原语、Tailwind、`@shadcn/react` headless 兜底；原生 React 19 + Tailwind v4 | 组件较新（2026-06 首版），部分组件仍在分阶段交付 |
| 流式状态/消息状态/SSE 传输 | **`@ai-sdk/react` 的 `useChat`**（仅 hook，无 UI） | Apache-2.0；peer `react ^18 \|\| ~19.0.1 \|\| ~19.1.2 \|\| ^19.2.1`；周下载 ~640 万；transport 可自定义 SSE | v5 起改为 transport 架构、移除内部 input 状态，需按新 API 写 |
| Prompt 输入框 / Markdown / 代码块 / 推理块 | **prompt-kit**（copy-in，shadcn registry）或 **AI Elements** 中挑选 | 均为 shadcn/ui 之上的 copy-paste 组件，MIT / Apache-2.0，React 19+ | 两者组件有重叠，需择一避免双份 |
| 全功能 chat 运行时（Thread/Composer/分支） | **不引入 assistant-ui** | 11.8k stars、MIT、React 19 兼容，但自带 runtime/provider，侵入性高 | 会接管 thread/composer 状态，与现有状态管理和深色 token 冲突 |
| 企业级 AI 组件套件 | **不引入 Ant Design X** | 需 `antd ^6.1.1` 作 peer、cssinjs（`@ant-design/cssinjs`） | 直接违反"不得引入第二套 UI 库 / CSS-in-JS"硬约束 |
| 全栈 Agent SDK | **不引入 CopilotKit** | 37k stars、MIT，但需后端 runtime + AG-UI 协议 + zod，体量大 | 过度工程；自带 CopilotChat/CopilotSidebar 预设 UI 难贴合驾驶舱 |
| 社区 shadcn-chat（jakobhoeg） | **不采用** | 作者 README 明示 **no longer actively maintaining**，建议改用 AI Elements / prompt-kit | 已弃维护 |

**"windland" 核实结论：不存在名为 windland 的 React/Tailwind/AI 组件库。** 详见第 4 节。

**建议新增依赖（最小集）**：`@ai-sdk/react`（流式 hook）。其余全部为 copy-in 源码（shadcn 官方 chat 组件 + prompt-kit 或 AI Elements 精选组件），不引入第二套运行时或 UI 库。

---

## 1. 范围与方法

### 1.1 现有栈（不可变更，来自 `frontend/package.json`）

- React `^19.2.8` + react-dom `^19.2.8`
- Vite `^8.2.2` + TypeScript `^7.0.2`
- Tailwind CSS `^4.3.3`（`@tailwindcss/vite ^4.3.3`）
- Radix 原语：`@radix-ui/react-dialog ^1.1.23`、`react-slot ^1.3.3`、`react-collapsible ^1.1.20`
- 样式工具：`class-variance-authority ^0.7.1`、`clsx ^2.1.1`、`tailwind-merge ^3.6.0`、`tailwindcss-animate ^1.0.7`
- 图标：`lucide-react ^1.33.0`
- shadcn/ui 风格组件以源码 copy 方式存在仓库（非 npm 依赖）

### 1.2 硬约束

1. 不得引入第二套完整 UI 库（如 Ant Design / MUI / Chakra）。
2. 不得引入 CSS-in-JS 运行时（styled-components / emotion / `@ant-design/cssinjs` 等）。
3. 可引入专注 AI chat 的 headless/无样式组件或 shadcn 兼容的 copy-paste 组件。
4. 深色"驾驶舱"风格，桌面大屏 1920×1080 优先，1366×768 降级；Cesium 3D 地图为右侧主区域。
5. 对话栏承担多轮澄清、SSE 流式输出、错误引导、降级标注。

### 1.3 方法

- 每个候选直接读取官方 GitHub README / npm registry / 官方文档页，记录 star、版本、license、peerDependencies、最近发布。
- npm 元数据通过 `npm view <pkg> peerDependencies version license` 实时查询（2026-08-24）。
- "windland" 通过 web 搜索 + `npm search windland` + `npm view windland` / `@windland/ui` / `windland-ui` 三重核实。
- 全程只读，未修改 `frontend/src`，未安装依赖，未跑构建。

---

## 2. 候选对比表

| 方案 | 形态 | License | Stars / 周下载 | React 19 | Tailwind v4 | 与 shadcn 共存 | 侵入性 | 结论 |
|---|---|---|---|---|---|---|---|---|
| **shadcn 官方 chat 组件**（message-scroller 等） | copy-in 源码 + `@shadcn/react` headless | MIT | 官方（shadcn/ui 主仓） | ✅ 原生 | ✅ 原生 | 就是 shadcn 本身 | 极低 | **采用（对话层）** |
| **AI Elements**（vercel/ai-elements） | copy-in 源码（shadcn registry） | Apache-2.0（npm）/ GitHub 标 Other | 2,356 stars | ✅ | ✅ | 构建于 shadcn/ui 之上 | 低 | **可选精选** |
| **prompt-kit**（ibelick/prompt-kit） | copy-in 源码（shadcn registry） | MIT | 2,996 stars | ✅（要求 React 19+） | ✅ | 构建于 shadcn/ui 之上 | 低 | **可选精选** |
| **@ai-sdk/react `useChat`** | npm hook（无 UI） | Apache-2.0 | ~640 万/周 | ✅（peer 含 ^19.2.1） | 无关（无 UI） | 无关 UI 层 | 低（仅状态 hook） | **采用（流式状态）** |
| **assistant-ui** | npm 包 + runtime/provider | MIT | 11,806 stars；`@assistant-ui/react` 0.15.16 | ✅（peer ^18\|\|^19） | ✅（示例已用 v4） | 可配 shadcn 主题，但自带 runtime | **高**（接管 thread/composer 状态） | 不采用 |
| **Ant Design X**（@ant-design/x） | npm 包 | MIT | 9.9 万/周；v2.9.0 | ✅（react >=18） | ❌（cssinjs） | 需 antd ^6.1.1 作 peer | **极高**（整套 antd + cssinjs） | 不采用（违反硬约束） |
| **CopilotKit** | npm 包 + 后端 runtime | MIT | 37,012 stars；react-core 1.69.0 | ✅（peer ^18\|\|^19） | 可主题化但自带 UI | 难与 shadcn 融合 | **极高**（全栈 + AG-UI + zod） | 不采用（过度工程） |
| **shadcn-chat**（jakobhoeg） | CLI copy-in | MIT | 1,624 stars | 未声明（旧） | 旧版 v3 | 可共存 | 低 | 不采用（**作者已停止维护**） |
| **windland** | — | — | — | — | — | — | — | **不存在**，见第 4 节 |

---

## 3. 每方案详评

### 3.1 shadcn 官方 chat 组件（MessageScroller / Message / Bubble / Attachment / Marker）

- **定位**：shadcn/ui 于 2026-06-26 发布的官方对话层组件集，覆盖"流式聊天最容易出错的部分"——滚动锚定、流式跟随、历史前插不跳变、跳转消息、可见性追踪、无障碍。
- **维护状态**：shadcn/ui 官方主仓维护，2026-06 首版，属第一阶段交付（conversation layer）。安装命令：
  ```bash
  npx shadcn@latest add message-scroller message bubble attachment marker
  ```
- **License**：MIT。
- **React 19 + Tailwind v4 兼容性**：原生。shadcn/ui 自 2025-02 起支持 Tailwind v4 + React 19（见 https://ui.shadcn.com/docs/tailwind-v4）。
- **与 shadcn 共存方式**：本身就是 shadcn 组件，copy 进 `components/ui/`，与现有 button/card/dropdown-menu 等同一体系、同一 CSS 变量 token。同时提供 **headless 版本** `@shadcn/react`（首个原语即 message-scroller），只做行为不做样式。
- **侵入性**：极低。`MessageScrollerProvider` 仅拥有滚动状态，不接管消息数据、AI 状态、传输、持久化、模型状态——"You bring the content renderer"。
- **可直接复用部分**：
  - `MessageScroller` / `MessageScrollerProvider` / `MessageScrollerViewport` / `MessageScrollerContent` / `MessageScrollerItem` / `MessageScrollerButton`：流式滚动、锚定、jump-to-latest（Slack/iMessage 同款行为）。
  - `Message` / `MessageAvatar` / `MessageContent` / `MessageHeader` / `MessageFooter`：消息行布局。
  - `Bubble` / `BubbleContent` / `BubbleReactions`：消息气泡（variant: default/secondary/muted/tinted/outline/ghost/destructive）。
  - `Attachment` / `AttachmentGroup`：文件/图片附件，自带 `idle/uploading/processing/error/done` 状态与 shimmer。
  - `Marker`：系统提示、日期分割线、状态行。
  - CSS 工具类：`scroll-fade`、`shimmer`（"Thinking…"状态直接用，不要自写 keyframe）。
  - 官方明确要求：**不要**自己写 `useStickToBottom` / `ResizeObserver` / 手动 `scrollTop` 计算；**不要**用 `ScrollArea` 做聊天线程。
- **风险**：
  1. 首版较新（2026-06），API 在后续阶段可能调整（官方称"taking it one piece at a time"）。
  2. Prompt 输入框（composer）尚未作为独立官方组件交付（官方示例用 `InputGroup` + `Button` 组合），需自写或从 prompt-kit/AI Elements 补。
  3. 仓库现有 shadcn 组件为 copy 方式，需确认 `components.json` 配置与官方 CLI 目标一致后再 add。
- **来源**：
  - Changelog: https://ui.shadcn.com/docs/changelog/2026-06-chat-components
  - Message Scroller docs: https://ui.shadcn.com/docs/components/aria/message-scroller
  - 官方规则（chat.md）: https://github.com/shadcn/ui/blob/main/skills/shadcn/rules/chat.md
  - Tailwind v4: https://ui.shadcn.com/docs/tailwind-v4

### 3.2 Vercel AI SDK UI — `@ai-sdk/react` `useChat`

- **定位**：框架无关的 React hook，管理聊天消息状态、流式更新、请求/中止/重发；**不含任何 UI**。v5 起改为 transport 架构，可插拔 HTTP/SSE/WebSocket。
- **维护状态**：Vercel 官方维护，周下载约 640 万，2026-08 仍频繁发布。最新 `@ai-sdk/react` 4.0.71（npm 实时查询）。
- **License**：Apache-2.0。
- **React 19 兼容性**：✅。npm 实时查询 peerDependencies：
  ```
  react: ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1
  react-dom: ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1
  ```
  本项目 React 19.2.8 落在 `^19.2.1` 范围内。
- **Tailwind v4**：无关（纯 hook，无样式/无 DOM 约束）。
- **与 shadcn 共存方式**：完全正交。`useChat` 返回 `{ messages, sendMessage, status, stop, setMessages, regenerate }`，由你把 messages 喂给 shadcn 的 MessageScroller/Message/Bubble 渲染。
- **侵入性**：低。仅替换手写的 SSE 状态管理；transport 可自定义以对接本项目后端 SSE 端点（`DefaultChatTransport` 指向 `/api/chat`，或自写 transport 对接 Go 后端 SSE）。
- **可直接复用部分**：
  - 流式消息状态机（`ready/submitted/streaming`）。
  - `stop()` 中止生成、`regenerate` 重生成、`setMessages` 编辑/重置。
  - tool call parts（航线编辑可能涉及工具调用/DSL 生成确认）。
  - 自定义 transport：可对接任意 SSE/WS 后端，不强依赖 Next.js / Vercel 运行时。
- **风险**：
  1. v5 迁移有破坏性：移除了内部 input 状态管理，input 需自行 `useState`；从 v4 升级需看迁移指南。新项目直接用 v5+ API 无历史包袱。
  2. 默认 transport 假定类 Next.js 的 fetch 流；对接 Go 后端 SSE 需实现自定义 `Transport`（工作量可控，但非零）。
  3. 不提供 Markdown 渲染、代码高亮、输入框 UI——这些需另选。
- **来源**：
  - useChat API: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
  - Chatbot guide: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
  - Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport
  - npm: https://www.npmjs.com/package/@ai-sdk/react

