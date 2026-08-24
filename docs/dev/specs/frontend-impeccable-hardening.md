# 技术方案：frontend-impeccable-hardening

> 状态：Draft v1.0 · 2026-08-24
> PRD：`docs/prd/frontend-impeccable-hardening.md`
> Parent Issue：#43
> 范围：frontend/ 加固，不改产品功能/管线，不改视觉设计。

---

## 1. 概述

将 `/impeccable audit`（16/20）的剩余发现落地为六组改动：

1. RouteMap 重构为"Viewer 挂载一次 + route 变化只增删实体"，空态即渲染地球基座。
2. 全站补语义标题层级（一个可见 `<h1>` + 各区域 sr-only `<h2>`）。
3. 对话输入框补 `aria-label`，错误态接 `aria-invalid` / `aria-describedby`。
4. `globals.css` 增加作用域受控的 `prefers-reduced-motion` 降级。
5. Cesium 实体色对齐设计系统（机巢 `#2dbe7a`、航线 `#26b2f2`）并更新断言。
6. 全局 `--ring-offset-color` 设为虚空底，保证深面焦点环可见分离。

P0 地图坍缩已在审计中修复（`AppShell` map-column 加 `flex flex-col`），本方案仅以测试/验收锁定，不再改代码。

## 2. Module 设计

### 2.1 RouteMap（重构，Interface 不变）

**Interface**
```ts
export function RouteMap({ route }: { route: RouteData | null }): JSX.Element
```
调用者契约与现状完全一致（`App.tsx` 无需改动）。

**内部结构（从单个 `useEffect([route])` 拆为两个 effect + ref）**

- `viewerRef = useRef<Viewer | null>(null)`、`cesiumRef = useRef<typeof CesiumModule | null>(null)`。
- **Mount effect（`[]`，仅一次）**：
  1. 动态 `import('cesium')`，存入 `cesiumRef`。
  2. `new Cesium.Viewer(containerRef.current, { baseLayer: false })` 存入 `viewerRef`。
  3. 加载底图：`fetchMapToken()` 成功 → 天地图 WMTS；失败 → ArcGIS World Imagery（沿用现有兜底，提取为内部 `addBaseLayer(viewer, Cesium)`）。
  4. 空态相机定位：`viewer.camera.setView({ destination: Cartesian3.fromDegrees(NEST_LNG, NEST_LAT, DEFAULT_ALTITUDE) })`，常量 `NEST_LNG=113.935066`、`NEST_LAT=22.531635`（与 dm-005 机巢锚点一致）、`DEFAULT_ALTITUDE=1500`（米，可在目检时微调）。
  5. cleanup：unmount 时 `viewer.destroy()`。
- **Sync effect（`[route]`）**：
  1. 若 viewer 尚未就绪（动态 import 竞态）则跳过（mount effect 完成后可通过一个 `ready` state 或在 mount effect 内主动调用一次 sync 来覆盖首帧；见下）。
  2. 每次先 `viewer.entities.removeAll()`。
  3. `setBadge(null); setInfo(null)`。
  4. 若 `route` 存在：`buildCesiumEntities` → `renderGeo`（内部 `viewer.zoomTo(viewer.entities)`），设置 badge/info。
  5. 若 `route` 为 null：保持空地球（不移除 Viewer、不重置相机到全局视图以外的状态）。

**竞态处理（关键）**：mount effect 是 async（动态 import Cesium + token），首个 `route` 可能在 viewer 就绪前到达。采用：mount effect 在 Viewer 创建+底图加载**完成后**，直接读取最新 `route`（通过 `routeRef` 同步保存最新 prop）调用一次 sync 逻辑；后续 route 变化由 sync effect 处理。即把"渲染实体"抽成内部函数 `syncRoute(viewer, Cesium, route)`，两处调用，避免双重竞态分支。

**为何不用更简单方案（保留单 effect）**：现状单 effect 在 `[route]` 上 create/destroy Viewer，route=null 时 effect 提前 return 根本不创建 Viewer → 空态纯黑。要满足"空态也有地球基座 + route 变化不重建 Viewer"，必须分离"Viewer 生命周期（mount）"与"实体同步（route）"，这是 AC 4.1 的直接要求，无法用更小改动达成。

