# 前端 impeccable 审计加固 — PRD

> 状态：Draft v1.0 · 2026-08-24
> 来源：`/impeccable audit`（frontend/）得分 16/20（Good）
> 关联：产品 PRD `docs/prd/airline-dsl-edit-agent.md`、UI 重设计 PRD `docs/prd/frontend-ui-redesign.md`、设计系统 `frontend/DESIGN.md`
> 本 PRD 只写需求与可判定验收（what/why）；具体实现（组件结构、CSS 选择器、Cesium 初始化时机）留给 flow-design。

---

## 1. Problem Statement

`/impeccable audit` 对 `frontend/` 给出 16/20：主题与对比度优秀（4/4），但可访问性存在系统性缺口（全站无语义标题、输入框无 label、无减弱动效），地图空态为纯黑，且 Cesium 实体使用了设计系统外颜色。审计期间已修复一个 P0（地图列高度坍缩导致 Cesium 从不挂载）。本 PRD 把剩余审计建议凝固为可验收的加固工作，不做视觉重设计。

## 2. Scope / Non-goals

**In scope**
- 语义结构：全站标题层级、对话输入框可访问名称、错误关联。
- 动效无障碍：`prefers-reduced-motion` 降级。
- 地图空态：开场即初始化 Cesium 地球基座。
- Cesium 实体色对齐设计系统。
- focus ring-offset 在深色表面的可见性。
- P0 地图坍缩修复的回归锁定。

**Non-goals**
- 不改视觉设计、不调间距/字号/配色（属 redesign，已完成）。
- 不调整 <44px 点击目标：PRODUCT.md 明确仅桌面演示（1920×1080 + 1366×768），鼠标操作，触控非目标。
- 不引入亮色主题或主题切换。
- 不做平板/手机适配。
- 不处理业务管线（LLM/GBH/几何）。

## 3. Decisions（来自 decision-map dm-201~203）

- **范围**：只做审计列出的加固项；P0 已在审计中修复，本批次以回归验收锁定。
- **空态地图**：开场即初始化 Cesium Viewer 并定位沧海校区/机巢视角，route 到达只增删实体；无天地图 token 时退化为无瓦片暗色椭球，不得是纯黑/空白。
- **Cesium 实体色**：机巢统一为航点绿 `#2dbe7a`、航线统一为航向青 `#26b2f2`，更新对应测试断言。

## 4. 验收标准（Acceptance Criteria）

> 每条可独立判定 pass/fail；均含"判定：…"。

### 4.1 地图渲染与空态（P0 回归 + P2 空态）
- [ ] Given 页面在 1920×1080 首次加载且尚未生成任何航线，When DOM 与 Cesium 完成初始化（≤3s），Then `[data-testid=route-map]` 高度等于 `[data-testid=map-column]` 高度（差值 0px），且内部存在 `.cesium-widget canvas` 且其高度 = 地图列高度；判定：浏览器 devtools 执行 `(()=>{const m=document.querySelector('[data-testid=route-map]').getBoundingClientRect();const c=document.querySelector('.cesium-widget canvas');return JSON.stringify({mh:Math.round(m.height),ch:c?Math.round(c.getBoundingClientRect().height):0})})()` 返回 `mh===ch` 且 `ch>0`。
- [ ] Given 无 `TIANDITU_TOKEN`（空串/未配置），When 空态地图渲染，Then canvas 不得是纯色黑块：取 canvas 中心 100×100 区域像素，存在亮度（`0.299R+0.587G+0.114B`）大于 12 的像素（Cesium 暗色椭球/星空）；判定：在上述 evaluate 中读取 canvas 中心区域像素并断言至少 1 个像素亮度 >12；或 [人工目检] 空态地图可见暗色地球轮廓/星空而非纯黑矩形。
- [ ] Given 已存在地图基座，When 一条航线生成/加载完成，Then 不重新创建 Viewer，仅在既有 Viewer 上增删实体，且航点/航线可见；判定：代码审查 Viewer 实例仅在 mount 创建一次（无 route 变化时的 `new Viewer`）；[人工目检] 对话生成航线后地图出现航线与航点，无地球闪烁重载。
- [ ] Given 浏览器宽度 1366×768，When 页面加载，Then 无横向滚动（`document.documentElement.scrollWidth <= window.innerWidth`），route-map 高度=地图列高度；判定：devtools 断言 `scrollWidth<=innerWidth` 且 4.1 中高度断言通过。

### 4.2 可访问性 — 语义标题（P1）
- [ ] Given 任一主视图，When 用屏幕阅读器标题导航或查询 DOM，Then 存在恰好一个 `<h1>`，其可访问名称包含应用名"航线编辑 Agent"，且各面板标题（历史航线、对话/消息区、提交 GBH、航线结果）使用层级正确的 `<h2>`/`<h3>`，不跳级；判定：devtools 执行 `(()=>({h1:document.querySelectorAll('h1').length, h1text:document.querySelector('h1')?.textContent.trim(), headings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>h.tagName)}))()`，断言 h1===1、h1text 含"航线编辑 Agent"、标签序列无跳级；视觉样式与现状一致。

