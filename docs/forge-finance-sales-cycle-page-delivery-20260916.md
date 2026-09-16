# 财务销售回款链逐页交付合同（2026-09-16）

## 批次和范围

- 总目标：财务全部页面精修与业务验收。
- 本批业务链：开票申请 → 开票任务 → 销项发票 → 应收 → 收款分配与核销。
- 本页：`page_invoice_tasks`；下一页：`page_output_invoices`。
- 起始版本：`2a0c56713c836baeaf84f0d19e9d7483691aade3`；规则同步提交：`f260a9e`。
- 分支与工作树：`codex/finance-sales-cycle`；`.worktrees/finance-sales-cycle`。
- 独立环境：`http://localhost:4441`；`file:.objectstack/finance-sales-cycle.sqlite`。
- 实施负责人：当前财务任务；独立复核者：待独立验收。
- 全量范围来源：`objectstack.config.ts` 财务导航、`src/pages/index.ts` 页面注册、页面内跳转、相关对象及 Action。
- 共享文件唯一负责人：本批不修改 `objectstack.config.ts`、`product-ui.ts`、`src/pages/index.ts`、`package.json` 和精修 manifest；需要更新时在集成阶段由主线唯一负责人处理。

## 当前分类清单

- 未实现：RISEMAP 当前无可办理数据，无法证明其行级审批、驳回和登记开票交互；双侧同材料办理待补证。
- 功能已有但页面交互欠缺：Forge 已有审批、驳回、登记开票 Action；当前专用列表仅显示已审批记录的“登记开票”，遗漏待审批行操作。
- 实现错误：待处理开票误统计为待审批；待开票金额包含待审批和已驳回；申请人读取不存在的 `requested_by`；申请时间优先显示业务日期而非提交时间。
- RISEMAP 证据不足：当前列表为空，无法观察行操作出现条件、弹窗内容、提交阻断及操作后跳转。

## 逐页设计：开票任务

- pageId：`page_invoice_tasks`
- RISEMAP 当前入口：`https://risemap.cn/finance/invoices/tasks`
- Forge 入口：`/_console/apps/forge/page/page_invoice_tasks?nav=invoice_tasks`
- 岗位：财务开票人员；协同岗位：开票申请审批人、销售申请人。
- 核心任务：识别已审批待开票申请，登记正式销项发票，并追溯已开票结果。
- 主单据：`forge_sales_invoice_request`；来源：销售订单及其明细；结果：销项发票与应收账款；下一岗位：应收与收款办理人员。
- 主原型：`task_workspace`。页面围绕一组待办申请呈现期间、判断指标、状态、列表和状态相关行操作。
- 参考页：`project-task-workspace.page.ts`；密度参考 `project-timesheet-cost.page.ts`；版本为本批最终被验收提交。
- 首屏顺序：标题与刷新 → 三项指标 → 期间 → 状态页签 → 搜索与重置 → 申请列表。
- 主动作：没有全局新建按钮；“登记开票”只出现在已审批行。待审批行显示“通过 / 驳回”，已开票行显示“查看发票”。刷新为标题区次要动作。
- 全局范围：本月、本季、半年、全年，作用于指标和列表。
- 局部筛选：状态、搜索，作用于列表，不改变期间指标。
- 指标口径：待处理开票为期间内 `approved` 数量；待开票金额为期间内 `approved` 的申请金额；全部申请为期间内全部申请数量，并附待审批、已驳回数量。
- 表格列：申请编号、合同/订单、客户、申请金额、发票类型、税率、申请人、申请时间、状态、操作。
- 状态：待审批、已审批、已开票、已驳回。Forge 使用“已驳回”，不把 rejected 伪装为 RISEMAP 指标中的“已撤回”。
- 阻断：审批意见必填；只有待审批可审批/驳回；只有已审批可登记开票；发票编号必填；Action 继续校验订单、明细、数量和重复开票。
- 反馈：成功后刷新列表和指标；失败原因显示在当前页面；已开票可进入正式发票详情。
- 视觉：桌面 1440×900；窄屏 390×844；空态保留十列表头；工具栏和页签在窄屏可滚动，表格仅在卡片内部横向滚动。

