import assert from 'node:assert/strict';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4517';
const database = process.env.FORGE_DB || '.objectstack/otc-audit-walkthrough-20260921.sqlite';
const api = await connect(endpoint);

async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '500' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, `${object}: ${JSON.stringify(response.value)}`);
  return (response.value.records || []).filter(record =>
    Object.entries(where).every(([field, value]) => record[field] === value),
  );
}

async function one(object, where) {
  const records = await find(object, where);
  assert.equal(records.length, 1, `${object} must contain exactly one ${JSON.stringify(where)}`);
  return records[0];
}

const customer = await one('forge_customer', { name: '苏州澄岳自动化装备有限公司' });
const project = await one('forge_project', { code: 'PRJ-2026-002' });
const quotation = await one('forge_quotation', { code: 'QT-HC-20260917-001' });
const contract = await one('forge_sales_contract', { code: 'SC-HC-20260922-001' });
const order = await one('forge_sales_order', { code: 'SO-HC-20260923-001' });
const orderLine = await one('forge_sales_order_line', { order_id: order.id });
const link = await one('forge_project_sales_link', { project_id: project.id });
const plan = await one('forge_project_plan', { project_id: project.id });
const phase = await one('forge_project_work_item', { plan_id: plan.id });
const bom = await one('forge_bom', { code: 'BOM-RM-CAB-800-V1' });
const assembly = await one('forge_assembly_order', { code: 'ASM-2026-0075' });
const materialDocument = await one('forge_production_material_document', { code: 'MAT-2026-0031' });
const productionInbound = await one('forge_production_inbound', { code: 'WIN-2026-0048' });
const assemblyLines = await find('forge_assembly_material_line', { assembly_id: assembly.id });
const productionLedgers = (await find('forge_inventory_ledger')).filter(record =>
  record.source_id === materialDocument.id || record.source_id === productionInbound.id,
);
const shipment = await one('forge_sales_shipment', { code: 'DN-HC-20261030-001' });
const shipmentLine = await one('forge_sales_shipment_line', { shipment_id: shipment.id });
const invoice = await one('forge_sales_invoice', { order_id: order.id });
const receivable = await one('forge_accounts_receivable', { order_id: order.id });
const allocations = await find('forge_collection_allocation', { order_id: order.id });
const receipts = await find('forge_cash_receipt');

