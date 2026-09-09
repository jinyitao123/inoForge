import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

export const PurchaseOrderSubmit = defineAction({
  name: 'purchase_order_submit', label: '提交审核', objectName: 'forge_purchase_order', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft'`, refreshAfter: true,
  confirmText: '提交前将校验供应商、付款条件、交期与采购明细，是否继续？', successMessage: '采购订单已提交审核',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前采购订单不存在或不可访问');
if (order.status !== 'draft') throw new Error('采购订单状态已变化，请刷新后重试');
const supplier = await ctx.api.object('forge_supplier').findOne({ where: { id: order.supplier_id } });
if (!supplier || supplier.status !== 'active') throw new Error('供应商必须处于启用状态');
const lines = await ctx.api.object('forge_purchase_order_line').find({ where: { order_id: id } });
if (!lines.length) throw new Error('采购订单至少需要一条物料明细');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
for (const line of lines) if (!(Number(line.quantity || 0) > 0)) throw new Error('采购数量必须大于0');
const totalQuantity = round4(lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0));
const totalAmount = round4(lines.reduce((sum, line) => sum + Number(line.taxed_subtotal || 0), 0));
await ctx.api.object('forge_purchase_order').update({ id, line_count: lines.length, total_quantity: totalQuantity, total_amount: totalAmount, status: 'pending_approval' });
return { id, status: 'pending_approval', line_count: lines.length, total_quantity: totalQuantity, total_amount: totalAmount };
` },
});

export const PurchaseOrderApprove = defineAction({
  name: 'purchase_order_approve', label: '同意', objectName: 'forge_purchase_order', icon: 'circle-check',
  locations: [...locations], order: 10, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  confirmText: '审批通过后将按订单明细生成待到货通知，是否继续？', successMessage: '采购订单已审批并生成到货通知',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前采购订单不存在或不可访问');
if (order.status !== 'pending_approval') throw new Error('采购订单状态已变化，请刷新后重试');
const lines = await ctx.api.object('forge_purchase_order_line').find({ where: { order_id: id } });
if (!lines.length) throw new Error('采购订单至少需要一条物料明细');
let noticeCount = 0;
for (let index = 0; index < lines.length; index++) {
  const line = lines[index];
  const existing = await ctx.api.object('forge_purchase_arrival_notice').findOne({ where: { order_line_id: line.id } });
  if (existing && existing.status !== 'cancelled') { noticeCount++; continue; }
  await ctx.api.object('forge_purchase_arrival_notice').insert({
    name: order.code + ' 到货通知 ' + String(index + 1), code: order.code + '-AN-' + String(index + 1).padStart(3, '0'),
    order_id: id, order_line_id: line.id, supplier_id: order.supplier_id, warehouse_id: order.warehouse_id,
    sku_id: line.sku_id, item_code: line.item_code || null,
    expected_arrival_on: line.expected_arrival_on || order.expected_arrival_on,
    planned_quantity: Number(line.quantity || 0), arrived_quantity: 0, responsible_id: order.responsible_id,
    remarks: '由采购订单 ' + order.code + ' 审批生成；实际到货、检验和入库另行登记。',
  });
  noticeCount++;
}
await ctx.api.object('forge_purchase_order').update({ id, status: 'approved' });
return { id, status: 'approved', arrival_notice_count: noticeCount };
` },
});