| 要求编号 | 当前事实或明确决策与证据 | 区域/控件及实现位置 | 操作步骤 | 预期结果 | 实际结果与证据 | 状态/缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| INV-TASK-001 | RISEMAP 实时页面显示标题“开票任务”和说明“处理已审批的开票申请并跟踪开票进度” | 标题区，`finance-management.page.ts` | 双侧打开页面 | 标题与职责一致 | RISEMAP 已实时观察；Forge 修改前已一致 | pass |
| INV-TASK-002 | RISEMAP 显示本月、本季、半年、全年，当前为全年 | 期间页签 | 逐项点击 | 指标和列表按期间变化，选中态明确 | Forge 有数据页签可点击；本批数据均在当前期间，跨期间差异待后续材料 | partial |
| INV-TASK-003 | RISEMAP 指标为待处理开票、待开票金额、全部申请 | 指标区 | 准备不同状态记录并切换期间 | 只把已审批记录计入待开票数量和金额 | 初始 1 / ¥26,000；审批后 2 / ¥38,000；开票后 1 / ¥12,000，与 API 记录一致 | pass |
| INV-TASK-004 | RISEMAP 显示全部、待审批、已审批、已开票、已驳回 | 状态页签 | 逐项点击 | 只筛选列表，不改变期间指标 | 内置浏览器核对待审批、已审批和全部；状态改变后数量即时回读 | pass |
| INV-TASK-005 | RISEMAP 当前只观察到刷新；Forge 明确保留搜索作为列表增强 | 搜索与重置 | 输入订单、客户、编号；重置 | 列表立即过滤，重置恢复全年和全部 | 搜索 `PENDING-APPROVE` 得 1 条；重置恢复 5 条 | pass |
| INV-TASK-006 | RISEMAP 实时表头十列 | 主表格 | 对照表头与真实记录 | 列顺序一致，申请人和提交时间来自真实字段 | 十列一致；申请人为 Dev Admin，提交时间取 `submitted_at`，合同/订单和税率来自关联数据 | pass |
| INV-TASK-007 | Forge 已有审批、驳回、登记开票、查看发票能力 | 行操作与标准弹窗 | 对四种状态分别操作 | 只显示状态允许的动作；成功后回读 | Forge 四种状态动作按条件显示，审批、驳回和登记开票均已操作；RISEMAP 行级事实仍待同材料复核 | partial |
| INV-TASK-008 | Forge 安全决策要求业务校验和错误反馈 | Action 与页面通知 | 空审批意见、空发票号、重复/越权动作 | 阻断并解释原因，数据不变化 | 页面与 API 均阻断空审批意见、空发票号；API 阻断错误状态与未登录调用 | pass |
| INV-TASK-009 | 页面精修基线要求桌面、窄屏、空态与有数据 | 页面整体 | 1440×900、390×844 检查 | 主动作易找，首屏连续，页面整体不横向溢出 | 内置浏览器桌面有数据、空态和弹窗通过；390×844 尚未取证 | partial |
| INV-TASK-010 | 业务结果必须进入销项发票和应收 | 下一岗位 | 登记开票后打开发票并回读应收 | 来源、金额、状态、关联 ID 一致 | 浏览器登记 `INV-BROWSER-20260916-001`；发票 issued、应收 unpaid、金额与余额均为 26,000；重启后保持 | pass |

## 验收与交接

- 四维结果：replication `blocked`；visual `pending`；interaction `blocked`；business `blocked`。阻断仅指 RISEMAP 同材料及窄屏/独立复核未完成，Forge 本页已完成正常路径、关键阻断、API 和重启回读。
- 当前实时打开页面：RISEMAP `/finance/invoices/tasks`；Forge `http://localhost:4441/_console/apps/forge/page/page_invoice_tasks?nav=invoice_tasks`。
- RISEMAP 当前为空数据，仅首屏、指标名称、状态、表头和空态属于已观察事实。
- API：`tests/invoice-task-workspace.integration.mjs` 通过；同库停服重启：`tests/invoice-task-restart-readback.mjs` 通过；工程门禁 `pnpm typecheck`、`pnpm validate`、`pnpm build` 通过。
- 操作与结果证据：`docs/evidence/finance-invoice-tasks-20260916/acceptance.md`。
- 独立复核：待独立验收。
- 实际耗时、调用、费用：无可靠统一来源，记为未知。