### 4.3 可访问性 — 输入与错误（P2）
- [ ] Given 对话输入框，When 查询其可访问名称，Then 它有非空 `aria-label`（中文描述其用途，如"输入航线需求"）或关联可见/隐藏 `<label>`；判定：devtools `document.querySelector('form input, form textarea').getAttribute('aria-label')`（或 `labels.length`）非空。
- [ ] Given 出现对话错误条（`[data-testid=error-bar]`），When 输入框处于错误态，Then 输入框有 `aria-invalid="true"` 且 `aria-describedby` 指向该错误条 id；判定：触发一次错误后 devtools 断言输入框 `aria-invalid==='true'` 且 `document.getElementById(input.getAttribute('aria-describedby'))` 为错误条节点。错误条已具 `role=alert`（既有，不回退）。

### 4.4 可访问性 — 减弱动效（P2）
- [ ] Given 操作系统/浏览器开启"减少动态效果"（`prefers-reduced-motion: reduce`），When 出现加载 spinner（`Loader2 className*=animate-spin`）与 Sheet 抽屉打开，Then spinner 不持续旋转（用非旋转的静止/脉冲状态或隐藏，但 `aria-busy`/状态文字保留），Sheet 不做滑动位移或时长 ≤1ms 且内容即时可见、层级关系不变；判定：以 `page.emulateMedia({reducedMotion:'reduce'})` 后 [人工目检] spinner 静止/不旋转、Sheet 无滑入位移即可见；DOM 状态（`aria-busy`、`role=status`）保持不变。不得使用全局 `*{animation-duration:.01ms !important}` 一刀切抹掉所有反馈。
- [ ] Given 未开启减弱动效（默认），When spinner 与 Sheet 动画播放，Then 行为与现状一致（spinner 旋转、Sheet 滑入 500ms）；判定：回归 [人工目检] 默认动效不被破坏。

### 4.5 主题与实体色（P3）
- [ ] Given 构建后的前端源码，When 运行 impeccable 检测器，Then `node .codebuddy/skills/impeccable/scripts/detect.mjs --json frontend/src` 输出为空数组（零 `design-system-color` advisory）；判定：命令退出后 JSON 为 `[]`。
- [ ] Given 构建 Cesium 实体，When 机巢与航线实体生成，Then 机巢 color 为 `#2dbe7a`、航线 color 为 `#26b2f2`、线宽 3；判定：`npm test --workspace frontend`（cesium-entities 测试）通过，断言颜色为上述两值。
- [ ] Given 全站 `.tsx` 组件，When 扫描，Then 无新增硬编码颜色字面量（`#xxx`/`rgb()`/`rgba()`），Cesium 命令式实体除外；判定：对 `frontend/src/**/*.tsx` 运行 `rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\('` 仅命白名单（cesium-entities.ts 中已对齐的两色及其测试）。

### 4.6 键盘焦点（P3）
- [ ] Given 深色卡片/浮卡表面上的可聚焦控件（按钮、MapOverlayCard 折叠触发器），When 用 Tab 聚焦，Then 焦点环为 2px 青色 ring 且与底色之间有可见分离（ring-offset 在卡片/弹层表面可辨）；判定：[人工目检] 依次 Tab 遍历顶栏/历史/对话/GBH 浮卡，每个焦点轮廓在深底上清晰可见、不被同色吞没。

### 4.7 回归（既有合约不回退）
- [ ] Given 上述改动，When 运行测试与构建，Then 前端全部测试通过、生产构建成功；判定：`npm test --workspace frontend` 全绿（≥56 用例），`npm run build --workspace frontend` 退出码 0。

## 5. 成功度量（Outcome Metrics，非验收）

> 以下为滞后/主观结果，不作为阶段完成判据，仅供参考：
- `/impeccable audit` 复跑分数从 16/20 提升（预期可访问性与完整性维度上调）。
- 演示开场观感改善（空态不再纯黑）。

## 6. 约束

- 遵守 `frontend/DESIGN.md`：颜色走 theme token，`.tsx` 不写硬编码颜色（Cesium 实体白名单且已对齐主色）。
- 不改变任何组件的功能合约/prop 语义；既有 `*.test.tsx` 必须继续通过。
- 深色主题唯一，不引入亮色切换。

*PRD 由 flow-requirements 澄清生成；工程实现（Viewer 初始化重构、标题用 sr-only 还是可见、reduced-motion CSS 方案、aria 属性接线点）属 flow-design 范围。*
