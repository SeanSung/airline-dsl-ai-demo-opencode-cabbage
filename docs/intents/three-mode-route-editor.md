# Intent: 三模混合航线编辑器——迁移航线规划与 DSL 能力

Author: junxiansong（发起人/开发）。Status: submitted。

## Problem

当前 demo 的航线能力过窄：只有"对话 → LLM 意图 → 环绕（orbit）单一几何模板 → AirlineContent"一条路径，缺少真实的航点级编辑、动作系统、航线参数编辑，也没有可演示的脚本化航线能力。面向领导/客户的 10 分钟演示里，"AI 生成航线"的故事因航线无法被审视、精修、脚本化而显得单薄，出线深度停留在单一环绕形态。

成熟的同类能力已存在于参考项目 `yuchen-smart-ops`（Vue3 + Go 技术栈）：`views/airline-design` 的完整航点工作台、`views/unified-flight/TaskGenerator` 的 Python 子集 DSL 编译器（TS 手写 Lexer/Parser/Generator，CodeMirror 即时编译）、以及 DSL 与航点绘制的双向联动。这些能力与本项目技术栈（React 19 + 原生 Cesium + Tailwind/shadcn 深色 cockpit，全 TS 单栈）不同，无法直接搬运。

受影响方：现场驱动工具的内部航线规划员/演示者（主要用户）；以及依赖本项目作为"agent 原生试点基线"的产品/技术团队。

## Proposed outcome

本项目升级为**三模混合航线编辑器**：对话、手动打点、DSL 脚本三种模式均为一等编辑器，读写同一份航线模型，任一模式的改动即时反映到另外两者。分两阶段交付：

- **Phase 1（迁移）**：在新 React/cockpit 栈中，以"行为重写、领域逻辑移植、UI 重建"的方式落地——
  1. Cesium 初始化与图层/视图方案移植（适配现有 `lib/cesium-entities` 与 viewer 生命周期）；
  2. 完整航点工作台：Cesium 上航点 CRUD 与拖拽、连线、高度编辑；动作系统（起飞/返航/悬停/拍照/录像/红外/云台控制，含参数）；航线全局参数（返航高度、失控行为、安全高度、最大速度、航点间距）与基础信息；KMZ(WPML)/KML 导入导出；
  3. Python 子集 DSL 编译器：移植 TS Lexer/Parser（`route = Route("名称")` + 方法链调用）与 segment→DSL 生成器，CodeMirror 编辑器内即时编译；
  4. DSL 与航点绘制双向联动：改脚本即时重绘航点/动作，地图/面板编辑即时回写脚本。
- **Phase 2（深化）**：扩充 DSL 编译器的文法、动作与配置覆盖度，完善多航段编排与脚本↔航线规划的更深整合，使 Python 脚本成为与对话、手动编辑对等的完整航线编辑入口。

现有对话/agent 管线保留为一等模式：LLM→意图→几何生成（orbit 为首块模板，后续 line/sweep）的产出进入统一航线模型，可被手动/DSL 继续编辑。三模产出的航线统一走现有 AirlineContent 校验与 GBH 模拟飞行提交链路，验证可信度不降级。

这是一次产品定位转向：取代 `PRODUCT.md` 中"编辑 = 自然语言重生成…不做地图手动拖点"的锁定。定位决策与理由见 ADR-0005（随本提案一并裁决）。

## Success criteria

- **三模往返可观察**：在新深色 cockpit 内，对同一条航线——(a) 对话生成、(b) 地图增删拖拽航点并绑定动作/改参数、(c) 编辑 DSL 脚本——任意一种编辑后，其余两者即时一致更新；地图实体、动作/参数面板、DSL 脚本三者不出现分叉。
- **可飞可验证**：三模任意方式产出的航线都能经现有 `airline/validator` 校验并一键提交 GBH（`POST /api/open/routes`），返回 ok/invalid/error；演示场景下产出一条可飞航线。
- **DSL 闭环**：在 CodeMirror 中编辑 DSL，合法脚本即时编译为航点/动作并渲染到地图，编译错误按行/列标注；地图与面板的编辑能反向生成等价 DSL 文本（往返稳定：同一航线连续两次 航点→DSL→航点 坐标、航点数、动作序列不变）。
- **迁移保真**：Phase 1 的航点/动作/参数编辑行为与参考项目对齐；坐标变换、高度换算、KMZ/KML 解析等领域逻辑以测试移植，关键纯函数有等价测试覆盖。
- **栈合规**：全部新增 UI 用 React 19 + Tailwind/shadcn 深色 token 实现，不引入第二套 UI 库或 CSS-in-JS；不引入 Vue 微前端或 Element Plus；DSL 维持浏览器内 TS 编译，不引入 Python 运行时/服务端。
- **不回归**：现有 `npm test` 全绿；现有对话生成、历史、GBH 链路、Cesium viewer 生命周期不被破坏。

