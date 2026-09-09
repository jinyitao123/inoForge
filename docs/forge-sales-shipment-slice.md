# Forge 销售发货计划切片

## 结果

Forge 已实现“执行中销售订单 → 分批创建销售发货单和发货明细 → 库存校验后确认出库 → 回写发货与订单进度”。同输入验收从 2 台控制柜订单建立 1 台的发货单，先保持待发货、已出库 0，再用可用库存 1 创建客户自取出库单。最终发货单为已出库 1/1，订单为部分发货，已发货数量 1、金额 128000。

这个切片复制客户发货计划和库存满足后的销售出库执行。RISEMAP 实测证明两者是上下游单据：库存为 0 时可在警告后继续创建销售发货单，但供应链“去发货”会提示先完成期初入库；完成期初入库并具备可用库存后，才允许客户自取发货并生成出库单。

## RISEMAP 实测契约

| 规则 | 实测结果 | Forge 对照 |
| --- | --- | --- |
| 分批建单 | SO-2026-0001 订单 2 台，本次可填 1 台 | 动作接收本次数量，检查已有未取消发货明细的占用量 |
| 库存不足 | 库存0、可用0时弹出警告，可继续创建发货单 | 建发货单不读写库存 |
| 发货单金额 | 1 台显示 128000，采用明细折前含税单价，不是整单 5% 折扣后比例金额 121600 | 按 `taxed_unit_price × quantity` 写入发货单和明细 |
| 出库进度 | DN-2026-0001 创建后为待发货、0/1 台、关联出库单0 | 发货单和明细 `outbound_quantity=0`，订单已发货值不变 |
| 实际出库门槛 | 待出库队列可见该发货单；无期初库存时出库创建被阻断；库存满足后客户自取确认生成出库单 | Forge 出库动作要求显式可用库存，生成出库单并回写发货单、发货明细、订单数量与金额；库存流水仍待实现 |

RISEMAP 证据为 `2098` 至 `2107`，包括发货表单、数量1、库存警告、发货单终态、待出库队列、出库表单和期初库存阻断。

## Forge 动作与验收

`sales_order_create_shipment` 仅在订单执行中或部分发货时显示。当前实现要求订单只有一条物料明细，收集发货单号、日期、收货人、电话、地址和本次数量。数量不得超过订单数量减去未取消发货明细已占用的数量。

`sales-shipment.integration.mjs` 的 3 项检查已通过：创建 1 台分批发货计划；证明订单已发货数量和金额仍为 0；阻断超过未建单余量的请求。报告保存于 `.objectstack/acceptance/sales-shipment-report.json`。

内置浏览器已实际打开 Forge 订单、创建发货单动作表单和发货单详情。完整停服并从同一 SQLite 文件重启后，API 回读和内置浏览器都再次确认同一 ID、待发货、数量 1、金额 128000、已出库 0和出库单数 0。随后 API 以可用库存 1 执行客户自取出库，出库单、发货单和订单回写通过 `pnpm acceptance:sales-outbound`；再次重启后，内置浏览器确认发货单已出库 1/1、出库单数 1，并能打开同一出库单详情。页面证据包括 [订单发货占用回写](references/risemap-capture/deep/sales/orders/rm-060/789-forge-iab-order-shipment-rollup.png)、[创建发货单表单](references/risemap-capture/deep/sales/orders/rm-060/790-forge-iab-create-shipment-dialog.png)、[发货单计划详情](references/risemap-capture/deep/sales/orders/rm-060/791-forge-iab-shipment-detail.png)、[计划重启回读](references/risemap-capture/deep/sales/orders/rm-060/792-forge-iab-shipment-restart-readback.png)、[出库后发货单回写](references/risemap-capture/deep/supply-chain/outbound/rm-043/800-forge-iab-shipment-outbounded.png)、[销售出库单列表](references/risemap-capture/deep/supply-chain/outbound/rm-043/801-forge-iab-sales-outbound-list.png) 和 [销售出库单详情](references/risemap-capture/deep/supply-chain/outbound/rm-043/802-forge-iab-sales-outbound-detail.png)。

当前动作在 ObjectStack 17.3.0 中不能把新发货单、明细和订单占用回写包在 `ctx.api.transaction` 内：开发运行时的审计写入会等待至 30 秒超时。当前使用顺序写入，因此中间写入失败时的补偿或原子性仍是未闭合风险。多明细分配、多订单合并发货、发货单取消、并发占用、持久库存余额扣减和库存流水仍在后续切片处理。