**渲染部分**：保持现有 `<div ref={containerRef} data-testid="route-map">` + badge + info MapOverlayCard 结构不变；仅注释更新（"flex-1" 现在依赖 map-column 的 flex 上下文，已修复）。

### 2.2 语义标题

不引入新组件，直接在现有布局元素上加 heading，视觉零变化：

- **TopBar**（`AppShell.tsx`）：可见标题 `<span>` 改为 `<h1 className="text-sm font-semibold">航线编辑 Agent</h1>`。它在 `<header>` 内、flex 行内，样式与原 span 一致。
- **HistoryPanel**（`HistoryPanel.tsx`）：在 `<section data-testid="history-panel">` 顶部加 `<h2 className="sr-only">历史航线</h2>`（折叠 toggle 按钮保持 `<button>`，不把交互元素塞进 heading）。笔记本 Sheet 已有 Radix `SheetTitle`（渲染为 `<h2>`），不重复；sr-only h2 仅服务于常驻 aside 场景，Sheet 场景下视觉隐藏但存在两个 h2 同名——为避免重复，把 sr-only h2 放进 HistoryPanel 本身，而 Sheet 场景的 `SheetTitle` 改为 `className="sr-only"`？需权衡：笔记本 Sheet 打开时可见标题"历史航线"有价值。决策：HistoryPanel 内的 h2 始终 sr-only；Sheet 的 `SheetTitle` 保持可见。两者文本相同但分别位于不同 DOM 上下文（aside 内 vs portal 抽屉内），屏幕阅读器在任一时刻只遭遇其中一个容器，不构成同层重复。可接受。
- **ChatPanel**（`ChatPanel.tsx`）：`<section>` 顶部加 `<h2 className="sr-only">对话</h2>`。
- **GbhPanel**（`GbhPanel.tsx`）：在根 `div` 内加 `<h2 className="sr-only">提交 GBH</h2>`。MapOverlayCard 的可见标题"提交 GBH"保持视觉文本（它在折叠按钮内，不另作 heading）。
- **RouteCard**：航线名当前是带样式 div；加 `<h3 className="...现有字号字重 class...">` 包裹航线名（不新建区域 landmark，属对话区内的子标题）。检查 RouteCard 结构后在实现时套 h3，保持 class 不变。

`sr-only` 为 Tailwind 内置工具类（`position:absolute;width:1px;height:1px;...clip`），无需自定义 CSS。

### 2.3 输入可访问名称与错误关联

`ChatPanel.tsx` 表单 input：
- 加 `id="chat-input"`、`aria-label="输入航线需求"`。
- 错误条（现有 `[data-testid=error-bar]`）加 `id="chat-error"`。
- input 加 `aria-invalid={Boolean(state.errorBar)}`；`aria-describedby={state.errorBar ? 'chat-error' : undefined}`。

不改错误条既有 `role="alert"`。

### 2.4 prefers-reduced-motion（`globals.css`）

在 `@layer base` 末尾追加作用域受控的降级，**不**用全局 `*{animation-duration:.01ms}` 一刀切：

```css
@media (prefers-reduced-motion: reduce) {
  /* 旋转 spinner 静止；加载状态由 aria-busy / 文案"正在生成/提交"传达 */
  .animate-spin {
    animation: none !important;
  }
  /* tailwindcss-animate 的进出动画（Sheet/Overlay）即时完成，
     内容与遮罩立即可见、层级关系不变 */
  [data-state] {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- `.animate-spin` 作用于全部 Loader2（chat typing、history 加载、GBH 提交）——静止但图标与文案在，状态不丢。
- `[data-state]` 精确命中 Radix Sheet/Overlay（带 `data-state=open/closed`）的 tailwindcss-animate 动画，不波及普通 hover `transition-colors`（后者无 `data-state`）。这避免了审计指南警告的"抹掉有用反馈"。

### 2.5 Cesium 实体色

`lib/cesium-entities.ts`：
- 机巢 `color: '#34d399'` → `'#2dbe7a'`（success-waypoint）。
- 航线 `color: '#38bdf8'` → `'#26b2f2'`（primary-cyan）。
- `cesium-entities.test.ts` 断言 `#38bdf8` → `#26b2f2`；机巢色目前无断言，补一条 `expect(nest.color).toBe('#2dbe7a')`。

