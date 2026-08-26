# CONTEXT — 领域术语（权威）

> 需求澄清/设计/开发过程中发现的领域术语，冲突时以本文件为准。

| 术语 | 定义/别名 | 来源 |
|------|-----------|------|
| Agent 原生应用 | 面向 AI Agent 交互范式设计的应用：用户用自然语言驱动，agent 编排意图提取→生成→校验→执行闭环 | 需求背景 |
| 意图（Intent） | 从用户自然语言中提取的结构化参数集（区域/形状/高度/速度/动作/返航） | 需求澄清 |
| 航线编辑 Agent | 本产品定位：用对话方式创建与编辑大疆航线，非手动打点 | 需求澄清 |
| 几何模板 | 由意图参数生成航点坐标的规则算法（MVP：环绕 orbit；后续：直线 line/之字 sweep） | 需求澄清 |
| AirlineContent | 对齐 open-api-waypoint-route 接口结构的大疆航线数据（takeoff/waypoints/全局参数） | 参考来源 yuchen-smart-ops |
| GBH 模拟飞行平台 | 大疆航线模拟飞行验证平台，通过 POST /api/open/routes 提交航线验证 | 参考来源 yuchen-smart-ops |
| WGS-84 | 坐标基准，本产品统一使用；沧海校区机巢锚定 22.531635, 113.935066 | 需求澄清 |
| 多轮澄清 | agent 缺关键参数时反问补齐的对话模式 | 需求澄清 |
| 降级策略 | LLM 不可用时规则引擎兜底，且明确标注"非 AI 生成" | 需求澄清 |
| ~~三栏工作台~~（已被取代） | 早期 UI 重设计形态：左历史·中对话·右地图三栏。2026-08-24 布局重构后改为「图标导航栏 + 右主工作台（对话与地图并排）」，保留此条仅作历史追溯 | UI 重设计需求 |
| 图标导航栏（Nav Rail） | 布局重构后的左栏：64–72px 窄栏，图标+小字，含新对话/历史(打开抽屉)/设置(禁用)；取代原常驻 280px 会话历史列表 | 布局重构需求 |
| 右主工作台 | 移除全宽顶栏后，右侧单一主区域：顶部内嵌标题/状态栏，其下对话列与地图并排 | 布局重构需求 |
| AI composer | 对话列底部大圆角卡片式输入区：空态问候+建议 prompt、多行自适应、Enter 发送/Shift+Enter 换行、流式中停止 | 布局重构需求 |
| useChat | `@ai-sdk/react` 提供的流式对话状态 hook，完全接管 messages/status/stop/regenerate；本项目以自定义 transport 对接现有后端 SSE | 布局重构需求 |
| 设计 token | 颜色/字体/间距/圆角/阴影/状态色的命名设计变量（CSS 变量 + Tailwind 映射），作为深色主题与组件库的单一真相源 | UI 重设计需求 |
| shadcn/ui | 基于 Radix 无样式原语、按需 copy 源码进仓库的 React 组件方案，配合 Tailwind 自研深色主题 | UI 重设计需求 |
| 三模混合航线编辑器 | 本产品新定位：对话、手动打点、DSL 脚本三种模式均为一等编辑器，读写同一份航线模型，任一改动即时反映到另外两者；对话仍为牵头入口。见 ADR-0005 | intent 2026-08-26 |
| 统一航线模型 | 三模共享的编辑态航线数据；AirlineContent 为其权威序列化结构（对齐 open-api-waypoint-route，走 GBH 校验），orbit 几何模板重构为其上的生成器 | intent 2026-08-26 |
| 航线 DSL | Python 子集语言：`route = Route("名称")` 赋值 + `route.takeoff().waypoint(...).take_photo().return_home()` 方法链；由浏览器内 TS Lexer/Parser/Generator 即时编译，非完整 Python 运行时。源自 yuchen-smart-ops unified-flight TaskGenerator | intent 2026-08-26 |
| 动作系统 | 航点级载荷/飞行动作集合（起飞/返航/悬停/拍照/录像/红外/云台控制），DSL 函数名与中文动作名双向映射（take_photo↔拍照 等） | intent 2026-08-26 |
| 航点工作台 | 手动编辑能力：Cesium 上航点 CRUD/拖拽、连线、高度编辑、动作绑定、航线全局参数（返航高度/失控行为/安全高度/最大速度/航点间距）、KMZ(WPML)/KML 导入导出 | intent 2026-08-26 |
