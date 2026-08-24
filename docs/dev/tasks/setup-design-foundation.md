---
issue: 32
test_commands:
  - npm test --workspace frontend
verify_commands:
  - npm test
  - test -f frontend/src/styles/theme.css && test -f frontend/src/lib/cn.ts
  - grep -q "@import \"tailwindcss\"" frontend/src/styles/globals.css
  - grep -q "tailwindcss()" frontend/vite.config.ts
---

# setup-design-foundation

## Builds

前端具备 Tailwind CSS v4 + shadcn/ui 的设计基座：应用加载后由 CSS 变量驱动的深色背景生效，`cn()` 可合并 className，shadcn 配置就绪，且**现有 29 个前端测试全部继续通过、应用可启动**。这是后续所有切片的公共地基，但本身不改变任何业务布局或组件外观（仅全局底色/字体由 token 接管）。

## Acceptance Criteria

- [ ] 安装 `tailwindcss`、`@tailwindcss/vite`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`、`lucide-react`；`vite.config.ts` plugins 加入 `tailwindcss()`，保留现有 cesium static-copy 与 `/api` proxy 不变
- [ ] `frontend/src/styles/theme.css` 用 `@theme` 定义 token（颜色 HSL 通道 `--color-*`、`--radius-*`、`--font-sans`），`:root` 定义深色变量值（background/card/muted/border/foreground/primary/accent/success/warning/destructive/info）；`globals.css` `@import "tailwindcss"` 并引入 theme，设定 `html,body,#root{height:100%}` 与基础字体/背景
- [ ] `frontend/src/lib/cn.ts` 导出 `cn(...inputs)`（clsx + tailwind-merge）
- [ ] shadcn `components.json` 入库（cssVariables:true、tailwind v4 CSS 路径、aliases `@/*`→`src/*`、ui 目录 `components/ui`）；`tsconfig.json` 配 `paths`、`vite.config.ts` 配 `resolve.alias`、`src/vite-env.d.ts` 存在
- [ ] `main.tsx` 引入 `./styles/globals.css`；`index.html` `<html class="dark" lang="zh-CN">`
- [ ] 至少 add 一个基础组件验证链路（`button`）到 `components/ui/`，但不在业务中强行使用
- [ ] 现有 `frontend/src/**/*.tsx` 不被改动行为（本 task 只新增基座与配置；业务组件迁移属后续 task）
- [ ] 回归：`npm test` 通过（shared/server/frontend 全绿），`npm run build --workspace frontend` 成功

## Blocked By

None

## Implementation Notes

- Tailwind v4 路线：**不创建** `tailwind.config.js`/`postcss.config.js`，所有配置在 CSS `@theme`（ADR-0003）。
- token 是唯一真相源：颜色一律走 `@theme` 变量，不在任何 `.tsx` 写颜色字面量。
- Cesium preflight 冲突只做**观测与记录**：启动 dev 目视 Cesium 控件是否被 preflight 破坏；若破坏，在 `theme.css` 的 `@layer base` 对 `.cesium-widget, .cesium-viewer *` 做最小 reset 豁免，不全局关闭 preflight。本 task 不迁移 RouteMap。
- 不预取未用的 shadcn 组件（YAGNI）；后续 task 按需 `npx shadcn@latest add`。
