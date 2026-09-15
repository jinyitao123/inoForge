# 供应链页面快速交付记录

日期：2026-09-15

分支：`codex/supply-chain-pages`

独立工作树：`/Users/jinyitao/Developer/inoForge-supply-chain-pages`

独立运行：`http://localhost:4386`

独立 SQLite：`apps/forge-objectstack/.objectstack/acceptance/supply-chain-pages.sqlite`

## 本轮已核对

内置浏览器已登录独立 Forge 环境，并实际打开以下页面：

- 采购订单：`page_purchase_order_workspace`
- 到货登记：`page_purchase_arrival_workspace`
- 待检验库存：`page_pending_inspection_workspace`
- 检验单：`page_purchase_inspection_workspace`
- 采购入库：`page_purchase_inbound_workspace`
- 库存锁定：`page_inventory_locks`
- 物料组合：`page_material_combinations`

采购、到货、检验、入库和库存锁定页面均呈现真实表格、筛选、刷新、空态和业务入口；库存锁定已实际打开“新增业务锁库”表单，表单包含锁库方式、仓库物料、数量、日期、来源单号、原因和下一步确认。

## 页面覆盖

供应链导航已覆盖到货检验、基础资料、采购管理、入库管理、库存管理和出库管理。库存锁定、盘点、调拨与借出、库存预警、报损、SN 码管理共用真实库存作业组件，支持新建、二次确认、提交/执行、释放/归还、筛选和回读。

## 工程门禁

- `pnpm typecheck`：通过
- `pnpm validate`：通过
- `pnpm build`：通过
- `pnpm acceptance:page-control-usability`：通过
- `pnpm acceptance:page-visible-language`：通过
- `pnpm acceptance:supply-production-control-usability`：通过
- `pnpm acceptance:console-controls`：通过
- `pnpm acceptance:product-structure`：通过
- 独立服务重启后 `/api/v1/health` 与 `/api/v1/ready`：通过
- 同一 SQLite 重启后仍可正常打开页面并保留平台表结构：通过

## 边界

物料组合、综合物料搜索、产品实例追溯、采购申请、采购待办池、询价、供应商价格本、全部入库单、入库明细、处置执行中心、出库明细等页面已经有独立入口、来源对象、数据汇总、筛选和跳转，但其中部分动作仍由来源单据页办理。它们是“页面与入口已覆盖”，不是“每个菜单都已经有独立单据写入闭环”。

本轮未把独立分支的空数据库夹具数据写入主线，也未改变主工作树、主端口或评估会话数据库。完整 RISEMAP 同材料业务办理、API 数量/库存断言和停服重启后的业务数据回读，保留给后续逐条流程验收。
