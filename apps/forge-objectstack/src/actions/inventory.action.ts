import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

export const OpeningInboundSubmit = defineAction({
  name: 'opening_inbound_submit', label: '提交审批', objectName: 'forge_opening_inbound', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft'`, refreshAfter: true,
  description: '校验期初入库明细并提交审批；提交本身不改变库存。', successMessage: '期初入库单已提交审批',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inbound = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inbound) throw new Error('当前期初入库单不存在或不可访问');
if (inbound.status !== 'draft') throw new Error('仅草稿期初入库单可以提交审批');
const lines = await ctx.api.object('forge_opening_inbound_line').find({ where: { inbound_id: id } });
if (!lines.length) throw new Error('期初入库单至少需要一条物料明细');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
let totalQuantity = 0, totalAmount = 0;
for (const line of lines) { const qty = Number(line.quantity || 0); if (!(qty > 0)) throw new Error('期初入库数量必须大于0'); totalQuantity += qty; totalAmount += Number(line.taxed_amount || (qty * Number(line.taxed_unit_price || 0))); }
await ctx.api.object('forge_opening_inbound').update({ id, line_count: lines.length, total_quantity: round4(totalQuantity), total_amount: round4(totalAmount), status: 'pending_approval' });
return { id, status: 'pending_approval', line_count: lines.length, total_quantity: round4(totalQuantity), total_amount: round4(totalAmount) };
` },
});

export const OpeningInboundApprove = defineAction({
  name: 'opening_inbound_approve', label: '同意入库', objectName: 'forge_opening_inbound', icon: 'badge-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  description: '审批通过后增加仓库可用库存，并为每条明细生成库存流水。', successMessage: '审批通过，库存已更新',
  params: [{ field: 'approval_note', objectOverride: 'forge_opening_inbound', required: true, defaultValue: '同意' }],
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inbound = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inbound) throw new Error('当前期初入库单不存在或不可访问');
if (inbound.status !== 'pending_approval') throw new Error('仅待审批期初入库单可以审批入库');
const lines = await ctx.api.object('forge_opening_inbound_line').find({ where: { inbound_id: id } });
if (!lines.length) throw new Error('期初入库单至少需要一条物料明细');
const existingLedgers = await ctx.api.object('forge_inventory_ledger').find({ where: { source_id: id } });
if (existingLedgers.length) throw new Error('当前期初入库单已经生成库存流水');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const occurredAt = new Date().toISOString();
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index], qty = Number(line.quantity || 0), unitCost = Number(line.taxed_unit_price || 0), amount = Number(line.taxed_amount || (qty * unitCost));
  if (!(qty > 0)) throw new Error('期初入库数量必须大于0');
  const balanceKey = inbound.warehouse_id + ':' + line.sku_id;
  const balances = await ctx.api.object('forge_inventory_balance').find({ where: { balance_key: balanceKey } });
  if (balances.length > 1) throw new Error('同一仓库和物料存在重复库存余额');
  const balance = balances[0] || null, beforeOnHand = Number(balance && balance.on_hand_quantity || 0), reserved = Number(balance && balance.reserved_quantity || 0);
  const beforeAvailable = Number(balance && balance.available_quantity || 0), beforeValue = Number(balance && balance.inventory_value || 0);
  const afterOnHand = round4(beforeOnHand + qty), afterAvailable = round4(afterOnHand - reserved), afterValue = round4(beforeValue + amount), averageCost = afterOnHand > 0 ? round4(afterValue / afterOnHand) : 0;
  if (balance) await ctx.api.object('forge_inventory_balance').update({ id: balance.id, on_hand_quantity: afterOnHand, reserved_quantity: reserved, available_quantity: afterAvailable, average_cost: averageCost, inventory_value: afterValue, last_movement_at: occurredAt });
  else await ctx.api.object('forge_inventory_balance').insert({ name: inbound.code + ' ' + line.name, balance_key: balanceKey, warehouse_id: inbound.warehouse_id, sku_id: line.sku_id, on_hand_quantity: afterOnHand, reserved_quantity: 0, available_quantity: afterAvailable, average_cost: averageCost, inventory_value: afterValue, last_movement_at: occurredAt, remarks: '由期初入库建立' });
  await ctx.api.object('forge_inventory_ledger').insert({ name: inbound.code + ' ' + line.name + ' 入库', code: inbound.code + '-' + String(index + 1).padStart(3, '0'), warehouse_id: inbound.warehouse_id, sku_id: line.sku_id, direction: 'inbound', movement_type: 'opening_inbound', quantity: qty, before_on_hand: beforeOnHand, after_on_hand: afterOnHand, before_available: beforeAvailable, after_available: afterAvailable, unit_cost: unitCost, amount, occurred_at: occurredAt, source_object: 'forge_opening_inbound', source_id: id, source_line_id: line.id, responsible_id: inbound.responsible_id, remarks: ctx.input.approval_note });
}
await ctx.api.object('forge_opening_inbound').update({ id, status: 'stocked', approval_note: ctx.input.approval_note, approved_at: occurredAt });
return { id, status: 'stocked', line_count: lines.length, approved_at: occurredAt };
` },
});
