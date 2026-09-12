# 委外样板与 RISEMAP 并排对照

对照日期：2026-09-12  
Forge 基线：`codex/subcontract-return`，待合并提交
RISEMAP 基线：已保存的当前页面证据 RM-087、RM-093，以及委外回厂/NCR 证据。  
对照范围：页面结构、岗位入口、来源关系、状态动作、结果字段和阻断反馈。只读证据不被解释为 RISEMAP 写入成功证据。

## 对照矩阵

| 对照项 | RISEMAP 已观察 | Forge 当前实现 | 判定 |
| --- | --- | --- | --- |
| 一级区域 | 委外入口位于“生产 → 委外管理” | `objectstack.config.ts` 位于“生产 → 委外管理” | 结构一致 |
| 看板待办入口 | RM-082 的进行中、待发料、待回厂、待对账指标可点击进入对应业务入口 | Forge 四个指标卡均可点击；待对账进入 `page_subcontract_reconciliation`，待发料/待回厂进入对应岗位页 | 行为已补齐；实际样本数量仍随数据库状态变化 |
| 发料状态入口 | RM-084 的全部发料单、待审核、待发料、待签收指标可筛选列表 | Forge 四个指标卡直接驱动状态筛选，点击后保持选中态并可恢复全部 | 浏览器已验证；真实发料样本的状态数量仍随数据库状态变化 |
| 委外库存入口 | RM-089 独立“委外厂库存”工作台，支持供应商/物料视角、账龄筛选、超 30 天入口和“去发料” | `page_subcontract_stock` 独立业务页面；原 `forge_subcontract_stock_balance` 对象保留为数据底座 | 浏览器已验证入口、视角、账龄筛选和去发料路径；账龄起算口径仍是 Forge 工程推断 |
| 委外未交入口 | RM-091 独立“委外未交明细表”，按加工件行展示未交、交期、超期、供应商和工艺筛选 | `page_subcontract_undelivered` 独立只读业务报表；从订单与订单加工件计算未交量，行级返回委外订单上下文 | 浏览器已验证首屏、空状态、超期切换和 Console 供应商筛选；当前独立库无未交样本，真实行级回跳与金额样本待补证 |
| 批次追溯入口 | RM-090 独立“委外批次追溯”，支持材料批次正向召回和成品批号反向定位材料 | `page_subcontract_trace` 独立只读追溯工具；读取发料批次、回厂批次和耗用记录，支持模式切换、查询和导出 | 浏览器已验证模式切换、输入语义、空结果和导出禁用；当前模型缺少材料批次到成品批次的直接明细关联，结果按订单+物料聚合并标记“未登记”，真实样本待复核 |
| 委外进货入口 | RM-092 独立“委外进货明细表”，按回厂物料行展示回厂量、良品、不良、良率、加工费、仓库、批次、检验员和状态 | `page_subcontract_inbound_report` 独立只读报表；复用回厂明细并关联订单、供应商、入库明细和仓库，支持搜索、供应商、日期、不良筛选、导出及上下文回跳 | 浏览器已验证首屏字段、空状态、搜索、不良筛选和生产菜单路由；当前独立库无回厂样本，真实金额、良率、仓库和订单回跳待补证 |
| 委外退料入口 | RM-086 “委外退料”列表含有效退料单、待入库、已入库 KPI；新建单登记甲供料订单余量和退料原因，确认后生成待入库单 | `page_subcontract_return_workspace` 按列表、草稿、待入库三个岗位节点办理；服务端阻断包工包料、超在外余量、重复确认，并在入库后回写委外余额、累计退料和 `material_return` 流水 | 本地真实材料链、浏览器页面和同库重启已验证；RISEMAP 当前线上写入、供应商外部确认、赔偿语义仍待复核 |
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
- 委外库存工作台：`apps/forge-objectstack/src/pages/subcontract-stock.page.ts`
- 状态动作：`apps/forge-objectstack/src/actions/subcontract-reconciliation.action.ts`、`subcontract-ncr.action.ts`、`subcontract.action.ts`
- 浏览器和重启证据：`docs/forge-subcontract-acceptance-review-20260912.md`、`docs/forge-subcontract-reconciliation-slice.md`及 `apps/forge-objectstack/tests/subcontract-*.mjs`

## 对照结论

1. 页面信息架构已经按 RISEMAP 的生产/委外入口拆分，委外库存、待办池和结果报表没有再直接暴露为单一技术对象页面。
2. Forge 已证明一条真实回厂批次从订单上下文经过 NCR 阻断、质量处置、对账和应付的连续业务路径。
3. 目前只能把字段结构、入口关系和已实际办理的 Forge 行为列为已证明；不能把 RISEMAP 只读页面推断出的供应商确认、部分结算、差异关闭和付款关系写成已复刻。
4. 视觉差异属于 ObjectStack Console 承载差异，不作为当前功能阻断；错误状态、来源丢失、异常绕过和无法进入下一岗位仍是阻断。

因此，本样板可以进入“委外剩余行为的证据复核”，但不能作为采购、生产、销售或财务其他模块的自动迁移模板。
