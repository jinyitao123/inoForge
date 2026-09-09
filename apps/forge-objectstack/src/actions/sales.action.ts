import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

const statusBody = (objectName: string, from: string, to: string) => ({
  language: 'js' as const,
  capabilities: ['api.write' as const],
  source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
if (ctx.recordLoadDenied === true || !id) throw new Error('当前记录不存在或不可访问');
if (!ctx.record || ctx.record.status !== '${from}') throw new Error('记录状态已变化，请刷新后重试');
await ctx.api.object('${objectName}').update({ id, status: '${to}' });
return { id, status: '${to}' };
`,
});

export const QuotationRecalculate = defineAction({
  name: 'quotation_recalculate', label: '重新计算金额', objectName: 'forge_quotation', icon: 'calculator',
  locations: ['record_more'], visible: `record.status == 'draft'`, refreshAfter: true,
  successMessage: '报价金额已按明细重新计算',
  body: {
    language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
if (ctx.recordLoadDenied === true || !id) throw new Error('当前报价不存在或不可访问');
const lines = await ctx.api.object('forge_quotation_line').find({ where: { quotation_id: id } });
if (!lines.length) throw new Error('报价至少需要一条明细');
let subtotal = 0, total = 0, tax = 0, cost = 0;
for (const line of lines) {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.taxed_unit_price || 0);
  const lineTotal = Number(line.taxed_subtotal || 0);
  const rate = Number(line.tax_rate || 0) / 100;
  subtotal += quantity * unitPrice;
  total += lineTotal;
  tax += rate > 0 ? lineTotal - lineTotal / (1 + rate) : 0;
  cost += quantity * Number(line.cost_price || 0);
}
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
await ctx.api.object('forge_quotation').update({ id,
  item_count: lines.length, subtotal: round4(subtotal), discount_amount: round4(subtotal - total),
  tax_amount: round4(tax), total_amount: round4(total), cost_total: round4(cost)
});
return { id, item_count: lines.length, total_amount: round4(total) };
`,
  },
});

export const QuotationSubmit = defineAction({
  name: 'quotation_submit', label: '提交审批', objectName: 'forge_quotation', icon: 'send', locations: [...locations], order: 10,
  visible: `record.status == 'draft'`, confirmText: '提交后报价将进入审批，是否继续？', refreshAfter: true,
  successMessage: '报价已提交审批', body: statusBody('forge_quotation', 'draft', 'pending_approval'),
});

export const QuotationApprove = defineAction({
  name: 'quotation_approve', label: '同意', objectName: 'forge_quotation', icon: 'circle-check', locations: [...locations], order: 10,
  visible: `record.status == 'pending_approval'`, confirmText: '确认同意这份报价？', refreshAfter: true,
  successMessage: '报价审批通过', body: statusBody('forge_quotation', 'pending_approval', 'approved'),
});

export const QuotationSend = defineAction({
  name: 'quotation_send', label: '发送给客户', objectName: 'forge_quotation', icon: 'mail', locations: [...locations], order: 10,
  visible: `record.status == 'approved'`, confirmText: '确认报价已发送给客户？', refreshAfter: true,
  successMessage: '报价已标记为已发送', body: statusBody('forge_quotation', 'approved', 'sent'),
});

export const QuotationAccept = defineAction({
  name: 'quotation_accept', label: '标记客户接受', objectName: 'forge_quotation', icon: 'handshake', locations: [...locations], order: 10,
  visible: `record.status == 'sent'`, confirmText: '确认客户已经接受这份报价？', refreshAfter: true,
  successMessage: '报价已成交', body: statusBody('forge_quotation', 'sent', 'accepted'),
});

