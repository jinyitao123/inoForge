# Forge 采购最小业务链

## 已实现范围

本切片按 RISEMAP RM-021 与 RM-005 的已观察契约，实现采购订单头、采购订单明细和行级到货通知：

1. 草稿采购订单引用既有供应商、目标仓库和负责人，采购明细引用既有 SKU，并保存数量、税率与四位小数价格快照。
2. “提交审核”校验启用供应商和至少一条有效明细，按明细回算物料数、采购总数量和含税总额，将订单推进到 `pending_approval`。
3. “同意”将订单推进到 `approved`，按每条采购明细生成一条 `pending_arrival` 到货通知。通知保留订单、订单行、供应商、仓库、SKU、交期和待到货数量引用。
4. 重复审批被拒绝，且已生成的行级到货通知不会重复创建。

对象和动作分别位于：

- `apps/forge-objectstack/src/objects/procurement.object.ts`
- `apps/forge-objectstack/src/actions/procurement.action.ts`

## 验收

在独立 SQLite 数据库上运行：

```bash
pnpm typecheck
pnpm validate
pnpm build
FORGE_URL=http://localhost:4322 pnpm acceptance:procurement
# 停止并使用同一数据库重启服务后
FORGE_URL=http://localhost:4322 pnpm acceptance:procurement-restart
```

API 验收使用 `OEM-RM-20260909-A` 标准数据里的供应商、PLC SKU 和仓库。报告写入本地忽略目录：

- `.objectstack/acceptance/procurement-chain-report.json`
- `.objectstack/acceptance/procurement-restart-report.json`

## 明确边界

审批只生成待到货计划，不代表实物已经到场，也不更新订单行的已到货、已检验、合格或已入库数量。

实际到货登记、待检库存、检验单、合格与不合格分流、采购入库和库存流水尚未实现。付款申请、采购发票、应付生成和采购退换货也不在本切片内。

RISEMAP 要求已审批供应商才能用于采购订单。当前 Forge 供应商主数据只有草稿和待审批状态，缺少审批通过状态，因此本切片暂时只验证供应商业务状态为启用；该差异已保留在验收报告中。

ObjectStack 17.3.0 在本应用内曾出现事务包裹的审计写入超时，本动作采用逐行幂等查询后写入到货通知，并在最后推进订单状态。并发审批仍需后续通过唯一业务键或运行时事务修复完成验证。
