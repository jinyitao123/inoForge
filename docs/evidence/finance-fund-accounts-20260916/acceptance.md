# 资金账户页验收记录（部分证明）

- 页面：`page_fund_accounts`
- 主原型：`configuration`；参考 `project-timesheet-cost.page.ts`
- 页面源码：`apps/forge-objectstack/src/pages/finance-management.page.ts`
- 被验收版本：`e7544a5`
- 环境：`http://localhost:4441`；`apps/forge-objectstack/.objectstack/finance-sales-cycle.sqlite`
- 业务材料：账户 `应收页面验收账户`（FA-AR-PAGE-20260916，当前余额 126,000.00）与本次新建的银行账户
- 设计状态：`review_required`

## 本轮实时打开并核对的页面

- Forge：`http://localhost:4441/_console/apps/forge/page/page_fund_accounts?nav=fund_accounts`（内置浏览器）
- RISEMAP：本轮未重新打开。字段清单、页签结构和空态引用页面合同中记录的前次实时观察，不据此宣称复刻通过。

## 已证明事实

1. 新增账户弹窗在重建后包含观察到的全部字段，顺序与 RISEMAP 观察一致：账户类型、开户银行、开户支行、银行账户类型、账户名称、账户号码、币种、账户编码、期初余额、期初时间、客户经理、联系电话、允许打印、可见范围、备注。账户类型改为非银行时，开户银行、开户支行、银行账户类型隐藏，账户号码保留。
2. 空表单提交被阻断，弹窗提示“请填写账户名称、账户类型、有效的期初余额和期初日期”。
3. 只填账户名称与期初余额提交被阻断，弹窗提示“银行账户必须填写开户银行和账户号码”。
4. 完整填写后创建成功，页面提示“资金账户已创建”，列表即时回读新账户。
5. API 回读（新建后、停服重启后一致）：账户编码留空自动生成为 `FA-1789552353699`，期初余额 8,800.00 由钩子写入当前余额 8,800.00，开户支行、账号、客户经理、联系电话、允许打印、可见范围、期初时间均按填写值保存，状态为启用。
6. 搜索 `验收 B` 命中 1 条；搜索 `NO-MATCH-XYZ` 显示“暂无匹配的账户”空态与“共 0 条”；重置筛选恢复 2 条。
7. 账户类型筛选“微信”结果为 0 条，重置后恢复 2 条；卡片视图与表格视图显示同一结果集，表格列出 `FA-AR-PAGE-20260916` 与 `FA-1789552353699`。
8. 停服后用同一 SQLite 重启，账户与余额回读一致；既有账户 `应收页面验收账户` 当前余额 126,000.00 未受影响。
9. 工程门禁：`pnpm typecheck`、`pnpm validate`、`pnpm build` 通过，构建后导航静态检查 211 个入口通过；`pnpm acceptance:page-polish` 通过；`node --test tests/page-delivery-gate.test.mjs` 9/9 通过。

## 证据文件

- 桌面卡片视图：`docs/evidence/finance-fund-accounts-20260916/desktop-card-view.png`
- 桌面表格视图：`docs/evidence/finance-fund-accounts-20260916/desktop-table-view.png`
- 窄屏 390×844（指标压缩修复前）：`docs/evidence/finance-fund-accounts-20260916/narrow-table-view-before-metric-fix.png`

## 残余缺口

- 窄屏指标压缩修复（`.fund-account-summary` 在 760px 以下改为两列并降低卡片高度）已提交，但修复后未重新用内置浏览器复测：本轮取证后浏览器工具在本会话中不再可用。修复后窄屏截图与首屏可见范围待补，本维度保持待复核。
- RISEMAP 当前账号没有账户记录，卡片/表格有数据布局、详情、编辑、停用、期初余额冻结与后续流水行为无法同材料对照，只能标为待 RISEMAP 复核。
- 独立验收尚未发生。
- 实际耗时、调用与费用：无可靠统一来源，记为未知。

## 四维结果

| 维度 | 结果 | 说明 |
| --- | --- | --- |
| replication | blocked | RISEMAP 无账户数据且本轮未重新打开；字段清单与空态来自前次观察。 |
| visual | pending | 桌面卡片、表格与有数据/空态已核对；窄屏修复后复测与独立视觉复核待完成。 |
| interaction | pending | 阻断、创建、搜索、类型筛选、视图切换、重置均实际操作并通过；窄屏修复后交互复测待补。 |
| business | pending | 新建与同库停服重启回读通过；同材料 RISEMAP 办理与独立验收待完成。 |
