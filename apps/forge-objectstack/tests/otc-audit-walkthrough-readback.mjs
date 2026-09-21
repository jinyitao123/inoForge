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
const shipment = await one('forge_sales_shipment', { code: 'DN-HC-20261030-001' });
const shipmentLine = await one('forge_sales_shipment_line', { shipment_id: shipment.id });
const invoice = await one('forge_sales_invoice', { order_id: order.id });
const receivable = await one('forge_accounts_receivable', { order_id: order.id });
const allocations = await find('forge_collection_allocation', { order_id: order.id });
const receipts = await find('forge_cash_receipt');

assert.equal(project.customer_id, customer.id);
assert.equal(project.status, 'in_progress');
assert.equal(project.contract_amount, 243200);
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
assert.equal(order.status, 'active');
assert.equal(order.total_amount, 243200);
assert.equal(orderLine.quantity, 2);
assert.equal(orderLine.item_code, 'FG-RM-CAB-800');
assert.equal(link.order_id, order.id);
assert.equal(link.contract_id, contract.id);
assert.equal(link.order_amount, 243200);
assert.equal(bom.status, 'active');
assert.equal(bom.node_count, 4);
assert.equal(shipmentLine.order_id, order.id);
assert.equal(shipment.status, 'pending_shipment');
assert.equal(shipment.total_quantity, 2);
assert.equal(shipment.outbound_quantity, 0);
assert.equal(shipment.total_amount, 256000);
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
assert.equal(linkedAssemblies.length, 0);
assert.equal(linkedSubcontractOrders.length, 0);
assert.equal(linkedCommissioning.length, 0);
assert.equal(linkedDeliveryPackages.length, 0);
assert.equal(linkedAcceptances.length, 0);
assert.equal(linkedSettlements.length, 0);

const gaps = [
  {
    id: 'G01',
    severity: 'blocker',
    finding: '项目/BOM没有采购订单、组装单或委外订单承接，物料齐套与生产来源链为空。',
  },
  {
    id: 'G02',
    severity: 'blocker',
    finding: '发货单仍为待发货且出库数量为0，没有调试、交付包、客户验收或项目结算。',
  },
  {
    id: 'G03',
    severity: 'blocker',
    finding: 'Forge 已有结清发票与243200元已审批核销，但销售订单、合同和项目的开票汇总仍为0或空。',
  },
  {
    id: 'G04',
    severity: 'high',
    finding: '发货单按折前金额256000元建单，而订单合同金额为折后243200元。',
  },
  {
    id: 'G05',
    severity: 'high',
    finding: '项目计划只有一个待开始阶段，不能证明设计、采购、生产、交付和财务岗位已经连续承接。',
  },
];

const report = {
  kind: 'otc-same-material-audit-walkthrough-readback',
  status: 'blocked_before-procurement-and-production',
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
    commercial: { quotationStatus: quotation.status, contractStatus: contract.status, orderStatus: order.status, orderAmount: order.total_amount },
    supplyAndProduction: { purchaseOrders: 0, assemblies: 0, subcontractOrders: 0 },
    shipment: { status: shipment.status, quantity: shipment.total_quantity, outboundQuantity: shipment.outbound_quantity, amount: shipment.total_amount },
    delivery: { commissioningRecords: 0, deliveryPackages: 0, customerAcceptances: 0 },
    finance: { invoiceStatus: invoice.status, invoiceAmount: invoice.total_amount, receivableStatus: receivable.status, approvedAllocatedAmount, projectSettlementCount: 0 },
  },
  gaps,
  boundary: '该结果只证明独立 Forge 数据库中的同一材料现状与断点；RISEMAP 同材料结果必须以浏览器实时页面单独记录，不能由本报告替代。',
};

console.log(JSON.stringify(report, null, 2));
