# 技术方案：前端布局重构 + AI 交互栏

> 日期：2026-08-24
> 关联 PRD：`docs/prd/frontend-layout-ai-composer.md`（Issue #45）
> 关联 ADR：`docs/adr/2026-08-24-frontend-layout-ai-composer.md`
> 基线分支：`feat/frontend-layout-ai-composer-design`

本方案只描述 what/how（模块、接口、seam、测试决策），不贴大段实现代码。token 精确数值、圆角选择等视觉微调在实现阶段按 DESIGN.md token 体系落地。

## 1. 范围与不变量

**变更**
1. `AppShell` 骨架：全宽 TopBar + 三栏（history-aside/rail | chat | map）→ 左 `NavRail` + 右主工作台（内嵌 `WorkspaceHeader` + 对话列 + 地图列）。历史**始终**通过 Sheet 抽屉打开（不再因 ≥1440 常驻侧栏）。
2. `ChatPanel`：手写消息列表 + `input+发送按钮` → shadcn 官方 chat 组件消息滚动 + 大圆角 `Composer`（空态问候/建议、多行自适应、Enter/Shift+Enter、流式停止）。
3. 流式状态：`chatReducer` + `useChatStream` → `@ai-sdk/react` `useChat` + 自定义 `ChatTransport`。

**不变**
- 后端 REST/SSE 契约不变：`POST /api/conversations` → `{conversationId}`；`POST /api/conversations/:id/messages`（body `{text}`）→ SSE `data: <AgentEvent>`；`GET /api/conversations/:id`；`GET /api/routes/:id`；`POST /api/routes/:id/submit-gbh`。
- `AgentEvent` 联合类型（`text_delta | clarification | route_generated | error | done`，见 `shared/src/events.ts`）不变。
- `RouteMap`、`GbhPanel`、`HistoryPanel`/`RouteListItem`、`MapOverlayCard`、`format-gbh-error`、`cesium-entities` 的对外可视行为与测试不变；仅 `GbhPanel`/`RouteMap` 改从新的 route 来源取数（见 §4）。
- 深色 design token（`styles/theme.css`）为唯一真相源；新增样式只走 Tailwind 语义类，不新增颜色字面量、不新增 inline style。

## 2. 依赖与第三方组件

- 新增 npm 依赖：`@ai-sdk/react@^4`（peer 含 `react ^19.2.1`，满足 19.2.8）；`ai@^7`（仅作为 transport/chunk 类型与工具函数来源，tree-shaken，运行时不引入 provider SDK）。
- shadcn copy-in 组件（`npx shadcn@latest add message-scroller message bubble attachment marker`，`components.json` 已配置 new-york/lucide/`@/lib/cn`，与现有 button/sheet 同体系）：
  - 只用 `MessageScroller*`（滚动/锚定）、`Message*`（行布局）、`Bubble*`（气泡 variant）、`Marker`（日期/系统行）。`Attachment*` 一并 add 但 MVP 不渲染附件（`+` 按钮 disabled），保留以备后续。
- 不引入 assistant-ui / antd / copilotkit；不引入 markdown 渲染器（助手消息为纯文本 + 澄清标签，与现状一致）。

## 3. 模块设计

### 3.1 `agentEventStream`（纯转换，深 Module）

**文件**：`frontend/src/api/agent-event-stream.ts`

**Interface**
```ts
// 把后端 SSE ReadableStream<Uint8Array> 解析为 useChat 可消费的 UIMessageChunk 流。
// 纯函数：无 React、无 fetch、无全局状态，便于单测。
function agentEventToChunks(ev: AgentEvent, ctx: { routeId?: string }): UIMessageChunk[]
function sseResponseToChunkStream(
  body: ReadableStream<Uint8Array> | null,
  opts: { onRoute?: (r: RouteData) => void; signal?: AbortSignal },
): ReadableStream<UIMessageChunk>
```

**事件映射（AgentEvent → UIMessageChunk）**
| AgentEvent | UIMessageChunk |
|---|---|
| `text_delta {text}` | `text-start`（首个 delta 前发一次）→ `text-delta {delta: text}` → `text-end`（文本段结束） |
| `clarification {missing, text?}` | `data-airline-clarification`（typed data chunk，payload `{missing: string[]}`）+ 文本段（`text-start/delta/end`，内容为 text 或默认「待补充参数：…」）|
| `route_generated {routeId, content, intent, aiGenerated}` | `data-airline-route`（typed data chunk，payload 为 `RouteData` JSON） |
| `error {message}` | `error`（`new Error(message)`，人类可读；后端已保证 message 为文案） |
| `done {usage?}` | `finish`（`finishReason: 'stop'`，usage 透传到可选 usage 字段） |