assert.equal(project.customer_id, customer.id);
assert.equal(project.status, 'in_progress');
assert.equal(project.contract_amount, 243200);
assert.equal(project.invoice_amount, 243200);
assert.equal(project.collected_amount, 243200);
assert.equal(plan.status, 'active');
assert.equal(phase.name, '审计走查-方案设计与交付执行');
assert.equal(phase.status, 'pending');
assert.equal(quotation.customer_id, customer.id);
assert.equal(quotation.status, 'accepted');
assert.equal(quotation.total_amount, 243200);
assert.equal(contract.quotation_id, quotation.id);
assert.equal(contract.status, 'active');
assert.equal(contract.total_amount, 243200);
assert.equal(order.contract_id, contract.id);
assert.equal(order.status, 'shipped');
assert.equal(order.total_amount, 243200);
assert.equal(order.shipped_amount, 243200);
assert.equal(order.invoiced_amount, 243200);
assert.equal(order.collected_amount, 243200);
assert.equal(orderLine.quantity, 2);
assert.equal(orderLine.shipped_quantity, 2);
assert.equal(orderLine.invoiced_quantity, 2);
assert.equal(orderLine.item_code, 'FG-RM-CAB-800');
assert.equal(link.order_id, order.id);
assert.equal(link.contract_id, contract.id);
assert.equal(link.order_amount, 243200);
assert.equal(bom.status, 'active');
assert.equal(bom.node_count, 4);
assert.equal(assembly.sales_order_id, order.id);
assert.equal(assembly.bom_id, bom.id);
assert.equal(assembly.status, 'completed');
assert.equal(assembly.planned_quantity, 2);
assert.equal(assembly.qualified_quantity, 2);
assert.equal(assembly.rejected_quantity, 0);
assert.equal(assembly.inbound_quantity, 2);
assert.equal(assembly.issued_quantity, 10);
assert.equal(assembly.returned_quantity, 0);
assert.equal(assemblyLines.length, 4);
assert.equal(assemblyLines.reduce((sum, record) => sum + Number(record.required_quantity || 0), 0), 10);
assert.equal(assemblyLines.reduce((sum, record) => sum + Number(record.net_issued_quantity || 0), 0), 10);
assert.ok(assemblyLines.every(record => record.status === 'completed'));
assert.equal(materialDocument.assembly_id, assembly.id);
assert.equal(materialDocument.document_type, 'issue');
assert.equal(materialDocument.status, 'confirmed');
assert.equal(materialDocument.line_count, 4);
assert.equal(materialDocument.total_quantity, 10);
assert.equal(productionInbound.assembly_id, assembly.id);
assert.equal(productionInbound.status, 'stocked');
assert.equal(productionInbound.qualified_quantity, 2);
assert.equal(productionInbound.rejected_quantity, 0);
assert.equal(productionInbound.batch_number, 'ASM-AUDIT-20260921-001');
assert.equal(productionLedgers.filter(record => record.movement_type === 'production_issue').length, 4);
assert.equal(productionLedgers.filter(record => record.movement_type === 'production_inbound').length, 1);
assert.equal(productionLedgers.filter(record => record.movement_type === 'production_issue').reduce((sum, record) => sum + Number(record.quantity || 0), 0), 10);
assert.equal(productionLedgers.filter(record => record.movement_type === 'production_inbound').reduce((sum, record) => sum + Number(record.quantity || 0), 0), 2);
assert.equal(shipmentLine.order_id, order.id);
assert.equal(shipment.status, 'outbounded');
assert.equal(shipment.total_quantity, 2);
assert.equal(shipment.outbound_quantity, 2);
assert.equal(shipment.total_amount, 243200);
assert.equal(invoice.status, 'settled');
assert.equal(invoice.total_amount, 243200);
assert.equal(receivable.status, 'settled');
assert.equal(receivable.outstanding_amount, 0);

const approvedAllocations = allocations.filter(record => record.status === 'approved');
const approvedAllocatedAmount = approvedAllocations.reduce((sum, record) => sum + Number(record.amount || 0), 0);
const receiptIds = new Set(allocations.map(record => record.receipt_id));
const linkedReceipts = receipts.filter(record => receiptIds.has(record.id));
assert.equal(approvedAllocatedAmount, 243200);
assert.equal(linkedReceipts.filter(record => record.status === 'allocated').reduce((sum, record) => sum + Number(record.amount || 0), 0), 243200);

const [purchaseOrders, assemblies, subcontractOrders, commissioningRecords, deliveryPackages, acceptances, settlements] = await Promise.all([
  find('forge_purchase_order'),
  find('forge_assembly_order'),
  find('forge_subcontract_order'),
  find('forge_commissioning_record'),
  find('forge_delivery_package'),
  find('forge_customer_acceptance'),
  find('forge_project_settlement'),
]);

const linkedPurchaseOrders = purchaseOrders.filter(record => record.project_id === project.id || record.bom_id === bom.id);
const linkedAssemblies = assemblies.filter(record => record.sales_order_id === order.id);
const linkedSubcontractOrders = subcontractOrders.filter(record =>
  record.project_id === project.id || record.source_sales_order_id === order.id,
);
const linkedCommissioning = commissioningRecords.filter(record => record.project_id === project.id);
const linkedDeliveryPackages = deliveryPackages.filter(record => record.project_id === project.id);
const linkedAcceptances = acceptances.filter(record => record.project_id === project.id);
const linkedSettlements = settlements.filter(record => record.project_id === project.id);