export const PurchaseArrivalRegister = defineAction({
  name: 'purchase_arrival_register', label: '登记到货', objectName: 'forge_purchase_arrival_notice', icon: 'package-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_arrival' || record.status == 'partially_arrived'`, refreshAfter: true,
  description: '登记本次实际到货数量，并生成一张待检验单。', successMessage: '到货已登记，物料进入待检验',
  params: [
    { field: 'code', objectOverride: 'forge_purchase_receipt', required: true },
    { field: 'arrived_on', objectOverride: 'forge_purchase_receipt', required: true },
    { field: 'quantity', objectOverride: 'forge_purchase_receipt', required: true },
    { field: 'batch_number', objectOverride: 'forge_purchase_receipt' },
    { field: 'remarks', objectOverride: 'forge_purchase_receipt' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_purchase_receipt/record/${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const notice = ctx.record;
if (ctx.recordLoadDenied === true || !id || !notice) throw new Error('当前到货通知不存在或不可访问');
if (!['pending_arrival', 'partially_arrived'].includes(notice.status)) throw new Error('到货通知状态已变化，请刷新后重试');
const quantity = Number(ctx.input.quantity || 0), planned = Number(notice.planned_quantity || 0), arrived = Number(notice.arrived_quantity || 0);
if (!(quantity > 0)) throw new Error('本次到货数量必须大于0');
if (arrived + quantity > planned) throw new Error('本次到货数量超过通知剩余数量');
const line = await ctx.api.object('forge_purchase_order_line').findOne({ where: { id: notice.order_line_id } });
const order = await ctx.api.object('forge_purchase_order').findOne({ where: { id: notice.order_id } });
if (!line || !order) throw new Error('到货通知关联的采购订单或明细不存在');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const unitCost = Number(line.taxed_unit_price || 0), amount = round4(quantity * unitCost);
const created = await ctx.api.object('forge_purchase_receipt').insert({
  name: notice.name + ' 到货 ' + ctx.input.code, code: ctx.input.code, notice_id: id, order_id: notice.order_id,
  order_line_id: notice.order_line_id, supplier_id: notice.supplier_id, warehouse_id: notice.warehouse_id,
  sku_id: notice.sku_id, item_code: notice.item_code || line.item_code || null, arrived_on: ctx.input.arrived_on,
  quantity, batch_number: ctx.input.batch_number || null, taxed_unit_price: unitCost, taxed_amount: amount,
  status: 'pending_inspection', responsible_id: notice.responsible_id, remarks: ctx.input.remarks || ('由到货通知 ' + notice.code + ' 登记'),
});
const receiptId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
if (!receiptId) throw new Error('到货登记创建后未返回记录ID');
const inspection = await ctx.api.object('forge_purchase_inspection').insert({
  name: ctx.input.code + ' ' + line.name + ' 来料检验', code: ctx.input.code + '-IQC', receipt_id: receiptId,
  order_id: notice.order_id, order_line_id: notice.order_line_id, supplier_id: notice.supplier_id, warehouse_id: notice.warehouse_id,
  sku_id: notice.sku_id, inspection_method: 'full', total_quantity: quantity, accepted_quantity: 0, rejected_quantity: 0,
  result: 'pending', status: 'pending', inspector_id: notice.responsible_id, remarks: '由到货登记自动生成；检验规则待 RISEMAP 同输入复核。',
});
const inspectionId = typeof inspection === 'string' ? inspection : inspection && (inspection.id || (inspection.record && inspection.record.id));
const nextArrived = round4(arrived + quantity), lineArrived = round4(Number(line.arrived_quantity || 0) + quantity), orderArrived = round4(Number(order.arrived_quantity || 0) + quantity);
await ctx.api.object('forge_purchase_arrival_notice').update({ id, arrived_quantity: nextArrived, status: nextArrived >= planned ? 'arrived' : 'partially_arrived' });
await ctx.api.object('forge_purchase_order_line').update({ id: line.id, arrived_quantity: lineArrived });
await ctx.api.object('forge_purchase_order').update({ id: order.id, arrived_quantity: orderArrived, status: 'partially_arrived' });
return { id: receiptId, inspection_id: inspectionId, quantity, notice_status: nextArrived >= planned ? 'arrived' : 'partially_arrived' };
` },
});