chunk 构造统一用 `ai` 包导出的 chunk 助手/`DataUIMessageChunk` 类型（实现时按实际导出名调整），不手写 chunk 字面量，避免协议字段漂移。data chunk 的类型名是 `data-airline-route` / `data-airline-clarification`（即 `data-<name>` 形式），不是 `data-part-*`。


**为什么是深 Module**：解析 SSE `data:` 帧、处理半截缓冲、把领域事件翻译成 UI 流协议，是本批次最易出错的有效复杂性；把它收成一个无副作用纯函数，调用者（transport）只负责网络，测试可直接喂 `AgentEvent[]` 断言输出 chunk 序列，不需要 React/mock fetch。

### 3.2 `AirlineChatTransport`（ChatTransport 适配器）

**文件**：`frontend/src/api/airline-chat-transport.ts`

**Interface（实现 `ai` 的 `ChatTransport<UIMessage>`）**
```ts
class AirlineChatTransport implements ChatTransport<UIMessage> {
  constructor(opts: {
    // 惰性建会话：首次 send 时 POST /api/conversations 拿到后端 conversationId。
    ensureConversation: (signal?: AbortSignal) => Promise<string>
    // 当前 conversationId（newConversation 后为 null；loadConversation 后为已加载 id）。
    getConversationId: () => string | null
    // route 到达时登记 routeId→conversationId（供历史再续编）。
    registerRoute?: (routeId: string, conversationId: string) => void
  })

  sendMessages(o: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UIMessage[]
    abortSignal?: AbortSignal
  }): Promise<ReadableStream<UIMessageChunk>>

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null>  // MVP 恒返回 null
}
```

**行为**
- `sendMessages`：取最后一条用户消息文本（从 `UIMessage.parts` 的 text-part 拼接）→ `await ensureConversation()` 得 cid → `POST /api/conversations/${cid}/messages`，body `{text}`，`signal: abortSignal` → `sseResponseToChunkStream(res.body, { onRoute })`。
- `regenerate-message`：与 submit 同一端点重发最后用户消息（后端无独立 regenerate 端点；transport 把 trigger 透传，MVP 不区分）。`messageId` 忽略。
- abort：透传 `abortSignal` 给 fetch，`stop()` 即中止底层请求；已流出的 chunk 已经进入 useChat 状态，不回滚（满足 PRD 7.3）。
- `reconnectToStream` → `null`：MVP 不做断流续传（无后端支持）；返回 null 是接口允许的「无可恢复流」语义。
- HTTP 非 2xx / 网络错误：抛出 `Error`，由 useChat 记入 error 状态并经 Composer 上方 error-bar 渲染。

### 3.3 `useAirlineChat`（聚合 hook，唯一公共 Seam）

**文件**：`frontend/src/state/useAirlineChat.ts`（取代 `state/chatReducer.tsx` + `api/useChatStream.ts`）

**Interface**
```ts
interface AirlineChatApi {
  messages: UIMessage[]
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  route: RouteData | null           // 从最新 assistant 消息的 airline-route data part 派生
  errorBar: string | null           // 最近一次 error chunk 的 message，发送新消息时清空
  conversationId: string | null
  send: (text: string) => void
  stop: () => void
  regenerate: () => void
  newConversation: () => void       // 清 messages/route/error，重置 conversationId
  loadConversation: (conversationId: string, routeId: string) => Promise<void>
}
function useAirlineChat(): AirlineChatApi
```

**实现要点**
- 内部 `useRef<string|null>` 持有后端 conversationId；`ensureConversation` 封装「无 id 则 POST /api/conversations 并写入 ref + setState」。
- `const chat = useChat({ transport: new AirlineChatTransport(...), id: conversationId ?? undefined })`。`newConversation` 用 React `key` 或 `useChat` 的 `id` 切换重置（实现时二选一，以能清空消息为准；优先 `id`，配合 send 时 ensureConversation）。
- `route` 用 `useMemo` 扫描 `chat.messages`，取最后一条含 `airline-route` data part 的值；`errorBar` 从 `chat.error` 派生。
- `loadConversation`：`GET /api/conversations/:id` + `GET /api/routes/:routeId` 并行 → 把历史消息转成 `UIMessage[]`（用户 text-part、助手 text-part，clarification 转 data-part）→ `chat.setMessages(...)`，设置 route、conversationId。
- 模块级 `Map<routeId, conversationId>`（从原 `useChatStream` 迁移 `registerConversationRoute`/`conversationForRoute`），供历史项的「再续编」按钮反查 conversationId。