两色均为 DESIGN.md / sidecar 规范色，detector advisory 归零。

### 2.6 focus ring offset（`theme.css` / `globals.css`）

Tailwind v4 的 `ring-offset-*` 使用 `--ring-offset-color`（默认白）。当前未在主题中声明，焦点环在深面会出现白色光晕（可见但突兀）。在 `:root`（或 `@theme` 外的 base）显式设为虚空底：

```css
:root {
  --ring-offset-color: hsl(var(--background));
}
```

效果：青色 ring 与控件之间是 2px 虚空底（`#0b111e`）间隙，在卡片/浮卡（更亮的 `#121a2b`/`#0e1525`）上形成可见的深色分离，无白色光晕，契合深色主题。

> 注：此为 P3  polish，验收为 [人工目检]；若目检发现深色间隙在 void 底色按钮上反而不可见，可保留默认白或改用 `--card`，由实现阶段据实际截图定夺，不影响其他 AC。

## 3. Testing Decisions

### 3.1 空态地图基座
- **Test Seam**：`RouteMap` 组件（mount 后 DOM 中的 `.cesium-widget canvas` 与 `[data-testid=route-map]` 尺寸）。
- **Observable Result**：route=null 时 canvas 存在且高度=地图列高度；canvas 非纯黑。
- **Test Level**：运行时 smoke（Cesium 依赖 WebGL/canvas，jsdom 无法挂载，不写 vitest 单测）。验收命令：dev server 启动后浏览器 `evaluate` 断言 `mh===ch && ch>0` + 中心像素亮度 >12（PRD 4.1）。

### 3.2 route 变化不重建 Viewer
- **Test Seam**：`RouteMap` 内部 Viewer 生命周期（无 public API 直接暴露实例计数）。
- **Observable Result**：从 route=null 到 route=有值，`.cesium-widget canvas` 元素身份不变（DOM node 同一引用）；无新建 Viewer。
- **Test Level**：运行时 smoke：在 evaluate 中持有首屏 canvas 引用，点击建议 prompt 生成航线后比较 `canvas === heldRef`；并 [人工目检] 地球无闪烁重载。不为此引入测试专用抽象（避免为测而造的 Seam）。

### 3.3 语义标题层级
- **Test Seam**：`AppShell` / `HistoryPanel` / `ChatPanel` / `GbhPanel` 渲染产物的 DOM（`document.querySelectorAll('h1,h2,...')`）。
- **Observable Result**：恰好一个 h1 含"航线编辑 Agent"；h2 覆盖历史/对话/GBH；标签序列无跳级。
- **Test Level**：vitest + @testing-library/react。扩展 `AppShell.test.tsx` 断言 h1；在 `ChatPanel.test.tsx`、`GbhPanel.test.tsx`、`HistoryPanel.test.tsx` 各断言对应 h2 文本。与现有测试体系一致（这些组件已有测试文件）。

### 3.4 输入名称与错误关联
- **Test Seam**：`ChatPanel` 内 `<input>` 的 ARIA 属性。
- **Observable Result**：input 有非空 `aria-label`；注入 errorBar 状态时 `aria-invalid==='true'` 且 `aria-describedby` 指向的节点文本为错误文案。
- **Test Level**：vitest + RTL，扩展 `ChatPanel.test.tsx`（现有用例已能驱动流式/错误状态）。

### 3.5 减弱动效
- **Test Seam**：`globals.css` 中 `@media (prefers-reduced-motion: reduce)` 规则及其命中的元素。
- **Observable Result**：reduce 下 `.animate-spin` 计算样式 `animation-name==='none'`；Sheet content 的 `animation-duration` ≤ 0.01ms；默认媒体下两者恢复。
- **Test Level**：运行时 smoke（`page.emulateMedia({reducedMotion:'reduce'})` 后读 `getComputedStyle`）+ [人工目检]。CSS 媒体查询无法在 jsdom 中可靠断言，不写脆单测。

