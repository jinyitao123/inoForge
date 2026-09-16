# Forge 采购申请页面合同（2026-09-16）

## 入口与职责

- RISEMAP 当前入口：`https://risemap.cn/purchase/requests`，新建入口 `/purchase/requests/new`。
- Forge 入口：`/_console/apps/forge/page/page_purchase_request_pool`。
- 页面职责：采购申请人编制申请及物料明细，提交审批；审批人给出意见，通过后生成采购待办。
- 主原型：任务执行型。参考 `project-task-workspace.page.ts` 的标题区、筛选、结果卡片与标准弹窗语言。
- 首屏顺序：页面标题与主动作 → 申请/明细页签 → 搜索、状态和日期筛选 → 状态统计 → 申请列表 → 分页。
- 主单据：`forge_purchase_request`；明细：`forge_purchase_request_line`；审批记录：`forge_purchase_request_approval_log`。
- 下一岗位入口：采购待办池。

## RISEMAP 当前已观察事实

- 列表标题为“采购申请”，说明为“发起采购申请、审批流转、转询价/订单全流程跟踪”，下一步入口为“采购待办池”。
- 列表包含“申请列表 / 物料明细”两个页签；提供新建、导入/导出、刷新、搜索、状态和日期筛选。
- 申请列表列包括申请编号、标题、优先级、项目、客户、负责人、物料数、总数量、预估含税金额、币种、期望到货日期、建议供应商、采购原因、备注、状态和申请日期。
- 新建页提供“保存草稿 / 提交审批”；基本信息包含编号、标题、优先级、项目、客户、币种、申请日期、期望到货日期、负责人、建议供应商、采购原因、附件和备注。
- 物料明细入口包含物料库、手动新增、快速粘贴、Excel 导入、添加组合、关联销售订单。
- 手动明细已观察字段包括物料编码、名称、型号、规格、分类、单位、数量、含税/未税单价、税率和小计。
- 本轮 RISEMAP 列表为空，未在 RISEMAP 写入业务数据。

## Forge 处理结论

- 已实现独立职责页面，不再由通用 `forge_administration_record` 页面承载。
- 已实现申请列表、物料明细、筛选、分页、导出、新建、编辑、查看、提交、同意、驳回、取消和采购待办入口。
- 已实现物料库选择、手动新增、快速粘贴；手工/粘贴明细不要求既有 SKU，但提交时必须具有名称、型号、物料分类、单位和正数量。
- “保存并提交审批”为真实连续动作：先持久化申请与明细，再执行提交 Action；审批通过生成具有申请与申请明细来源的采购待办。
- 附件存储尚未接入，因此页面只显示能力说明，不提供假上传按钮。
- Forge 使用 Console 标准对话框承载新建、编辑和审批；RISEMAP 当前为独立新建页。这属于平台统一页面语言差异，不改变字段和业务动作。
- 本轮按补充精修要求移除标题上方重复的“采购管理 / 采购申请”导航；下一岗位入口并入标题动作区。
- 列表筛选明确为“申请日期起（含）/止（含）”；搜索和状态均只作用于当前列表，不冒充全局范围。
- 桌面宽表为金额、币种和日期设置明确列宽，并固定状态与行操作；窄屏取消固定列，使用表内横向滚动，避免操作覆盖申请标题。

## 状态、阻断与来源

- 状态：草稿、审批中、已通过、已驳回、已转采购、已取消。
- 提交阻断：基本信息不完整、无明细、数量不大于零、手工/粘贴明细缺名称/型号/分类/单位。
- 审批阻断：非审批中状态、审批意见为空、重复生成采购待办。
- 来源关系：采购待办保存 `request_id` 与 `request_line_id`，支持回溯申请与具体明细。
- 取消使用标准二次确认弹窗并要求原因；不使用浏览器原生弹框。

## 待 RISEMAP 同材料复核

- RISEMAP 当前无可办理数据，本轮未验证保存草稿、提交后的审批状态、审批意见、取消以及转询价/订单的真实反馈。
- Excel 文件格式、添加组合、关联销售订单、附件存储和下载行为尚未获得可执行证据；Forge 不把这些入口包装为已完成能力。
- 页面精修状态保持 `review_required`；只有 RISEMAP 与 Forge 使用同一材料完成双侧办理后才能改为 `accepted`。

## 验收材料

- API：`tests/purchase-request-entry-modes.integration.mjs`
- 重启回读：`tests/purchase-request-entry-modes-restart-readback.mjs`
- 页面结构：`tests/purchase-request-dedicated-page.static.mjs`
- 工程门禁：`pnpm typecheck`、`pnpm validate`、`pnpm build`
- 浏览器：RISEMAP `/purchase/requests`、`/purchase/requests/new` 与 Forge `page_purchase_request_pool` 的操作前、表单阻断、提交反馈、审批结果和重启后回读。

## 逐项交付映射

| 要求编号 | 当前事实或 Forge 决策 | 实现位置 | 操作步骤与实际结果 | 状态/缺口 |
| --- | --- | --- | --- | --- |
| PR-001 | RISEMAP 单一标题与业务面包屑 | `purchase-request.page.ts` 标题区 | 桌面与窄屏均只保留一套业务标题；下一步按钮仍可达 | pass |
| PR-002 | RISEMAP 以申请日期范围筛选 | 列表筛选区 | 起止标签明确为含边界；筛选只更新当前申请/明细列表 | pass |
| PR-003 | RISEMAP 长表包含完整字段 | 列表宽表 CSS 与列定义 | 1440×900 金额、币种、日期可读，状态/操作固定；390×844 无列覆盖 | pass |
| PR-004 | 提交进入统一审批中心 | `purchase_request_submit` 与“前往我的审批” | 页面提交、审批、状态回读和待办来源已办理 | pass |
| PR-005 | RISEMAP 同材料提交与取消反馈 | 两侧当前数据 | RISEMAP 列表为空，本轮未写入线上租户 | blocked：待同材料复核 |

四维状态：replication `blocked`；visual `pass`（实施者桌面/窄屏检查）；interaction `pass`（本批关键控件）；business `pass`（Forge 正常与异常路径）。独立复核未发生，页面仍为 `review_required`。