**为什么不是把 transport 直接暴露给组件**：会话惰性创建、历史 hydrate、route 派生、routeId↔conversationId 登记是一组耦合的状态机；散落在 App/ChatPanel 会让多个组件各自 fetch、重复接线。收成一个 hook 是唯一公共 seam——组件和测试都通过它观察/驱动行为，transport 与流解析是其内部细节。

**Context**：保留一个轻量 `AirlineChatProvider`（仅包裹 `useAirlineChat` + context），让 `AppShell`/`ChatPanel`/`WorkspaceHeader`/`RouteMap`/`GbhPanel` 共享同一份会话状态，替代原 `ChatProvider`。`useChat()` 改名导出为 `useAirlineChatContext()` 以避免与 ai-sdk 的 `useChat` 同名混淆。

### 3.4 布局组件

**`AppShell.tsx`（重写）**
- 结构：`<div class="flex h-screen"> <NavRail/> <main class="flex min-w-0 flex-1 flex-col"> <WorkspaceHeader/> <div class="grid min-h-0 flex-1 [chat-col|map-col]"> {chat}{map} </div> </main> </div>`。
- 对话列/地图列宽度沿用现有 `420px | 1fr`（≥1440）与 `minmax(380px,420px) | 1fr`（1366）。NavRail 在两断点下恒显（`w-[68px]`，取 64–72 中值）。
- 删除 `TopBar`、`history-aside`、`isWide` 下的常驻分支与 `useMediaQuery`（历史统一走 Sheet，宽度不再改变历史呈现方式，仅对话列 minmax 随宽度变化——保留一个 `(min-width:1440px)` 媒体查询只切对话列宽度）。
- Props 收敛：`{ renderHistory, chat, map }`。新对话回调经 context 获取，不再由 props 透传。

**`NavRail.tsx`（新增）**
- 纵向：`Plus`「新对话」（primary ghost 列项，点击 `newConversation`）、`History`「历史」（打开内置 Sheet，内容=`renderHistory()`）、`Settings`「设置」（`disabled`/`aria-disabled`）。底部用户区占位（圆形头像首字母 + 无菜单）。
- 每一项：图标 20px + 11px 文字，`flex-col`，`rounded-lg`，hover `bg-accent`；选中/禁用态走 token。
- 内置 Sheet（side=left, `w-80`），关闭时历史内容不挂载（沿用现有单实例 + 关闭卸载语义）。

**`WorkspaceHeader.tsx`（新增）**
- `h-12`，卡片面 + 底边框。左：标题 `header-title`（「新航线」/会话名）+ 状态点 `header-status`（submitted/streaming=Loader2+「生成中」；route 且 aiGenerated=绿+「已生成航线」；route 且 !aiGenerated=琥珀「非 AI 生成」；error=红）。中：`header-param-chips`（route.intent 的区域/高度/速度/动作非空字段渲染为 shadcn `Badge` variant=secondary；无 route 时不渲染）。右：「新对话」outline sm 按钮。
- 状态严格颜色+图标+文案成对（Status Pair Rule）。

### 3.5 对话组件

**`ChatPanel.tsx`（重写）**
- 取 `useAirlineChatContext()`。
- 空态（messages.length===0 且 status!=='streaming'）：居中 `Greeting`（星标 + 「你好，今天规划条航线？」+ 助手一句）+ 3 个 SUGGESTIONS chip（沿用现有文案与 `data-testid="suggestion"`）。
- 非空：shadcn `MessageScrollerProvider/Viewport/Content/Item` 包裹消息；用户→`Bubble variant` 实底青（`bubble-user`），助手→卡片面（`bubble-assistant`），clarification 在助手气泡内渲染「待补充参数」标签（`clarify-tag`），error chunk→错误气泡（`bubble-error`）或 error-bar（见下）。流式中末尾气泡挂 `Loader2`（`typing`）。
- `errorBar` 在 Composer 上方渲染 `role="alert"`（`error-bar`，人类可读文案）。
- 底部固定 `<Composer/>`。