export const PurchaseInspectionComplete = defineAction({
  name: 'purchase_inspection_complete', label: '完成检验', objectName: 'forge_purchase_inspection', icon: 'clipboard-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending'`, refreshAfter: true,
  description: '登记合格数量，不合格数量由到货总数自动计算。', successMessage: '检验已完成',
  params: [
    { field: 'inspected_on', objectOverride: 'forge_purchase_inspection', required: true },
    { field: 'accepted_quantity', objectOverride: 'forge_purchase_inspection', required: true },
    { field: 'inspection_note', objectOverride: 'forge_purchase_inspection', required: true },
  ],
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inspection = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inspection) throw new Error('当前检验单不存在或不可访问');
if (inspection.status !== 'pending') throw new Error('检验单状态已变化，请刷新后重试');
const total = Number(inspection.total_quantity || 0), accepted = Number(ctx.input.accepted_quantity);
if (!Number.isFinite(accepted) || accepted < 0 || accepted > total) throw new Error('合格数量必须在0和到货总数之间');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const rejected = round4(total - accepted), result = accepted === total ? 'passed' : accepted > 0 ? 'partial' : 'rejected';
const line = await ctx.api.object('forge_purchase_order_line').findOne({ where: { id: inspection.order_line_id } });
if (!line) throw new Error('检验单关联的采购订单明细不存在');
await ctx.api.object('forge_purchase_inspection').update({ id, accepted_quantity: accepted, rejected_quantity: rejected, inspected_on: ctx.input.inspected_on, result, status: 'completed', inspection_note: ctx.input.inspection_note });
await ctx.api.object('forge_purchase_receipt').update({ id: inspection.receipt_id, status: 'inspected' });
await ctx.api.object('forge_purchase_order_line').update({ id: line.id, inspected_quantity: round4(Number(line.inspected_quantity || 0) + total), accepted_quantity: round4(Number(line.accepted_quantity || 0) + accepted) });
return { id, status: 'completed', result, accepted_quantity: accepted, rejected_quantity: rejected };
` },
});

