# ADR-0003: 前端重设计采用 Tailwind CSS v4 + shadcn/ui + CSS 变量深色 token

- 日期：2026-08-24
- 状态：Accepted
- 关联：`docs/prd/frontend-ui-redesign.md`；Issue #30

## 背景

现有前端零设计资产：所有样式为 JSX inline `style={{}}`，无 CSS 文件、无 token、无组件库；布局是左栏固定 420px 内两个面板硬挤、右栏底部浮条遮挡 Cesium 地图。需求阶段已拍板"统一深色设计语言 + 三栏工作台 + 可复用基座"，但把样式方案选型、版本与 token 落地方式移交 design（PRD §6、§12）。

需要决策三件事：
1. 样式方案（Tailwind / CSS Modules / CSS-in-JS / 纯 CSS 变量）。
2. 组件基础（shadcn/ui / Radix 手写封装 / 无组件库手写）。
3. token 落地与版本（Tailwind v3 + JS config / v4 + CSS-first `@theme`）。

## 决策

- **样式方案：Tailwind CSS v4**，通过官方 `@tailwindcss/vite` 插件接入（Vite 8 原生支持，无需 PostCSS 配置文件、无需 `tailwind.config.js`）。
- **组件基础：shadcn/ui**（Radix 无样式原语），按需 `npx shadcn@latest add` 把组件源码 copy 进 `frontend/src/components/ui/`，深色主题由我们自管。
- **token：CSS 变量定义在 `frontend/src/styles/theme.css` 的 `@theme`/`:root`，Tailwind v4 自动把 `@theme` 中的 `--color-*` 等变量映射为 utility（`bg-background`、`text-foreground` 等）**。颜色用 HSL 通道变量 + `hsl(var(--*))` 模式，与 shadcn 标准一致；间距/圆角/阴影/字体同样在 `@theme` 定义。
- 新增依赖：`tailwindcss`、`@tailwindcss/vite`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`，以及 shadcn add 拉入的 Radix 原语（`@radix-ui/react-*`）、`lucide-react`。全部在 `frontend/` workspace。
- **三栏骨架用纯 CSS Grid/Flex + Tailwind utility 实现**（`grid-cols-[var(--col-history)_1fr_minmax(0,1.6fr)]` 之类），不引入布局库。

## 为什么不用更简单的方案

- **为何不是 CSS Modules / 单写 CSS 变量**：能消除 inline style，但没有约束——颜色/间距仍可在每个文件随手硬编码，PRD §9.1/§9.5 的"无硬编码颜色、同类组件一致、可复用基座"无法被机制保证，风格会继续漂移。Tailwind 的 utility 体系 + token 映射把"只能用 token"变成默认路径，正是需求核心痛点的对症方案。
- **为何不是 CSS-in-JS（styled-components/emotion）**：与 React 19 + Vite 8 的服务端/流式趋势相悖，增加运行时开销和包体，且 PRD §10 明确"不引入第二套 CSS-in-JS 方案"。
- **为何不是 MUI/AntD/Chakra**：自带视觉风格，定制成"深色科技驾驶舱"成本高，且会与 PRD §6 选定的 shadcn 路线冲突、违反 §3 non-goal"不引入第二套 UI 库"。shadcn 提供无样式 Radix 原语 + 我们拥有源码，主题完全自控。
- **为何不直接手写 Radix 封装而要 shadcn CLI**：手写等价于重新实现 shadcn 已有的无障碍（焦点管理、键盘、ARIA）封装，重复劳动且易漏无障碍。shadcn 把源码 copy 进仓库（不是运行时依赖黑盒），我们可完全修改，符合"源码自有"。
- **为何 Tailwind v4 而非 v3**：v4 用 `@tailwindcss/vite` 零 PostCSS 配置、CSS-first `@theme` 让 token 与 CSS 变量单一真相源合一（v3 还要维护一份 `tailwind.config.js` 的颜色对象，与 CSS 变量重复定义，违反 DRY）。v4 是当前 Vite 8 时代的默认版本；shadcn/ui 最新版已支持 v4。简单方案胜出。
- **为何不用 `styled-jsx`/内联 style**：正是本次要清除的反模式。

## 后果

- 新增依赖：`tailwindcss`、`@tailwindcss/vite`、`class-variance-authority`、`clsx`、`tailtail-merge`（笔误，应为 tailwind-merge）、`tailwindcss-animate`，以及 shadcn add 拉入的 Radix 原语（`@radix-ui/react-*`）、`lucide-react`。全部在 `frontend/` workspace。
- **Cesium 容器不纳入 Tailwind preflight 冲突范围**：Cesium 自带 widgets.css；Tailwind preflight 是全局 reset，需验证不破坏 Cesium 控件。如冲突，对 Cesium 容器或 widget 类做作用域豁免（在 spec §"Cesium 集成风险"列出预案）。
- 现有 `className="chat-panel"` 等无样式类名将全部替换为 Tailwind utility；不保留空 class。
- 无 `tailwind.config.js`/`postcss.config.js`（v4 路线）；`components.json`（shadcn 配置）入库。
- token 单一真相源 = `styles/theme.css`，所有业务组件只能引用 `bg-*`/`text-*` 等 utility，PRD §9.1 的"硬编码颜色=0"可由扫描强制。
- 主题切换能力天然具备（改 CSS 变量值即可），但本次不实现亮色切换（PRD non-goal）。
- Two-way door：Tailwind v4 若在 Cesium preflight 上出现无法豁免的冲突，可回退 v3（改配置文件，不动组件 utility），成本可控。
