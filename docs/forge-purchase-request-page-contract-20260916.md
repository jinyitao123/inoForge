# Forge 采购申请页面合同（2026-09-16）

## 页面职责与原型

- Forge：`page_purchase_request_pool`（`purchase-request.page.ts`）；RISEMAP 对应入口：`https://risemap.cn/purchase/requests`。
- 岗位：采购申请人与采购主管；主单据：采购申请（含物料明细）。
- 主原型：任务执行型，参考 `project-task-workspace.page.ts`。首屏顺序：标题与下一步入口 → 申请列表 / 物料明细页签 → 列表筛选 → 表格 → 分页；空态给出新建入口。
- 主动作：新建申请（工具栏最右主按钮）；次动作：批量导入、导出、刷新；下一步入口：采购待办池。

## 本轮事实与处理

### RISEMAP 已保存证据（非本轮实时）

- 来源：`docs/references/risemap-capture/deep/supply-chain/purchasing/rm-018/493-rm-018-purchase-request-list-pass1.txt`。
- 页面结构：面包屑“采购管理 / 采购申请”紧接标题“采购申请”、说明文案与“下一步操作 采购待办池”按钮；页签为申请列表、物料明细；工具栏为新建申请、导入/导出、刷新。
- 筛选：搜索框、状态下拉、一对日期输入并以 `~` 连接，右侧分页“共 0 条记录 每页 20 条”。
- 列顺序：申请编号、申请标题、优先级、关联项目、关联客户、负责人、物料数、总数量、预估含税金额、币种、期望到货日期、建议供应商、采购原因、备注、状态、申请日期、操作。Forge 现有列与顺序一致，未删列。
- 空态：RISEMAP 表格内显示“暂无采购申请”。

### 本轮 Forge 决策（页面质量标准，非 RISEMAP 业务事实）

1. 删除页面自绘的“申 采购管理 / 采购申请”面包屑。Console 外壳与 `ForgePageHeader` 已经呈现同一路径，重复堆叠会挤占首屏；`ForgePageHeader` 保留为唯一标题区。
2. “下一步操作　采购待办池”按钮从独立条带移入标题右侧工具栏首位，位置与 RISEMAP 一致，删除条带后不丢失该入口。
3. 两个日期输入合并为一个“申请日期”范围控件，中间以 `~` 标明起止，无障碍标签为“申请开始日期 / 申请结束日期”；清空筛选同时重置起止。
4. `pr-table` 宽表（min-width 1540px）下把申请编号列固定在左侧、操作列固定在右侧并加分隔阴影，状态与行操作在横向滚动时始终可见；申请标题、采购原因、备注列限定宽度并允许换行，避免单行被撑到不可读。

## 未决与证据边界

- 本轮没有实时打开 RISEMAP 当前页面，也没有完成 Forge 桌面 / 窄屏浏览与控件实操，因此复刻一致性、结构视觉、交互完整性、业务正确性四项均未判定通过，页面保持 `review_required`。
- 未经页面验证：申请 → 审批 → 待办 → 询价/订单承接的推进已在 API 层跑通（见下节），但未在同一浏览器会话里逐控件办理；附件能力（页面已标明“附件存储尚未接入”）与导入 / 导出的真实文件回读仍未验证。
- 静态职责与精修断言：`apps/forge-objectstack/tests/purchase-request-dedicated-page.static.mjs`。
- 验收记录：`apps/forge-objectstack/tests/page-acceptance/page_purchase_request_pool.json`。

## 同批页面与 API 验收（2026-09-16）

- 本批覆盖采购申请、采购待办池、询价管理、采购订单四页。
- 采购待办池改动：删除页面自绘的“采 采购管理 / 采购待办池”面包屑，把旧 `fp-page-header` / `fp-header-actions` 标题区改为共享 `ForgePageHeader`，并把“下一步操作　询价管理”移入标题右侧工具栏首位。属 Forge 页面质量标准整改，非 RISEMAP 业务事实。
- 询价管理页面本轮未改动，仅登记验收状态。
- 采购订单页改动：删除页面自绘的“04 供应链 / 采购管理 / 采购订单”面包屑与复制的标题区，改用共享 `ForgePageHeader` 并保留原五个工具栏动作（新建采购单、导出、付款申请、收票登记、刷新）；2180px 宽表把订单号列固定在左、操作列固定在右。同样属 Forge 页面质量标准整改。
- 独立端口 `http://localhost:4496`、数据库 `file:.objectstack/production-placeholders-batch1.sqlite` 上的 API 结果：`purchase-request-entry-modes` passed（手工明细 + 快速粘贴 + 审批阻断）、`purchase-todo-pool` 3/3 PASS、`purchase-inquiry` 4/4 PASS、`procurement-chain` 7/7 PASS。
- 停服重建后同库重启回读：`purchase-request-entry-modes-restart-readback` passed（申请、两条明细、两条待办 ID 一致）、`purchase-inquiry-restart-readback` PASS、`procurement-restart-readback` PASS。
- 完整记录：`apps/forge-objectstack/tests/page-acceptance/procurement-chain-api-readback-20260916.json`。
- 仍缺：同一组材料在 RISEMAP 与 Forge 两侧的页面办理对照，以及三页的控件实操、桌面 / 窄屏截图与控制台扫描。缺口未闭合前不宣称页面已复刻或精修通过。
