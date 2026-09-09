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