## Affected users and systems

- **用户/角色**：内部航线规划员/演示者（主要，现场投影驱动）；产品负责人与技术团队（agent 原生试点基线的干系人）。
- **前端系统**：`frontend/src/components/map`（Cesium 视图/实体）、`components/chat`（对话面板与三模协调）、新增航点工作台与 DSL 编辑器模块；`lib/cesium-entities`；`styles/theme.css` 设计 token。
- **服务端系统**：`server/src/airline`（builder/validator 演进出统一航线模型）、`server/src/geometry`（orbit 等生成器）、`server/src/gbh`（提交链路，接口不变）、`server/src/intent` 与 `agent`（对话产出对接统一模型）。
- **共享**：`shared/` 中航线数据结构（AirlineContent 及新编辑态模型）。
- **参考来源**：`~/project/yuchen-smart-ops` 的 `frontend/src/views/airline-design` 与 `frontend/src/views/unified-flight/TaskGenerator`（仅作逻辑移植来源，不引入其运行时/依赖）。

## Constraints

- **单栈硬约束**：React 19 + Vite + TypeScript + 原生 Cesium + Tailwind CSS v4 + shadcn/ui 深色 token。不引入 Vue/Element Plus/Pinia、不嵌入 Vue 微前端、不引入第二套 UI 库或 CSS-in-JS。从参考项目只移植领域逻辑（坐标/数学/DSL 编译器/AirlineContent 映射），UI 在 React 重建。
- **DSL 实现约束**：维持浏览器内 TS 手写 Lexer/Parser/Generator 的 Python 子集方案；不引入 Pyodide、不新增 Python 服务端或部署面。
- **数据与坐标**：继续以 AirlineContent（对齐 open-api-waypoint-route）为权威序列化结构；统一使用 WGS-84；沧海校区机巢锚点 `22.531635, 113.935066` 不变。
- **验证链路**：三模航线必须复用现有校验与 GBH 提交，可信度不降级，不绕过、不 mock 成功。
- **诚实降级**：LLM 不可用时规则兜底继续明确标注"非 AI 生成"，不得伪装。
- **密钥**：LLM（DeepSeek）密钥仅存服务端；天地图 token 服务端下发，前端不硬编码。
- **Phase 1 功能边界**：航点 CRUD/拖拽、动作系统、航线参数与基础信息、KMZ/KML 导入导出四项为迁移范围；其余见 Out of scope。

## Out of scope

- 相机视锥/航拍预览窗口（`CameraPreviewWindow`/`useFrustumManager`/camera-presets）；
- 机型选择对话框、机巢/起飞点参考选择、摇杆式高度微调、多边形航点生成器等增强编辑工具；
- 航线统计面板（里程/航点数/预计时长的独立模块）；
- 多机协同/编队、实时飞行控制、空域审批、航线版本管理、测绘级航线（RTK/激光雷达/地形跟随）；
- 完整 Python 执行能力（任意 Python、Pyodide、服务端 Python 编译）；DSL 限定为既定 Python 子集，文法扩充属于 Phase 2；
- 亮色主题/主题切换、平板/手机端；
- Phase 2 的多航段编排深化与新文法/动作扩展（作为后续阶段，本提案仅确立其方向，不在 Phase 1 实现）；
- `yuchen-smart-ops` 后端（Go 微服务）及其基础设施（IAM/RBAC/MQTT/视频流/设备管理等）。

## Open questions

- Phase 1 的交付/演示时间点是否有硬截止？（Q10 未给出时间压力；若有需在 spec 阶段锁定阶段排期。）
- 统一航线模型的编辑态结构具体形态（AirlineContent 直接可编辑 vs 其上一层编辑模型）留待设计阶段；本提案只锁定"三模共享一份模型、AirlineContent 为权威序列化"。
- Phase 2 DSL 文法/动作扩充的目标覆盖清单（是否要变量/循环/条件、自定义函数等），待 Phase 1 落地后按演示反馈细化。
- 航线统计、相机预览等被列为 out-of-scope 的能力，是否在 Phase 2 重新纳入，待后续需求决定。