**`Composer.tsx`（新增）**
- `<form>` + 多行 `<textarea>`（`rows=1`，监听 input 自适应：设 `height='auto'` 再 `scrollHeight`，clamp 到 ≤6 行行高；超过则 `overflow-y:auto`）。
- 左侧 `+` icon button `disabled`（`aria-label="附件（暂不可用）"`）。右侧：`status==='streaming'` 渲染 `Square` 停止按钮（`composer-stop`，`type=button`，onClick `stop()`）；否则 `Send` 纸飞机提交按钮（`composer-send`，disabled when 文本 trim 为空）。
- 键盘：`keydown` Enter（无 shift）→ `preventDefault` + submit；Shift+Enter 不拦截（默认换行）。IME composition 期间不拦截 Enter（`isComposing`/keyCode 229 守卫）。
- 提交：`send(text)` 后清空 textarea、重置高度。
- 外形：`rounded-2xl border bg-card shadow-sm p-2`，focus-within `ring-2 ring-ring`（token）。

## 4. 数据流与接线

```
App (AirlineChatProvider)
├─ AppShell
│  ├─ NavRail (newConversation / Sheet→HistoryPanel)
│  ├─ WorkspaceHeader (title/status/chips from context)
│  ├─ ChatPanel (messages/send/stop from context)
│  │  └─ Composer
│  └─ map: RouteMap(route) + GbhPanel(route)   // route 从 context 取，不再由 App props 透传
└─ HistoryPanel (onResume→loadConversation, onResubmit 不变)
```

- `App.tsx` 不再用 `useChatStream`/`useChat`；改为包 `AirlineChatProvider`，把 `onResume`/`onResubmit` 所需能力下沉（`HistoryPanel` 通过 context 调 `loadConversation`，或 App 仍组装回调传入——实现时取接线最少者；优先 HistoryPanel 直接用 context，App 只留 provider）。
- `GbhPanel` 的 `route` prop 改为从 context 读取（或保持 prop 由 AppShell map 区域注入）；其内部 GBH 提交/状态机不变，仅 import 的 `RouteData` 类型从新位置导出。

## 5. 类型与文件迁移

| 旧 | 新 |
|---|---|
| `state/chatReducer.tsx`（ChatProvider/useChat/ChatState/ChatMessage/RouteData） | 删除；`RouteData` 迁到 `shared`（frontend 专属可放 `state/types.ts`），消息类型改用 `UIMessage` |
| `api/useChatStream.ts`（useChatStream/registerConversationRoute/conversationForRoute/toChatMessages） | 删除；transport + useAirlineChat 取代；route↔conversation 映射迁入 useAirlineChat 模块 |
| `api/useChatStream.test.tsx` | 重写为 `agent-event-stream.test.ts`（纯映射）+ `useAirlineChat.test.tsx`（transport/状态/hydrate） |

`RouteData` 不进 `shared`（含前端 UI 状态 `aiGenerated`，且非后端线契约类型），保留在前端 `state/types.ts`。

## 6. 测试设计（沿用 vitest + @testing-library + jsdom）

### Testing Decisions

#### T1 SSE AgentEvent → UIMessageChunk 映射
- Test Seam：`agentEventToChunks(ev)` 纯函数 / `sseResponseToChunkStream(body)`（喂 `ReadableStream` of encoded SSE bytes）。
- Observable Result：输出 chunk 序列的 `type` 与 payload——text_delta 产生 text-start/text-delta/text-end；route_generated 产生含 `airline-route` data part（value 深等于 RouteData）；error 产生 error chunk（message 等于后端文案）；clarification 产生 missing data part + 文本。
- Test Level：单元测试（`agent-event-stream.test.ts`，无 React、无 fetch mock，用 `ReadableStream` 直造字节）。

#### T2 发送 → 后端两调用 → 流式渲染
- Test Seam：渲染一个调用 `useAirlineChatContext()` 的测试组件，`vi.stubGlobal('fetch')` 按 URL 返回 conversationId 与 SSE body。
- Observable Result：点发送/调 send 后，DOM 出现 `bubble-user`（文本）、随后 `bubble-assistant` 文本逐 delta 增长；fetch 被先 POST `/api/conversations` 再 POST `/api/conversations/:id/messages`。
- Test Level：组件/hook 集成测试（`useAirlineChat.test.tsx`），等价覆盖原 useChatStream 三条用例。

#### T3 流式停止
- Test Seam：同上测试组件，fetch 返回的 SSE body 持有一个可控的 `AbortSignal`；流到中途点 `composer-stop`。
- Observable Result：底层 fetch 的 `signal.aborted === true`；已渲染的助手文本仍存在（不被清空）；按钮恢复为发送态。
- Test Level：组件测试，断言 abort + DOM 文本保留。

