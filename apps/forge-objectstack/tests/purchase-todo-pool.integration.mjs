import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4422';
const api = await connect(endpoint);
const cases = [];
const ids = {};

async function test(name, run) {
  try { await run(); cases.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { cases.push({ name, status: 'failed', error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '200' });
  const result = await api.request(`/data/${object}?${query}`);
  assert.equal(result.status, 200, `${object}: ${JSON.stringify(result.value)}`);
  return (result.value.records || []).filter(record => Object.entries(where).every(([key, value]) => record[key] === value));
}

async function create(object, body) {
  const result = await api.request(`/data/${object}`, 'POST', body);
  assert.equal(result.status, 201, `${object}: ${JSON.stringify(result.value)}`);
  return result.value.id || result.value.record?.id;
}

async function invoke(object, action, id, params = {}) {
  return api.request(`/actions/${object}/${action}/${id}`, 'POST', { params });
}

const [supplier] = await find('forge_supplier', { name: '南京锐联电气技术有限公司' });
const [sku] = await find('forge_material_sku', { code: 'RM-PLC-1215C-0001' });
const [warehouse] = await find('forge_warehouse', { code: 'WH-RM-01' });
assert.ok(supplier && sku && warehouse, 'standard procurement reference data is required');
Object.assign(ids, { supplier: supplier.id, sku: sku.id, warehouse: warehouse.id });

for (const old of await find('forge_purchase_request', { code: 'PR-SUPPLY-POOL-BROWSER-001' })) {
  const pending = await find('forge_purchase_pending_item', { request_id: old.id });
  for (const record of pending) await api.request(`/data/forge_purchase_pending_item/${record.id}`, 'DELETE');
  const logs = await find('forge_purchase_request_approval_log', { request_id: old.id });
  for (const record of logs) await api.request(`/data/forge_purchase_request_approval_log/${record.id}`, 'DELETE');
  const lines = await find('forge_purchase_request_line', { request_id: old.id });
  for (const record of lines) await api.request(`/data/forge_purchase_request_line/${record.id}`, 'DELETE');
  await api.request(`/data/forge_purchase_request/${old.id}`, 'DELETE');
}

await test('approved request material becomes one durable procurement task', async () => {
  ids.request = await create('forge_purchase_request', {
    name: 'PLC 补库采购申请', code: 'PR-SUPPLY-POOL-BROWSER-001', priority: 'high', responsible_id: api.userId,
    suggested_supplier_id: supplier.id, currency: 'cny', request_on: '2026-09-15', expected_arrival_on: '2026-09-25',
    purchase_reason: '供应链页面浏览器验收', status: 'draft', estimated_taxed_amount: 13600,
  });
  ids.requestLine = await create('forge_purchase_request_line', {
    name: 'PLC CPU 1215C', request_id: ids.request, sku_id: sku.id, item_code: sku.code,
    model: 'CPU 1215C DC/DC/DC', specification: '14DI/10DO/2AI', unit_name: '件', quantity: 2,
    taxed_unit_price: 6800, tax_rate: 13, taxed_subtotal: 13600, expected_arrival_on: '2026-09-25',
    suggested_supplier_id: supplier.id,
  });
  const submitted = await invoke('forge_purchase_request', 'purchase_request_submit', ids.request);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.value));
  const approved = await invoke('forge_purchase_request', 'purchase_request_approve', ids.request, { approval_comment: '浏览器验收通过' });
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  const tasks = await find('forge_purchase_pending_item', { request_id: ids.request });
  assert.equal(tasks.length, 1);
  ids.pending = tasks[0].id;
  assert.deepEqual({
    request_line_id: tasks[0].request_line_id, requested_quantity: Number(tasks[0].requested_quantity),
    ordered_quantity: Number(tasks[0].ordered_quantity), remaining_quantity: Number(tasks[0].remaining_quantity),
    supplier: tasks[0].suggested_supplier_id, status: tasks[0].status,
  }, { request_line_id: ids.requestLine, requested_quantity: 2, ordered_quantity: 0, remaining_quantity: 2, supplier: supplier.id, status: 'ready' });
});

await test('approval cannot generate the same procurement task twice', async () => {
  const duplicate = await invoke('forge_purchase_request', 'purchase_request_approve', ids.request, { approval_comment: '重复审批' });
  assert.equal(duplicate.status, 400, JSON.stringify(duplicate.value));
  assert.match(duplicate.value.error.message, /状态已变化|已经生成采购待办/);
  assert.equal((await find('forge_purchase_pending_item', { request_id: ids.request })).length, 1);
});

await test('request without material details is blocked before approval', async () => {
  const empty = await create('forge_purchase_request', {
    name: '无明细申请', code: `PR-SUPPLY-POOL-EMPTY-${Date.now()}`, responsible_id: api.userId,
    request_on: '2026-09-15', expected_arrival_on: '2026-09-25', purchase_reason: '阻断验证', status: 'draft',
  });
  const response = await invoke('forge_purchase_request', 'purchase_request_submit', empty);
  assert.equal(response.status, 400, JSON.stringify(response.value));
  assert.match(response.value.error.message, /至少需要一条物料明细/);
  await api.request(`/data/forge_purchase_request/${empty}`, 'DELETE');
});

await mkdir('.objectstack/acceptance', { recursive: true });
const report = {
  recordedAt: new Date().toISOString(), kind: 'purchase-todo-pool-api-acceptance', endpoint,
  database: process.env.FORGE_DB || 'file:./.objectstack/acceptance/supply-chain-pages-4422.sqlite',
  ids, cases, passed: cases.every(item => item.status === 'passed'),
  boundary: 'API evidence proves request-to-pending source continuity and duplicate/empty-line blocking. Browser evidence remains required for page interaction acceptance.',
};
await writeFile('.objectstack/acceptance/purchase-todo-pool-report.json', JSON.stringify(report, null, 2) + '\n');
if (!report.passed) process.exitCode = 1;