assert.equal(linkedPurchaseOrders.length, 0);
assert.equal(linkedAssemblies.length, 1);
assert.equal(linkedAssemblies[0].id, assembly.id);
assert.equal(linkedSubcontractOrders.length, 0);
assert.equal(linkedCommissioning.length, 0);
assert.equal(linkedDeliveryPackages.length, 0);
assert.equal(linkedAcceptances.length, 0);
assert.equal(linkedSettlements.length, 0);

const gaps = [
  {
    id: 'G01',
    severity: 'blocker',
    finding: '项目/BOM仍没有采购订单或委外订单承接；组装已关联销售订单并完工，但使用现有历史库存，不能证明项目缺料到采购入库的唯一来源链。',
  },
  {
    id: 'G02',
    severity: 'blocker',
    finding: '销售出库已按来源回读，但没有调试、交付包、客户验收或项目结算。',
  },
  {
    id: 'G05',
    severity: 'high',
    finding: '项目计划只有一个待开始阶段，不能证明设计、采购、生产、交付和财务岗位已经连续承接。',
  },
];

const report = {
  kind: 'otc-same-material-audit-walkthrough-readback',
  status: 'blocked_before-procurement-and-delivery-acceptance',
  endpoint,
  database,
  restartReadback: process.argv.includes('--restart'),
  material: {
    customer: customer.name,
    project: project.code,
    quotation: quotation.code,
    contract: contract.code,
    order: order.code,
    item: orderLine.item_code,
    bom: bom.code,
    shipment: shipment.code,
    invoice: invoice.code,
    receivable: receivable.code,
  },
  observed: {
    project: { status: project.status, progress: project.progress, contractAmount: project.contract_amount, invoiceAmount: project.invoice_amount, collectedAmount: project.collected_amount },
    plan: { status: plan.status, itemCount: plan.item_count, phase: phase.name, phaseStatus: phase.status },
    commercial: { quotationStatus: quotation.status, contractStatus: contract.status, orderStatus: order.status, orderAmount: order.total_amount, shippedAmount: order.shipped_amount, invoicedAmount: order.invoiced_amount, collectedAmount: order.collected_amount },
    supplyAndProduction: {
      purchaseOrders: 0,
      subcontractOrders: 0,
      assembly: assembly.code,
      assemblyStatus: assembly.status,
      plannedQuantity: assembly.planned_quantity,
      qualifiedQuantity: assembly.qualified_quantity,
      materialDocument: materialDocument.code,
      issuedQuantity: materialDocument.total_quantity,
      productionInbound: productionInbound.code,
      inboundQuantity: productionInbound.qualified_quantity,
      batchNumber: productionInbound.batch_number,
      materialCost: assembly.material_cost,
    },
    shipment: { status: shipment.status, quantity: shipment.total_quantity, outboundQuantity: shipment.outbound_quantity, amount: shipment.total_amount },
    delivery: { commissioningRecords: 0, deliveryPackages: 0, customerAcceptances: 0 },
    finance: { invoiceStatus: invoice.status, invoiceAmount: invoice.total_amount, receivableStatus: receivable.status, approvedAllocatedAmount, projectSettlementCount: 0 },
  },
  resolved: [
    '已按实际出库回读订单行与发货单，状态为已出库，数量为2。',
    '发货金额已从折前256000元校正为订单折后243200元。',
    '订单、合同、项目的开票和回款汇总已与有效发票、应收和已审核核销一致。',
    '组装单 ASM-2026-0075 已按销售订单生成，MAT-2026-0031 完成 4 种/10 件领料过账，WIN-2026-0048 完成 2 台合格生产入库并完工。',
    'Forge 本库历史平均成本导致本次物料投入为 1278.4426 元，与 RISEMAP 本次 28885 元左右的标准成本口径不一致，仅数量和单据链通过。',
  ],
  gaps,
  boundary: '该结果只证明独立 Forge 数据库中的同一材料现状与断点；RISEMAP 同材料结果必须以浏览器实时页面单独记录，不能由本报告替代。',
};

console.log(JSON.stringify(report, null, 2));