### 3.6 Cesium 实体色
- **Test Seam**：`buildCesiumEntities(content, aiGenerated)` 公共函数（返回值的 `color` 字段）。
- **Observable Result**：nest.color=`#2dbe7a`、route.color=`#26b2f2`、route.width=3。
- **Test Level**：vitest，更新 `cesium-entities.test.ts`（纯函数，现有 Seam，最窄有效层级）。

### 3.7 主题纪律（detector 归零 + 无新增硬编码）
- **Test Seam**：源码静态扫描。
- **Observable Result**：`detect.mjs --json frontend/src` 输出 `[]`；`.tsx` 中无 Cesium 白名单外颜色字面量。
- **Test Level**：verify 命令（纳入 PR 验收，不作为 vitest）。

### 3.8 回归
- **Test Seam**：前端测试与构建。
- **Observable Result**：`npm test --workspace frontend` 全绿、`npm run build --workspace frontend` 退出码 0。
- **Test Level**：命令行验证（现有 12 文件 56 用例，补上述 3.3/3.4/3.6 后用例数增加）。

## 4. 不变量与风险

- **不改组件功能合约**：`RouteMap` props、`GbhPanel`/`HistoryPanel`/`ChatPanel` 对外行为与现有测试断言保持一致；新增 heading/aria 为纯增量。
- **Cesium 初始化提前的副作用**：首屏即动态 import Cesium（~数 MB）并请求瓦片。Cesium 原本也在首屏（有 route 时）加载，差异仅在"未生成航线时也加载"；与 PRD 决策（dm-202 开场即基座）一致。无 token 时 ArcGIS 兜底仍会发网络请求；若完全离线，Viewer 仍渲染暗色椭球（非纯黑），满足 AC。
- **相机高度 1500m** 为目检可调值，不写入硬验收阈值（AC 只要求非纯黑 + 定位到沧海校区视角）。
- **两个 h2 同名**（常驻 aside 的 sr-only h2 与 Sheet 可见 SheetTitle）不会同屏出现，可接受；实现时若 reviewer 介意，可将 SheetTitle 在窄屏保留可见、aside 用 sr-only（即当前方案）。

## 5. 文件改动清单

| 文件 | 改动 |
|------|------|
| `frontend/src/components/map/RouteMap.tsx` | 拆分 mount/sync effect，空态 Viewer + 默认相机；抽 `addBaseLayer`/`syncRoute`；接口不变 |
| `frontend/src/components/layout/AppShell.tsx` | TopBar 标题 span→h1（map-column flex 修复已在审计中完成） |
| `frontend/src/components/history/HistoryPanel.tsx` | section 顶部加 sr-only h2 |
| `frontend/src/components/chat/ChatPanel.tsx` | sr-only h2；input 加 id/aria-label/aria-invalid/aria-describedby；error-bar 加 id |
| `frontend/src/components/map/GbhPanel.tsx` | 根 div 加 sr-only h2 |
| `frontend/src/components/chat/RouteCard.tsx` | 航线名套 h3（class 不变） |
| `frontend/src/styles/globals.css` | 追加 prefers-reduced-motion 降级块 |
| `frontend/src/styles/theme.css` | `:root` 声明 `--ring-offset-color` |
| `frontend/src/lib/cesium-entities.ts` | 两色值对齐 |
| `frontend/src/lib/cesium-entities.test.ts` | 更新/补颜色断言 |
| `frontend/src/AppShell.test.tsx`、`ChatPanel.test.tsx`、`GbhPanel.test.tsx`、`HistoryPanel.test.tsx` | 补 heading/aria 断言 |

*工程实现细节（effect 竞态的具体 ref 写法、相机高度微调、RouteCard 具体 class）属 flow-tasks/flow-tdd 范围，本方案锁定 Interface、Seam 与可观察结果。*
