import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4347';
const database = process.env.FORGE_DB || '.objectstack/otc-shortage-analysis.sqlite';
const api = await connect(endpoint);
const cases = [];
const ids = { operator: api.userId };
const round4 = value => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

async function test(name, run) {
  try { await run(); cases.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { cases.push({ name, status: 'failed', error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '100' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, `${object}: ${JSON.stringify(response.value)}`);
  return response.value.records.filter(record => Object.entries(where).every(([key, value]) => record[key] === value));
}
async function read(object, id) {
  const response = await api.request(`/data/${object}/${id}`);
  assert.equal(response.status, 200, `${object}/${id}`);
  return response.value.record;
}
async function invoke(action, id, params = {}, authenticated = true) {
  return api.request(`/actions/forge_bom/${action}/${id}`, 'POST', { params }, authenticated);
}
function result(response) { return response.value?.result ?? response.value?.data?.result ?? response.value?.data ?? response.value; }

const projectBoms = await find('forge_bom', { bom_type: 'project', status: 'active' });
const bom = projectBoms.find(item => item.code.endsWith('PRJ-2026-001')) || projectBoms[0];
assert.ok(bom, 'active project BOM is required');
ids.bom = bom.id;
const nodes = (await find('forge_bom_node', { bom_id: bom.id })).filter(node => node.parent_id);
assert.equal(nodes.length, 4);
const skuById = Object.fromEntries(await Promise.all(nodes.map(async node => [node.sku_id, await read('forge_material_sku', node.sku_id)])));
const materialById = Object.fromEntries(await Promise.all(Object.values(skuById).map(async sku => [sku.material_id, await read('forge_material', sku.material_id)])));

await test('rejects anonymous shortage analysis', async () => {
  assert.equal((await invoke('bom_analyze_shortage', bom.id, { planned_quantity: 1 }, false)).status, 401);
});

await test('rejects non-positive planned quantity', async () => {
  const response = await invoke('bom_analyze_shortage', bom.id, { planned_quantity: 0 });
  assert.equal(response.status, 400, JSON.stringify(response.value));
});

await test('matches the RISEMAP zero-stock result for one cabinet', async () => {
  const response = await invoke('bom_analyze_shortage', bom.id, { planned_quantity: 1 });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const summary = result(response); ids.zeroStockAnalysis = summary.id;
  assert.deepEqual({ planned: summary.planned_quantity, components: summary.component_count, shortage: summary.shortage_count, kit: summary.kit_rate, max: summary.max_producible_quantity, amount: summary.estimated_purchase_amount },
    { planned: 1, components: 4, shortage: 4, kit: 0, max: 0, amount: 14442.48 });
  const lines = await find('forge_bom_shortage_line', { analysis_id: summary.id });
  assert.equal(lines.length, 4);
  assert.ok(lines.every(line => line.available_quantity === 0 && line.shortage_quantity === line.total_required && line.fulfillment_status === 'shortage'));
  assert.deepEqual(Object.fromEntries(lines.map(line => [line.item_code, line.shortage_quantity])), {
    'RM-PLC-1215C': 1, 'RM-HMI-700': 1, 'RM-PSU-24V10A': 2, 'RM-CAB-800': 1,
  });
});

await test('adds real available stock through an approved opening inbound', async () => {
  const warehouse = (await find('forge_warehouse'))[0]; assert.ok(warehouse); ids.warehouse = warehouse.id;
  const created = await api.request('/data/forge_opening_inbound', 'POST', { name: 'BOM齐套分析期初库存', code: 'IN-BOM-MRP-20260910-001', inbound_on: '2026-09-10', warehouse_id: warehouse.id, responsible_id: api.userId });
  assert.equal(created.status, 201, JSON.stringify(created.value)); ids.inbound = created.value.id || created.value.record?.id;
  const stock = { 'RM-PLC-1215C': 1, 'RM-PSU-24V10A': 5, 'RM-CAB-800': 1 };
  for (const node of nodes) {
    const sku = skuById[node.sku_id], material = materialById[sku.material_id], quantity = stock[material.code];
    if (!quantity) continue;
    const line = await api.request('/data/forge_opening_inbound_line', 'POST', { name: material.name, inbound_id: ids.inbound, sku_id: sku.id, item_code: material.code, model: material.model, specification: sku.name, unit_name: '件', quantity, taxed_unit_price: sku.cost_price, untaxed_unit_price: round4(sku.cost_price / 1.13), tax_rate: 13, taxed_amount: round4(quantity * sku.cost_price) });
    assert.equal(line.status, 201, JSON.stringify(line.value));
  }
  const submit = await api.request(`/actions/forge_opening_inbound/opening_inbound_submit/${ids.inbound}`, 'POST', { params: {} });
  assert.equal(submit.status, 200, JSON.stringify(submit.value));
  const approve = await api.request(`/actions/forge_opening_inbound/opening_inbound_approve/${ids.inbound}`, 'POST', { params: { approval_note: '用于项目BOM齐套分析验收' } });
  assert.equal(approve.status, 200, JSON.stringify(approve.value));
  assert.equal((await find('forge_inventory_balance')).length, 3);
});

await test('calculates partial kit rate and shortage for two cabinets', async () => {
  const response = await invoke('bom_analyze_shortage', bom.id, { planned_quantity: 2 });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const summary = result(response); ids.partialStockAnalysis = summary.id;
  assert.deepEqual({ planned: summary.planned_quantity, components: summary.component_count, shortage: summary.shortage_count, kit: summary.kit_rate, max: summary.max_producible_quantity },
    { planned: 2, components: 4, shortage: 3, kit: 60, max: 0 });
  const lines = await find('forge_bom_shortage_line', { analysis_id: summary.id });
  const byCode = Object.fromEntries(lines.map(line => [line.item_code, line]));
  assert.deepEqual({ plc: byCode['RM-PLC-1215C'].shortage_quantity, hmi: byCode['RM-HMI-700'].shortage_quantity, psu: byCode['RM-PSU-24V10A'].shortage_quantity, cabinet: byCode['RM-CAB-800'].shortage_quantity },
    { plc: 1, hmi: 2, psu: 0, cabinet: 1 });
  const expected = Math.round((byCode['RM-PLC-1215C'].untaxed_unit_price + 2 * byCode['RM-HMI-700'].untaxed_unit_price + byCode['RM-CAB-800'].untaxed_unit_price + Number.EPSILON) * 100) / 100;
  assert.equal(summary.estimated_purchase_amount, expected);
});

await test('keeps the first analysis as an immutable historical snapshot', async () => {
  const first = await read('forge_bom_shortage_analysis', ids.zeroStockAnalysis);
  assert.deepEqual({ shortage: first.shortage_count, kit: first.kit_rate, amount: first.estimated_purchase_amount }, { shortage: 4, kit: 0, amount: 14442.48 });
  const lines = await find('forge_bom_shortage_line', { analysis_id: ids.zeroStockAnalysis });
  assert.ok(lines.every(line => line.available_quantity === 0));
  assert.equal((await find('forge_bom_shortage_analysis', { bom_id: bom.id })).length, 2);
});

await mkdir('.objectstack/acceptance', { recursive: true });
const report = {
  recordedAt: new Date().toISOString(), kind: 'risemap-aligned-bom-shortage-acceptance', fixture: 'OEM-RM-20260909-A-shortage-v0.1', endpoint, database, ids, cases,
  passed: cases.every(item => item.status === 'passed'),
  risemapObserved: { unsavedBlock: '请先保存 BOM', plannedQuantity: 1, componentCount: 4, shortageCount: 4, kitRate: 0, maxProducibleQuantity: 0, estimatedPurchaseAmount: 14442.48, columns: ['物料编码','名称','规格','型号','单位','单机用量','总需求','库存','锁定','可用','缺口','供应商','单价','小计'] },
  boundary: 'This slice calculates and persists BOM shortage snapshots from current inventory. It does not create purchase requests, reserve stock, sequence competing orders, or claim production shortage-todo behavior.',
};
await writeFile('.objectstack/acceptance/bom-shortage-report.json', JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