export const QuotationConvertToContract = defineAction({
  name: 'quotation_convert_to_contract', label: '转为合同', objectName: 'forge_quotation', icon: 'scroll-text',
  locations: [...locations], order: 20, visible: `record.status == 'accepted'`, refreshAfter: true,
  description: '用已接受报价建立一份同客户、同价格和同数量的框架合同。', successMessage: '合同与合同明细已创建',
  params: [
    { field: 'contract_type_id', objectOverride: 'forge_sales_contract', required: true },
    { field: 'code', objectOverride: 'forge_sales_contract', required: true },
    { field: 'name', objectOverride: 'forge_sales_contract', required: true },
    { field: 'starts_on', objectOverride: 'forge_sales_contract', required: true },
    { field: 'ends_on', objectOverride: 'forge_sales_contract', required: true },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_sales_contract/record/${result.id}' },
  body: {
    language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
const quote = ctx.record;
if (ctx.recordLoadDenied === true || !id || !quote) throw new Error('当前报价不存在或不可访问');
if (quote.status !== 'accepted') throw new Error('仅已接受报价可以转为合同');
const existing = await ctx.api.object('forge_sales_contract').find({ where: { quotation_id: id } });
if (existing.length) throw new Error('该报价已转换为合同');
const lines = await ctx.api.object('forge_quotation_line').find({ where: { quotation_id: id } });
if (!lines.length) throw new Error('报价至少需要一条明细');
let contractId = null;
await ctx.api.transaction(async () => {
  const created = await ctx.api.object('forge_sales_contract').insert({
    name: ctx.input.name, code: ctx.input.code, contract_type_id: ctx.input.contract_type_id,
    customer_id: quote.customer_id, contact_id: quote.contact_id || null, quotation_id: id,
    signed_on: ctx.input.starts_on, starts_on: ctx.input.starts_on, ends_on: ctx.input.ends_on,
    responsible_id: quote.responsible_id, total_amount: Number(quote.total_amount || 0),
    has_order_amount_limit: true, order_amount_limit: Number(quote.total_amount || 0),
    outside_item_requires_approval: true, revenue_trigger: 'shipment',
    business_terms: quote.business_terms || null, remarks: '由报价 ' + quote.code + ' 转换生成',
  });
  contractId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
  if (!contractId) throw new Error('合同创建后未返回记录ID');
  for (const line of lines) {
    await ctx.api.object('forge_sales_contract_line').insert({
      name: line.name, contract_id: contractId, quotation_line_id: line.id, sku_id: line.sku_id,
      item_code: line.item_code || null, model: line.model || null, specification: line.specification || null,
      unit_name: line.unit_name || null, quantity_limit: Number(line.quantity || 0), ordered_quantity: 0,
      taxed_unit_price: Number(line.taxed_unit_price || 0), tax_rate: Number(line.tax_rate || 0),
      discount_rate: Number(line.discount_rate || 0), taxed_subtotal: Number(line.taxed_subtotal || 0),
      remarks: line.remarks || null,
    });
  }
});
return { id: contractId, quotation_id: id, line_count: lines.length };
`,
  },
});

export const ContractSubmit = defineAction({
  name: 'contract_submit', label: '提交审批', objectName: 'forge_sales_contract', icon: 'send', locations: [...locations], order: 10,
  visible: `record.status == 'draft'`, confirmText: '提交前将校验来源报价和合同金额，是否继续？', refreshAfter: true,
  successMessage: '合同已提交审批',
  body: {
    language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
if (ctx.recordLoadDenied === true || !id) throw new Error('当前合同不存在或不可访问');
const record = ctx.record;
if (!record || record.status !== 'draft') throw new Error('合同状态已变化，请刷新后重试');
if (record.quotation_id) {
  const quote = await ctx.api.object('forge_quotation').findOne({ where: { id: record.quotation_id } });
  if (!quote || quote.status !== 'accepted') throw new Error('来源报价需为已接受状态');
}
const lines = await ctx.api.object('forge_sales_contract_line').find({ where: { contract_id: id } });
if (!lines.length) throw new Error('合同至少需要一条物料明细');
const total = Math.round(lines.reduce((sum, line) => sum + Number(line.taxed_subtotal || 0), 0) * 10000) / 10000;
await ctx.api.object('forge_sales_contract').update({ id, total_amount: total, status: 'pending_approval' });
return { id, total_amount: total, status: 'pending_approval' };
`,
  },
});

export const ContractApprove = defineAction({
  name: 'contract_approve', label: '同意', objectName: 'forge_sales_contract', icon: 'circle-check', locations: [...locations], order: 10,
  visible: `record.status == 'pending_approval'`, confirmText: '确认同意并开始执行这份合同？', refreshAfter: true,
  successMessage: '合同审批通过，已进入执行中', body: statusBody('forge_sales_contract', 'pending_approval', 'active'),
});

export const SalesOrderSubmit = defineAction({
  name: 'sales_order_submit', label: '提交审批', objectName: 'forge_sales_order', icon: 'send', locations: [...locations], order: 10,
  visible: `record.status == 'draft'`, confirmText: '提交前将校验合同额度和物料数量，是否继续？', refreshAfter: true,
  successMessage: '销售订单已提交审批',
  body: {
    language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
if (ctx.recordLoadDenied === true || !id) throw new Error('当前订单不存在或不可访问');
const record = ctx.record;
if (!record || record.status !== 'draft') throw new Error('订单状态已变化，请刷新后重试');
const lines = await ctx.api.object('forge_sales_order_line').find({ where: { order_id: id } });
if (!lines.length) throw new Error('订单至少需要一条物料明细');
const total = Math.round(lines.reduce((sum, line) => sum + Number(line.taxed_subtotal || 0), 0) * 10000) / 10000;
if (record.source_type === 'contract') {
  if (!record.contract_id) throw new Error('关联合同订单必须选择合同');
  const contract = await ctx.api.object('forge_sales_contract').findOne({ where: { id: record.contract_id } });
  if (!contract || contract.status !== 'active') throw new Error('关联合同需为执行中状态');
  if (contract.has_order_amount_limit && Number(contract.ordered_amount || 0) + total > Number(contract.order_amount_limit || 0)) {
    throw new Error('订单金额超过合同剩余额度');
  }
  const contractLines = await ctx.api.object('forge_sales_contract_line').find({ where: { contract_id: record.contract_id } });
  const limits = new Map(contractLines.map(line => [line.id, line]));
  for (const line of lines) {
    const contractLine = limits.get(line.contract_line_id);
    if (!contractLine) throw new Error('订单明细必须来自当前合同清单');
    if (Number(contractLine.ordered_quantity || 0) + Number(line.quantity || 0) > Number(contractLine.quantity_limit || 0)) {
      throw new Error('订单物料数量超过合同剩余数量');
    }
  }
}
await ctx.api.object('forge_sales_order').update({ id, total_amount: total, status: 'pending_approval' });
return { id, total_amount: total, status: 'pending_approval' };
`,
  },
});

export const SalesOrderApprove = defineAction({
  name: 'sales_order_approve', label: '同意', objectName: 'forge_sales_order', icon: 'circle-check', locations: [...locations], order: 10,
  visible: `record.status == 'pending_approval'`, confirmText: '确认同意并开始执行这张订单？', refreshAfter: true,
  successMessage: '订单审批通过，合同执行进度已更新',
  body: {
    language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
if (ctx.recordLoadDenied === true || !id) throw new Error('当前订单不存在或不可访问');
const record = ctx.record;
if (!record || record.status !== 'pending_approval') throw new Error('订单状态已变化，请刷新后重试');
await ctx.api.transaction(async () => {
  await ctx.api.object('forge_sales_order').update({ id, status: 'active' });
  if (!record.contract_id) return;
  const orders = await ctx.api.object('forge_sales_order').find({ where: { contract_id: record.contract_id } });
  const activeOrders = orders.filter(order => ['approved', 'active', 'partially_shipped', 'shipped', 'completed'].includes(order.status));
  const orderedAmount = Math.round(activeOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) * 10000) / 10000;
  const quantities = new Map();
  for (const order of activeOrders) {
    const orderLines = await ctx.api.object('forge_sales_order_line').find({ where: { order_id: order.id } });
    for (const line of orderLines) {
      if (!line.contract_line_id) continue;
      quantities.set(line.contract_line_id, Number(quantities.get(line.contract_line_id) || 0) + Number(line.quantity || 0));
    }
  }
  const contractLines = await ctx.api.object('forge_sales_contract_line').find({ where: { contract_id: record.contract_id } });
  for (const line of contractLines) {
    await ctx.api.object('forge_sales_contract_line').update({ id: line.id, ordered_quantity: Number(quantities.get(line.id) || 0) });
  }
  await ctx.api.object('forge_sales_contract').update({ id: record.contract_id,
    ordered_count: activeOrders.length, ordered_amount: orderedAmount, status: 'active'
  });
});
return { id, status: 'active', contract_id: record.contract_id || null };
`,
  },
});

export const SalesOrderCreateShipment = defineAction({
  name: 'sales_order_create_shipment', label: '创建发货单', objectName: 'forge_sales_order', icon: 'package-check',
  locations: [...locations], order: 20, visible: `record.status == 'active' || record.status == 'partially_shipped'`, refreshAfter: true,
  description: '从执行中订单创建一张分批发货计划；建单不会改变库存或已发货数量。', successMessage: '发货单与发货明细已创建',
  params: [
    { field: 'code', objectOverride: 'forge_sales_shipment', required: true },
    { field: 'shipment_on', objectOverride: 'forge_sales_shipment', required: true },
    { field: 'recipient', objectOverride: 'forge_sales_shipment', required: true },
    { field: 'recipient_phone', objectOverride: 'forge_sales_shipment' },
    { field: 'delivery_address', objectOverride: 'forge_sales_shipment', required: true },
    { field: 'quantity', objectOverride: 'forge_sales_shipment_line', required: true },
    { field: 'remarks', objectOverride: 'forge_sales_shipment' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_sales_shipment/record/${result.id}' },
  body: {
    language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前订单不存在或不可访问');
if (!['active', 'partially_shipped'].includes(order.status)) throw new Error('仅执行中或部分发货订单可以创建发货单');
const orderLines = await ctx.api.object('forge_sales_order_line').find({ where: { order_id: id } });
if (orderLines.length !== 1) throw new Error('当前切片仅支持单条物料明细订单分批建单');
const orderLine = orderLines[0];
const requested = Number(ctx.input.quantity || 0);
if (!(requested > 0)) throw new Error('本次发货数量必须大于0');
const existingLines = await ctx.api.object('forge_sales_shipment_line').find({ where: { order_line_id: orderLine.id } });
let plannedQuantity = 0, plannedAmount = 0;
const activeShipmentIds = new Set();
for (const line of existingLines) {
  const shipment = await ctx.api.object('forge_sales_shipment').findOne({ where: { id: line.shipment_id } });
  if (!shipment || shipment.status === 'cancelled') continue;
  plannedQuantity += Number(line.quantity || 0);
  plannedAmount += Number(line.taxed_subtotal || 0);
  activeShipmentIds.add(shipment.id);
}
const remaining = Number(orderLine.quantity || 0) - plannedQuantity;
if (requested > remaining) throw new Error('本次发货数量超过订单未建单数量');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const lineAmount = round4(Number(orderLine.taxed_unit_price || 0) * requested);
let shipmentId = null;
const created = await ctx.api.object('forge_sales_shipment').insert({
    name: order.code + ' 发货 ' + ctx.input.code, code: ctx.input.code, customer_id: order.customer_id,
    contact_id: order.contact_id || null, shipment_on: ctx.input.shipment_on,
    recipient: ctx.input.recipient, recipient_phone: ctx.input.recipient_phone || null,
    delivery_address: ctx.input.delivery_address, total_amount: lineAmount, total_quantity: requested,
    outbound_quantity: 0, outbound_count: 0, responsible_id: order.responsible_id,
    remarks: ctx.input.remarks || ('由销售订单 ' + order.code + ' 创建'),
});

shipmentId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
if (!shipmentId) throw new Error('发货单创建后未返回记录ID');
await ctx.api.object('forge_sales_shipment_line').insert({
    name: orderLine.name, shipment_id: shipmentId, order_id: id, order_line_id: orderLine.id,
    sku_id: orderLine.sku_id, item_code: orderLine.item_code || null, model: orderLine.model || null,
    specification: orderLine.specification || null, unit_name: orderLine.unit_name || null,
    quantity: requested, outbound_quantity: 0, taxed_unit_price: Number(orderLine.taxed_unit_price || 0),
    taxed_subtotal: lineAmount, remarks: orderLine.remarks || null,
});

await ctx.api.object('forge_sales_order').update({ id,
  shipment_count: activeShipmentIds.size + 1, planned_shipment_amount: round4(plannedAmount + lineAmount)
});
return { id: shipmentId, order_id: id, quantity: requested, total_amount: lineAmount, remaining_quantity: round4(remaining - requested) };
`,
  },
});

export const SalesShipmentCreateOutbound = defineAction({
  name: 'sales_shipment_create_outbound', label: '确认发货', objectName: 'forge_sales_shipment', icon: 'truck',
  locations: [...locations], order: 20, visible: `record.status == 'pending_shipment' || record.status == 'partially_outbounded'`, refreshAfter: true,
  description: '校验可用库存后创建出库单，并回写发货单、订单的出库进度。', successMessage: '出库单已创建，发货进度已更新',
  params: [
    { field: 'code', objectOverride: 'forge_sales_outbound', required: true }, { field: 'warehouse_id', objectOverride: 'forge_sales_outbound', required: true },
    { field: 'outbound_on', objectOverride: 'forge_sales_outbound', required: true }, { field: 'quantity', objectOverride: 'forge_sales_outbound', required: true },
    { field: 'customer_pickup', objectOverride: 'forge_sales_outbound' },
    { field: 'remarks', objectOverride: 'forge_sales_outbound' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_sales_outbound/record/${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const shipment = ctx.record;
if (ctx.recordLoadDenied === true || !id || !shipment) throw new Error('当前发货单不存在或不可访问');
if (!['pending_shipment', 'partially_outbounded'].includes(shipment.status)) throw new Error('发货单状态已变化，请刷新后重试');
const lines = await ctx.api.object('forge_sales_shipment_line').find({ where: { shipment_id: id } }); if (lines.length !== 1) throw new Error('当前切片仅支持单条物料明细发货单');
const line = lines[0], quantity = Number(ctx.input.quantity || 0), already = Number(shipment.outbound_quantity || 0);
if (!(quantity > 0)) throw new Error('本次出库数量必须大于0'); if (quantity + already > Number(shipment.total_quantity || 0)) throw new Error('本次出库数量超过发货单剩余数量');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const balanceKey = ctx.input.warehouse_id + ':' + line.sku_id;
const balances = await ctx.api.object('forge_inventory_balance').find({ where: { balance_key: balanceKey } });
if (balances.length > 1) throw new Error('同一仓库和物料存在重复库存余额');
if (!balances.length) throw new Error('出库仓库没有该物料的库存余额');
const balance = balances[0], available = Number(balance.available_quantity || 0), beforeOnHand = Number(balance.on_hand_quantity || 0), reserved = Number(balance.reserved_quantity || 0), unitCost = Number(balance.average_cost || 0), beforeValue = Number(balance.inventory_value || 0);
if (quantity > available || quantity > beforeOnHand) throw new Error('可用库存不足，无法创建出库单');
const afterOnHand = round4(beforeOnHand - quantity), afterAvailable = round4(available - quantity), inventoryAmount = round4(quantity * unitCost), afterValue = Math.max(0, round4(beforeValue - inventoryAmount));
const nextStatus = quantity + already >= Number(shipment.total_quantity || 0) ? 'outbounded' : 'partially_outbounded';
const created = await ctx.api.object('forge_sales_outbound').insert({ name: shipment.name + ' 出库 ' + ctx.input.code, code: ctx.input.code, shipment_id: id, order_id: line.order_id, warehouse_id: ctx.input.warehouse_id, sku_id: line.sku_id, outbound_on: ctx.input.outbound_on, quantity, customer_pickup: Boolean(ctx.input.customer_pickup), recipient: shipment.recipient, recipient_phone: shipment.recipient_phone || null, delivery_address: shipment.delivery_address, available_quantity: available, before_on_hand: beforeOnHand, after_on_hand: afterOnHand, unit_cost: unitCost, inventory_amount: inventoryAmount, status: 'outbounded', responsible_id: shipment.responsible_id, remarks: ctx.input.remarks || ('由发货单 ' + shipment.code + ' 创建') });
const outboundId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id)); if (!outboundId) throw new Error('出库单创建后未返回记录ID');
const occurredAt = new Date().toISOString();
await ctx.api.object('forge_inventory_balance').update({ id: balance.id, on_hand_quantity: afterOnHand, reserved_quantity: reserved, available_quantity: afterAvailable, average_cost: unitCost, inventory_value: afterValue, last_movement_at: occurredAt });
await ctx.api.object('forge_inventory_ledger').insert({ name: ctx.input.code + ' ' + line.name + ' 出库', code: ctx.input.code + '-001', warehouse_id: ctx.input.warehouse_id, sku_id: line.sku_id, direction: 'outbound', movement_type: 'sales_outbound', quantity, before_on_hand: beforeOnHand, after_on_hand: afterOnHand, before_available: available, after_available: afterAvailable, unit_cost: unitCost, amount: inventoryAmount, occurred_at: occurredAt, source_object: 'forge_sales_outbound', source_id: outboundId, source_line_id: line.id, responsible_id: shipment.responsible_id, remarks: ctx.input.remarks || ('由发货单 ' + shipment.code + ' 创建') });
const order = await ctx.api.object('forge_sales_order').findOne({ where: { id: line.order_id } }); const orderLines = await ctx.api.object('forge_sales_order_line').find({ where: { order_id: line.order_id } });
const orderLine = orderLines.find(item => item.id === line.order_line_id); if (!orderLine) throw new Error('发货单关联的销售订单明细不存在');
const shipped = Number(orderLines.reduce((sum, item) => sum + Number(item.shipped_quantity || 0), 0)) + quantity;
await ctx.api.object('forge_sales_shipment').update({ id, outbound_quantity: already + quantity, outbound_count: Number(shipment.outbound_count || 0) + 1, status: nextStatus }); await ctx.api.object('forge_sales_shipment_line').update({ id: line.id, outbound_quantity: Number(line.outbound_quantity || 0) + quantity }); await ctx.api.object('forge_sales_order_line').update({ id: line.order_line_id, shipped_quantity: Number(orderLine.shipped_quantity || 0) + quantity });
if (order) await ctx.api.object('forge_sales_order').update({ id: order.id, shipped_amount: Number(order.shipped_amount || 0) + quantity * Number(line.taxed_unit_price || 0), status: shipped >= Number(orderLines.reduce((sum, item) => sum + Number(item.quantity || 0), 0)) ? 'shipped' : 'partially_shipped' });
return { id: outboundId, shipment_id: id, quantity, status: nextStatus };
` },
});

export const ContractConvertToSalesOrder = defineAction({
  name: 'contract_convert_to_sales_order', label: '创建销售订单', objectName: 'forge_sales_contract', icon: 'clipboard-list',
  locations: [...locations], order: 20, visible: `record.status == 'active'`, refreshAfter: true,
  description: '按合同当前未下单数量建立销售订单。', successMessage: '销售订单与订单明细已创建',
  params: [
    { field: 'code', objectOverride: 'forge_sales_order', required: true },
    { field: 'name', objectOverride: 'forge_sales_order', required: true },
    { field: 'planned_delivery_on', objectOverride: 'forge_sales_order', required: true },
    { field: 'payment_term', objectOverride: 'forge_sales_order', required: true },
    { field: 'payment_method', objectOverride: 'forge_sales_order', required: true, defaultValue: 'bank_transfer' },
    { field: 'delivery_address', objectOverride: 'forge_sales_order' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_sales_order/record/${result.id}' },
  body: {
    language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id);
const contract = ctx.record;
if (ctx.recordLoadDenied === true || !id || !contract) throw new Error('当前合同不存在或不可访问');
if (contract.status !== 'active') throw new Error('仅执行中合同可以创建销售订单');
const existing = await ctx.api.object('forge_sales_order').find({ where: { contract_id: id } });
if (existing.some(order => order.status !== 'cancelled')) throw new Error('该合同已有未取消的销售订单');
const lines = await ctx.api.object('forge_sales_contract_line').find({ where: { contract_id: id } });
const remaining = lines.map(line => ({ line, quantity: Number(line.quantity_limit || 0) - Number(line.ordered_quantity || 0) }))
  .filter(item => item.quantity > 0);
if (!remaining.length) throw new Error('合同没有可下单的剩余数量');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
let orderId = null;
let total = 0;
for (const item of remaining) total += Number(item.line.taxed_subtotal || 0) * item.quantity / Number(item.line.quantity_limit || 1);
total = round4(total);
await ctx.api.transaction(async () => {
  const created = await ctx.api.object('forge_sales_order').insert({
    name: ctx.input.name, code: ctx.input.code, source_type: 'contract', customer_id: contract.customer_id,
    contact_id: contract.contact_id || null, contract_id: id, quotation_id: contract.quotation_id || null,
    planned_delivery_on: ctx.input.planned_delivery_on, responsible_id: contract.responsible_id,
    payment_term: ctx.input.payment_term, payment_method: ctx.input.payment_method,
    revenue_trigger: contract.revenue_trigger || 'shipment', total_amount: total,
    delivery_address: ctx.input.delivery_address || null, remarks: '由合同 ' + contract.code + ' 转换生成',
  });
  orderId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
  if (!orderId) throw new Error('订单创建后未返回记录ID');
  for (const item of remaining) {
    const line = item.line;
    const lineTotal = round4(Number(line.taxed_subtotal || 0) * item.quantity / Number(line.quantity_limit || 1));
    const rate = Number(line.tax_rate || 0) / 100;
    await ctx.api.object('forge_sales_order_line').insert({
      name: line.name, order_id: orderId, contract_line_id: line.id, quotation_line_id: line.quotation_line_id || null,
      sku_id: line.sku_id, item_code: line.item_code || null, model: line.model || null,
      specification: line.specification || null, unit_name: line.unit_name || null, quantity: item.quantity,
      shipped_quantity: 0, invoiced_quantity: 0, taxed_unit_price: Number(line.taxed_unit_price || 0),
      untaxed_unit_price: rate > 0 ? round4(Number(line.taxed_unit_price || 0) / (1 + rate)) : Number(line.taxed_unit_price || 0),
      tax_rate: Number(line.tax_rate || 0), discount_rate: Number(line.discount_rate || 0),
      taxed_subtotal: lineTotal, planned_delivery_on: ctx.input.planned_delivery_on, remarks: line.remarks || null,
    });
  }
});
return { id: orderId, contract_id: id, line_count: remaining.length, total_amount: total };
`,
  },
});