#### T4 路由生成派生 + 顶栏 chips
- Test Seam：T2 同组件，SSE 含 route_generated。
- Observable Result：`route` 非空、`WorkspaceHeader` 出现成功状态与 ≥1 参数 chip、`GbhPanel` 提交按钮 enabled、`RouteMap` 收到 route（可用 testid/prop 断言）。
- Test Level：组件测试。

#### T5 错误与降级
- Test Seam：SSE 发 error 事件 / route_generated 带 `aiGenerated:false`。
- Observable Result：error → `role="alert"` 存在且文案不含 `{`/`}` JSON 片段，提供重试；降级 → 琥珀「非 AI 生成」徽章存在。
- Test Level：组件测试。

#### T6 历史 hydrate
- Test Seam：`loadConversation(id, routeId)`，stub GET conversations + routes。
- Observable Result：消息列表渲染历史 user/assistant 文本、route 为该 route、conversationId 设置；不产生新的 POST。
- Test Level：组件测试。

#### T7 布局结构与断点
- Test Seam：渲染 `AppShell`（provider 包裹），用 `window.matchMedia`/容器宽度模拟两断点。
- Observable Result：`nav-rail` 宽度 ∈ [64,72]；`workspace-header` 存在、`topbar`/`history-aside` 不存在；点历史出现 `role=dialog` 且历史内容单实例、关闭卸载；两断点下 `documentElement.scrollWidth <= innerWidth+1`（jsdom 不真实布局，此项以实现期 CSS 审查 + 浏览器截图走查补充，测试断言结构与 testid）。
- Test Level：组件测试（结构/交互）+ 手工两分辨率截图（布局像素）。

#### T8 Composer 键盘与自适应
- Test Seam：渲染 `Composer`（或经 ChatPanel）。
- Observable Result：Enter（无 shift）触发发送一次；Shift+Enter 不发送且 textarea 含换行；多行灌入到 7 行时 textarea `scrollHeight > clientHeight`（内部滚动）；`+` 与设置为 disabled。
- Test Level：组件测试（`fireEvent.keyDown` + `input`）。

#### T9 回归
- Test Seam：`npm test`（workspace 根 `npm test` → frontend vitest run）。
- Observable Result：既有 `MapOverlayCard`/`RouteListItem`/`HistoryPanel`/`GbhPanel`/`format-gbh-error`/`cesium-entities`/`map-token` 测试全绿；无 inline style 与硬编码颜色回归（可加一个轻量扫描测试或留在 CI grep）。
- Test Level：命令退出码 0。

## 7. 风险与对策

- **useChat v5 API 较新**：transport/chunk 助手的确切导出名以 `ai@7` 实际类型为准；先写 T1 纯映射测试锁定 chunk 形状，再接 transport。Two-way door：若 data-part 承载 route 在渲染层过于曲折，退回「transport 解析时回调写外部状态」，但优先 data-part 以保持单一状态源。
- **会话 id 与 useChat chatId 错位**：useChat 内部 `chatId` 与后端 conversationId 在首次发送前不一致；MVP 不做 `reconnectToStream`，故不影响正确性。`newConversation` 通过重建 useChat（key/id）重置，不依赖 chatId 复用。
- **shadcn chat 组件首版（2026-06）API 变动**：只采用 message-scroller/bubble/marker 等已发布件；若 add 后与现有 shadcn 版本/style 冲突，MessageScroller 行为可用 headless `@shadcn/react` 兜底，气泡保持自研（接口不变）。
- **Cesium preflight/样式**：本批次不改 Cesium 容器与 widget 样式，沿用既有豁免；Composer/NavRail 不覆盖 Cesium canvas。
- **布局回归**：AppShell 测试从「wide 常驻 / narrow 抽屉」改为「恒 NavRail + 抽屉」，旧 testid（`history-aside`/`history-rail`/`topbar`）断言删除，新增 `nav-rail`/`workspace-header` 断言。

## 8. 实现顺序建议（供 /tasks 参考，非强制）

1. 加依赖 + shadcn add chat 组件；`agent-event-stream.ts` + T1。
2. `AirlineChatTransport` + `useAirlineChat` + provider，T2/T3/T5/T6。
3. 重写 `AppShell` + `NavRail` + `WorkspaceHeader`，T7；接通 route 到 RouteMap/GbhPanel（T4）。
4. 重写 `ChatPanel` + `Composer` + 空态，T8；删除旧 reducer/hook。
5. 跑 `npm test`、浏览器两分辨率截图走查、inline-style/颜色扫描（T9）。
