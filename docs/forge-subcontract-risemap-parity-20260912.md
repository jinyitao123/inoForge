# 委外样板与 RISEMAP 并排对照

对照日期：2026-09-12  
Forge 基线：`main`，提交 `13b2f5f`  
RISEMAP 基线：已保存的当前页面证据 RM-087、RM-093，以及委外回厂/NCR 证据。  
对照范围：页面结构、岗位入口、来源关系、状态动作、结果字段和阻断反馈。只读证据不被解释为 RISEMAP 写入成功证据。

## 对照矩阵

| 对照项 | RISEMAP 已观察 | Forge 当前实现 | 判定 |
| --- | --- | --- | --- |
| 一级区域 | 委外入口位于“生产 → 委外管理” | `objectstack.config.ts` 位于“生产 → 委外管理” | 结构一致 |
| 委外结算入口 | RM-087 独立“委外对账”入口 | `page_subcontract_reconciliation` 独立页面 | 结构一致 |
| 结果报表入口 | RM-093 独立“委外对账单”结果页 | `page_subcontract_reconciliation_report` 独立页面 | 结构一致 |
| 待办聚合维度 | 待对账池按供应商、订单、回厂批次聚合 | Forge 按可结算回厂批次列出供应商、订单、批次、良品数量和加工费 | 结构一致；聚合细节仍待同材料复核 |
| 合并关系 | 已保存证据显示多个回厂批次可合并为一张对账单 | 页面允许勾选多个批次生成一张对账单 | 行为实现，RISEMAP 同材料写入仍待复核 |
| 结算资格 | 页面和指南证据指向已入库且尚未对账的来源 | Forge 还要求入库完成、NCR 已执行且来源未被占用 | Forge 有额外阻断；是否与 RISEMAP 完全一致待复核 |
| 费用展示 | RM-093 展示加工费、补料、扣款、应付 | Forge 展示相同费用列及来源行 | 字段结构一致 |
| 应付公式 | 已观察口径为加工费 + 补料 − 扣款 | Forge 首版按该公式计算，未接入的费用明确为零值 | 公式一致；来源分配待复核 |
| 状态 | RM-087/RM-093 至少有待确认、已确认、已生成应付、已作废 | Forge 映射为 `pending_confirmation`、`confirmed`、`payable_generated`、`voided` | 状态集合一致；动作语义待复核 |
| 来源穿透 | RISEMAP 页面展示订单、回厂批次和费用信息 | Forge 对账单展示订单、回厂单和金额来源行；订单上下文还显示 NCR 和入库 | Forge 信息更完整；不代表 RISEMAP 页面等价 |
| 异常阻断 | 已保存证据未证明未入库/NCR 的完整写入阻断路径 | Forge 页面保留异常批次并显示阻断原因及下一步 | Forge 工程实现，RISEMAP 待复核 |
| 订单上下文 | 委外订单、发料、回厂、质量和结算入口分属委外任务 | Forge 用订单上下文串联岗位入口和下一步 | 任务结构对齐；RISEMAP 连续写入未证明 |
| 确认动作 | 当前 RISEMAP 证据未能证明内部确认、供应商确认和应付生成的拆分 | Forge 首版为“确认锁定”后“生成应付” | 明确差异，保留待决策 |
| 部分结算/差异 | 当前证据未证明 | Forge 未实现部分确认、重开、拆分和差异关闭 | 未实现且正确保留待复核 |

## 证据索引

RISEMAP：

- RM-087 待对账池：`docs/references/risemap-capture/deep/production/subcontract-reconciliation/rm087/984-rm087-pool-supplier.dom.txt`、`985-rm087-pool-order.dom.txt`、`986-rm087-pool-receive-batch.dom.txt`、`987-rm087-statement-tab.dom.txt`、`988-rm087-statement-status.dom.txt`
- RM-093 结果页：`docs/references/risemap-capture/deep/production/subcontract-reconciliation-report/rm093/1002-rm093-summary.dom.txt`、`1003-rm093-lines.dom.txt`、`1004-rm093-fee-type.dom.txt`、`1005-rm093-status-filter.dom.txt`、`1006-rm093-empty-export.dom.txt`
- 委外回厂、入库和 NCR 的补充证据见 `docs/references/risemap-capture/deep/production/` 对应目录及 `docs/risemap-rolling-handoff.md`。

Forge：

- 菜单与页面入口：`apps/forge-objectstack/objectstack.config.ts`
- 订单上下文：`apps/forge-objectstack/src/pages/subcontract-workspace.page.ts`
- 委外对账池：`apps/forge-objectstack/src/pages/subcontract-reconciliation.page.ts`
- 结果报表：`apps/forge-objectstack/src/pages/subcontract-reconciliation-report.page.ts`
- 状态动作：`apps/forge-objectstack/src/actions/subcontract-reconciliation.action.ts`、`subcontract-ncr.action.ts`、`subcontract.action.ts`
- 浏览器和重启证据：`docs/forge-subcontract-acceptance-review-20260912.md`、`docs/forge-subcontract-reconciliation-slice.md`及 `apps/forge-objectstack/tests/subcontract-*.mjs`

## 对照结论

1. 页面信息架构已经按 RISEMAP 的生产/委外入口拆分，待办池和结果报表没有再合并成单一技术对象页面。
2. Forge 已证明一条真实回厂批次从订单上下文经过 NCR 阻断、质量处置、对账和应付的连续业务路径。
3. 目前只能把字段结构、入口关系和已实际办理的 Forge 行为列为已证明；不能把 RISEMAP 只读页面推断出的供应商确认、部分结算、差异关闭和付款关系写成已复刻。
4. 视觉差异属于 ObjectStack Console 承载差异，不作为当前功能阻断；错误状态、来源丢失、异常绕过和无法进入下一岗位仍是阻断。

因此，本样板可以进入“委外剩余行为的证据复核”，但不能作为采购、生产、销售或财务其他模块的自动迁移模板。
