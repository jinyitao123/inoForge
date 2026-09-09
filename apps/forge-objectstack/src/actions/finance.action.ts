import { defineAction } from '@objectstack/spec/ui';

const locations = ['record_header', 'record_more'] as const;

export const SalesOrderIssueInvoice = defineAction({
  name: 'sales_order_issue_invoice', label: '登记销售发票', objectName: 'forge_sales_order', icon: 'receipt-text',
  locations: [...locations], order: 30, visible: `record.status == 'partially_shipped' || record.status == 'shipped'`, refreshAfter: true,
  description: '按已发货且尚未开票的数量登记销项发票，并同步生成一笔未收应收账款。',
  successMessage: '销项发票与应收账款已登记',
  params: [
    { field: 'code', objectOverride: 'forge_sales_invoice', required: true },
    { field: 'invoice_on', objectOverride: 'forge_sales_invoice', required: true },
    { field: 'due_on', objectOverride: 'forge_sales_invoice', required: true },
    { field: 'quantity', objectOverride: 'forge_sales_invoice_line', required: true },
    { field: 'remarks', objectOverride: 'forge_sales_invoice' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_sales_invoice/record/${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前销售订单不存在或不可访问');
if (!['partially_shipped', 'shipped'].includes(order.status)) throw new Error('仅部分发货或已发货订单可以登记销售发票');
const lines = await ctx.api.object('forge_sales_order_line').find({ where: { order_id: id } });
if (lines.length !== 1) throw new Error('当前切片仅支持单条物料明细订单开票');
const line = lines[0], requested = Number(ctx.input.quantity || 0);
if (!(requested > 0)) throw new Error('本次开票数量必须大于0');
const invoiceable = Number(line.shipped_quantity || 0) - Number(line.invoiced_quantity || 0);
if (requested > invoiceable) throw new Error('本次开票数量超过已发货未开票数量');
if (String(ctx.input.due_on) < String(ctx.input.invoice_on)) throw new Error('应收日期不得早于开票日期');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const invoiceUnitPrice = round4(Number(line.taxed_subtotal || 0) / Number(line.quantity || 0));
const total = round4(requested * invoiceUnitPrice);
const nextInvoicedAmount = round4(Number(order.invoiced_amount || 0) + total);
if (nextInvoicedAmount > Number(order.total_amount || 0)) throw new Error('累计开票金额不得超过订单含税金额');
const created = await ctx.api.object('forge_sales_invoice').insert({
  name: order.code + ' 销项发票 ' + ctx.input.code, code: ctx.input.code, order_id: id,
  contract_id: order.contract_id || null, customer_id: order.customer_id, invoice_on: ctx.input.invoice_on,
  due_on: ctx.input.due_on, total_amount: total, collected_amount: 0, outstanding_amount: total,
  status: 'issued', responsible_id: order.responsible_id, remarks: ctx.input.remarks || ('由销售订单 ' + order.code + ' 登记'),
});
const invoiceId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
if (!invoiceId) throw new Error('销项发票创建后未返回记录ID');
await ctx.api.object('forge_sales_invoice_line').insert({
  name: line.name, invoice_id: invoiceId, order_id: id, order_line_id: line.id, sku_id: line.sku_id,
  item_code: line.item_code || null, model: line.model || null, specification: line.specification || null,
  unit_name: line.unit_name || null, quantity: requested, taxed_unit_price: invoiceUnitPrice,
  tax_rate: Number(line.tax_rate || 0), taxed_subtotal: total, remarks: line.remarks || null,
});
const receivableCode = 'AR-' + ctx.input.code;
const receivableCreated = await ctx.api.object('forge_accounts_receivable').insert({
  name: order.code + ' 应收 ' + ctx.input.code, code: receivableCode, invoice_id: invoiceId, order_id: id,
  contract_id: order.contract_id || null, customer_id: order.customer_id, recognized_on: ctx.input.invoice_on,
  due_on: ctx.input.due_on, original_amount: total, collected_amount: 0, outstanding_amount: total,
  status: 'unpaid', responsible_id: order.responsible_id, remarks: '由销项发票 ' + ctx.input.code + ' 自动生成',
});
const receivableId = typeof receivableCreated === 'string' ? receivableCreated : receivableCreated && (receivableCreated.id || (receivableCreated.record && receivableCreated.record.id));
if (!receivableId) throw new Error('应收账款创建后未返回记录ID');
const nextInvoicedQuantity = round4(Number(line.invoiced_quantity || 0) + requested);
await ctx.api.object('forge_sales_order_line').update({ id: line.id, invoiced_quantity: nextInvoicedQuantity });
await ctx.api.object('forge_sales_order').update({ id, invoiced_amount: nextInvoicedAmount });
if (order.contract_id) {
  const contract = await ctx.api.object('forge_sales_contract').findOne({ where: { id: order.contract_id } });
  if (contract) await ctx.api.object('forge_sales_contract').update({ id: contract.id, invoiced_amount: round4(Number(contract.invoiced_amount || 0) + total) });
}
return { id: invoiceId, receivable_id: receivableId, order_id: id, quantity: requested, total_amount: total, remaining_invoiceable_quantity: round4(invoiceable - requested) };
` },
});

export const PurchaseInboundRegisterInvoice = defineAction({
  name: 'purchase_inbound_register_invoice', label: '登记采购发票', objectName: 'forge_purchase_inbound', icon: 'receipt',
  locations: [...locations], order: 30, visible: `record.status == 'stocked'`, refreshAfter: true,
  description: '按本次采购入库数量和金额登记一张进项发票，并关联或生成应付账款。',
  successMessage: '进项发票已登记并关联应付账款',
  params: [
    { field: 'code', objectOverride: 'forge_purchase_invoice', required: true },
    { field: 'invoice_number', objectOverride: 'forge_purchase_invoice', required: true },
    { field: 'invoice_on', objectOverride: 'forge_purchase_invoice', required: true },
    { field: 'due_on', objectOverride: 'forge_purchase_invoice', required: true },
    { field: 'remarks', objectOverride: 'forge_purchase_invoice' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_purchase_invoice/record/${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inbound = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inbound) throw new Error('当前采购入库单不存在或不可访问');
if (inbound.status !== 'stocked') throw new Error('仅已入库采购单可以登记采购发票');
if (String(ctx.input.due_on) < String(ctx.input.invoice_on)) throw new Error('应付日期不得早于开票日期');
const existing = await ctx.api.object('forge_purchase_invoice').find({ where: { inbound_id: id } });
if (existing.some(item => item.status !== 'voided')) throw new Error('当前采购入库单已经登记有效进项发票');
const order = await ctx.api.object('forge_purchase_order').findOne({ where: { id: inbound.order_id } });
const line = await ctx.api.object('forge_purchase_order_line').findOne({ where: { id: inbound.order_line_id } });
if (!order || !line) throw new Error('采购入库单关联的采购订单或明细不存在');
const total = Number(inbound.inventory_amount || 0), quantity = Number(inbound.quantity || 0), unitPrice = Number(inbound.unit_cost || 0);
if (!(total > 0) || !(quantity > 0)) throw new Error('采购入库数量和金额必须大于0');
const created = await ctx.api.object('forge_purchase_invoice').insert({
  name: order.code + ' 进项发票 ' + ctx.input.invoice_number, code: ctx.input.code, invoice_number: ctx.input.invoice_number,
  inbound_id: id, order_id: order.id, supplier_id: order.supplier_id, invoice_on: ctx.input.invoice_on,
  due_on: ctx.input.due_on, total_amount: total, tax_rate: Number(line.tax_rate || 0), status: 'normal',
  responsible_id: order.responsible_id, remarks: ctx.input.remarks || ('由采购入库单 ' + inbound.code + ' 登记'),
});
const invoiceId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
if (!invoiceId) throw new Error('进项发票创建后未返回记录ID');
await ctx.api.object('forge_purchase_invoice_line').insert({
  name: line.name, invoice_id: invoiceId, inbound_id: id, order_id: order.id, order_line_id: line.id,
  sku_id: inbound.sku_id, item_code: inbound.item_code || line.item_code || null, quantity,
  taxed_unit_price: unitPrice, tax_rate: Number(line.tax_rate || 0), taxed_subtotal: total,
  remarks: ctx.input.remarks || null,
});
let payable = await ctx.api.object('forge_accounts_payable').findOne({ where: { inbound_id: id } });
let payableId = payable && payable.id;
if (payable) {
  await ctx.api.object('forge_accounts_payable').update({ id: payable.id, invoice_id: invoiceId, due_on: ctx.input.due_on });
} else {
  const createdPayable = await ctx.api.object('forge_accounts_payable').insert({
    name: order.code + ' 应付 ' + inbound.code, code: 'AP-' + inbound.code, source_type: 'purchase_invoice',
    inbound_id: id, invoice_id: invoiceId, order_id: order.id, supplier_id: order.supplier_id,
    recognized_on: ctx.input.invoice_on, due_on: ctx.input.due_on, original_amount: total,
    paid_amount: 0, offset_amount: 0, outstanding_amount: total, status: 'unpaid',
    responsible_id: order.responsible_id, remarks: '由进项发票 ' + ctx.input.invoice_number + ' 自动生成',
  });
  payableId = typeof createdPayable === 'string' ? createdPayable : createdPayable && (createdPayable.id || (createdPayable.record && createdPayable.record.id));
}
if (!payableId) throw new Error('应付账款关联后未返回记录ID');
return { id: invoiceId, payable_id: payableId, inbound_id: id, quantity, total_amount: total };
` },
});