export const PurchaseInspectionCreateInbound = defineAction({
  name: 'purchase_inspection_create_inbound', label: '采购入库', objectName: 'forge_purchase_inspection', icon: 'package-plus',
  locations: [...locations], order: 30, visible: `record.status == 'completed' && record.accepted_quantity > 0`, refreshAfter: true,
  description: '把本检验单合格数量入库，更新库存余额并生成来源流水。', successMessage: '采购入库完成，库存已更新',
  params: [
    { field: 'code', objectOverride: 'forge_purchase_inbound', required: true },
    { field: 'inbound_on', objectOverride: 'forge_purchase_inbound', required: true },
    { field: 'remarks', objectOverride: 'forge_purchase_inbound' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/forge_purchase_inbound/record/${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inspection = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inspection) throw new Error('当前检验单不存在或不可访问');
if (inspection.status !== 'completed' || !(Number(inspection.accepted_quantity || 0) > 0)) throw new Error('仅已完成且有合格数量的检验单可以入库');
const existing = await ctx.api.object('forge_purchase_inbound').find({ where: { inspection_id: id } });
if (existing.some(item => item.status !== 'cancelled')) throw new Error('当前检验单已经生成采购入库单');
const receipt = await ctx.api.object('forge_purchase_receipt').findOne({ where: { id: inspection.receipt_id } });
const line = await ctx.api.object('forge_purchase_order_line').findOne({ where: { id: inspection.order_line_id } });
const order = await ctx.api.object('forge_purchase_order').findOne({ where: { id: inspection.order_id } });
if (!receipt || !line || !order) throw new Error('检验单关联的到货登记、采购订单或明细不存在');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const quantity = Number(inspection.accepted_quantity || 0), unitCost = Number(receipt.taxed_unit_price || line.taxed_unit_price || 0), amount = round4(quantity * unitCost);
const balanceKey = inspection.warehouse_id + ':' + inspection.sku_id;
const balances = await ctx.api.object('forge_inventory_balance').find({ where: { balance_key: balanceKey } });
if (balances.length > 1) throw new Error('同一仓库和物料存在重复库存余额');
const balance = balances[0] || null, beforeOnHand = Number(balance && balance.on_hand_quantity || 0), reserved = Number(balance && balance.reserved_quantity || 0), beforeAvailable = Number(balance && balance.available_quantity || 0), beforeValue = Number(balance && balance.inventory_value || 0);
const afterOnHand = round4(beforeOnHand + quantity), afterAvailable = round4(afterOnHand - reserved), afterValue = round4(beforeValue + amount), averageCost = afterOnHand > 0 ? round4(afterValue / afterOnHand) : 0;
const created = await ctx.api.object('forge_purchase_inbound').insert({
  name: order.name + ' 入库 ' + ctx.input.code, code: ctx.input.code, receipt_id: receipt.id, inspection_id: id,
  order_id: order.id, order_line_id: line.id, supplier_id: order.supplier_id, warehouse_id: inspection.warehouse_id,
  sku_id: inspection.sku_id, item_code: line.item_code || null, batch_number: receipt.batch_number || null, inbound_on: ctx.input.inbound_on,
  quantity, unit_cost: unitCost, inventory_amount: amount, before_on_hand: beforeOnHand, after_on_hand: afterOnHand,
  status: 'stocked', responsible_id: order.responsible_id, remarks: ctx.input.remarks || ('由检验单 ' + inspection.code + ' 创建'),
});
const inboundId = typeof created === 'string' ? created : created && (created.id || (created.record && created.record.id));
if (!inboundId) throw new Error('采购入库单创建后未返回记录ID');
const occurredAt = new Date().toISOString();
if (balance) await ctx.api.object('forge_inventory_balance').update({ id: balance.id, on_hand_quantity: afterOnHand, reserved_quantity: reserved, available_quantity: afterAvailable, average_cost: averageCost, inventory_value: afterValue, last_movement_at: occurredAt });
else await ctx.api.object('forge_inventory_balance').insert({ name: ctx.input.code + ' ' + line.name, balance_key: balanceKey, warehouse_id: inspection.warehouse_id, sku_id: inspection.sku_id, on_hand_quantity: afterOnHand, reserved_quantity: 0, available_quantity: afterAvailable, average_cost: averageCost, inventory_value: afterValue, last_movement_at: occurredAt, remarks: '由采购入库建立' });
await ctx.api.object('forge_inventory_ledger').insert({ name: ctx.input.code + ' ' + line.name + ' 入库', code: ctx.input.code + '-001', warehouse_id: inspection.warehouse_id, sku_id: inspection.sku_id, direction: 'inbound', movement_type: 'purchase_inbound', quantity, before_on_hand: beforeOnHand, after_on_hand: afterOnHand, before_available: beforeAvailable, after_available: afterAvailable, unit_cost: unitCost, amount, occurred_at: occurredAt, source_object: 'forge_purchase_inbound', source_id: inboundId, source_line_id: line.id, responsible_id: order.responsible_id, remarks: ctx.input.remarks || ('由检验单 ' + inspection.code + ' 创建') });
let payableId = null;
if (order.payable_trigger === 'inbound') {
  const payableCreated = await ctx.api.object('forge_accounts_payable').insert({
    name: order.code + ' 应付 ' + ctx.input.code, code: 'AP-' + ctx.input.code, source_type: 'purchase_inbound',
    inbound_id: inboundId, invoice_id: null, order_id: order.id, supplier_id: order.supplier_id,
    recognized_on: ctx.input.inbound_on, due_on: null, original_amount: amount, paid_amount: 0, offset_amount: 0,
    outstanding_amount: amount, status: 'unpaid', responsible_id: order.responsible_id,
    remarks: '由采购入库单 ' + ctx.input.code + ' 自动确认；应付日期待发票登记。',
  });
  payableId = typeof payableCreated === 'string' ? payableCreated : payableCreated && (payableCreated.id || (payableCreated.record && payableCreated.record.id));
  if (!payableId) throw new Error('采购入库确认应付后未返回记录ID');
}
const lineInbound = round4(Number(line.inbound_quantity || 0) + quantity), orderInbound = round4(Number(order.inbound_quantity || 0) + quantity);
await ctx.api.object('forge_purchase_order_line').update({ id: line.id, inbound_quantity: lineInbound });
await ctx.api.object('forge_purchase_order').update({ id: order.id, inbound_quantity: orderInbound, status: orderInbound >= Number(order.total_quantity || 0) ? 'completed' : 'partially_arrived' });
await ctx.api.object('forge_purchase_receipt').update({ id: receipt.id, status: 'stocked' });
return { id: inboundId, inspection_id: id, payable_id: payableId, quantity, inventory_amount: amount, before_on_hand: beforeOnHand, after_on_hand: afterOnHand };
` },
});
