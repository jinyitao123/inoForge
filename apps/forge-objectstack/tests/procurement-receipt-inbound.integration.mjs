import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const procurement = JSON.parse(await readFile('.objectstack/acceptance/procurement-chain-report.json', 'utf8'));
assert.equal(procurement.passed, true, 'procurement order acceptance must pass before receipt verification');
const api = await connect();
const cases = [];
const ids = { ...procurement.ids };
const read = async (object, id) => {
  const response = await api.request(`/data/${object}/${id}`);
  assert.equal(response.status, 200, `${object}/${id} read`);
  return response.value.record;
};
const find = async (object, where) => {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '20' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, `${object} find`);
  return response.value.records.filter(record => Object.entries(where).every(([field, value]) => record[field] === value));
};
const invoke = (object, action, id, params = {}) => api.request(`/actions/${object}/${action}/${id}`, 'POST', { params });
const resultOf = response => response.value?.result ?? response.value?.data?.result ?? response.value?.data ?? response.value;
async function test(name, run) {
  try { await run(); cases.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { cases.push({ name, status: 'failed', error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

await test('registers the approved notice as a physical receipt and creates one pending inspection', async () => {
  const response = await invoke('forge_purchase_arrival_notice', 'purchase_arrival_register', ids.arrivalNotice, {
    code: 'RCV-RM-20260909-001', arrived_on: '2026-09-09', quantity: 2, batch_number: 'BATCH-RM-20260909-001',
    remarks: '采购到货、检验与入库待复核切片验收。',
  });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const result = resultOf(response); ids.receipt = result.id; ids.inspection = result.inspection_id;
  assert.ok(ids.receipt && ids.inspection, 'receipt and inspection ids');
  const receipt = await read('forge_purchase_receipt', ids.receipt);
  assert.deepEqual({ notice_id: receipt.notice_id, quantity: receipt.quantity, taxed_unit_price: receipt.taxed_unit_price,
    taxed_amount: receipt.taxed_amount, status: receipt.status, batch_number: receipt.batch_number },
  { notice_id: ids.arrivalNotice, quantity: 2, taxed_unit_price: 6800, taxed_amount: 13600,
    status: 'pending_inspection', batch_number: 'BATCH-RM-20260909-001' });
  const inspection = await read('forge_purchase_inspection', ids.inspection);
  assert.deepEqual({ receipt_id: inspection.receipt_id, total_quantity: inspection.total_quantity,
    accepted_quantity: inspection.accepted_quantity, result: inspection.result, status: inspection.status },
  { receipt_id: ids.receipt, total_quantity: 2, accepted_quantity: 0, result: 'pending', status: 'pending' });
  const notice = await read('forge_purchase_arrival_notice', ids.arrivalNotice);
  const order = await read('forge_purchase_order', ids.order);
  const line = await read('forge_purchase_order_line', ids.orderLine);
  assert.deepEqual({ notice_status: notice.status, notice_arrived: notice.arrived_quantity, order_status: order.status,
    order_arrived: order.arrived_quantity, line_arrived: line.arrived_quantity },
  { notice_status: 'arrived', notice_arrived: 2, order_status: 'partially_arrived', order_arrived: 2, line_arrived: 2 });
});

await test('rejects another receipt after the notice quantity is fully arrived', async () => {
  const response = await invoke('forge_purchase_arrival_notice', 'purchase_arrival_register', ids.arrivalNotice, {
    code: 'RCV-RM-20260909-OVER', arrived_on: '2026-09-09', quantity: 1,
  });
  assert.equal(response.status, 400, JSON.stringify(response.value));
  assert.match(response.value.error.message, /状态已变化/);
  assert.equal((await find('forge_purchase_receipt', { notice_id: ids.arrivalNotice })).length, 1);
});

await test('rejects invalid inspection quantity and then records a partial pass', async () => {
  const invalid = await invoke('forge_purchase_inspection', 'purchase_inspection_complete', ids.inspection, {
    inspected_on: '2026-09-09', accepted_quantity: 3, inspection_note: '超量校验',
  });
  assert.equal(invalid.status, 400, JSON.stringify(invalid.value));
  assert.match(invalid.value.error.message, /必须在0和到货总数之间/);
  const response = await invoke('forge_purchase_inspection', 'purchase_inspection_complete', ids.inspection, {
    inspected_on: '2026-09-09', accepted_quantity: 1, inspection_note: '1件合格，1件待供应商处置。',
  });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const inspection = await read('forge_purchase_inspection', ids.inspection);
  const receipt = await read('forge_purchase_receipt', ids.receipt);
  const line = await read('forge_purchase_order_line', ids.orderLine);
  assert.deepEqual({ accepted: inspection.accepted_quantity, rejected: inspection.rejected_quantity, result: inspection.result,
    status: inspection.status, receipt_status: receipt.status, line_inspected: line.inspected_quantity, line_accepted: line.accepted_quantity },
  { accepted: 1, rejected: 1, result: 'partial', status: 'completed', receipt_status: 'inspected', line_inspected: 2, line_accepted: 1 });
});

await test('stocks only the accepted quantity and creates an auditable purchase inbound ledger', async () => {
  const response = await invoke('forge_purchase_inspection', 'purchase_inspection_create_inbound', ids.inspection, {
    code: 'PIN-RM-20260909-001', inbound_on: '2026-09-09', remarks: '检验合格数量采购入库。',
  });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const result = resultOf(response); ids.inbound = result.id;
  assert.ok(ids.inbound, 'purchase inbound id');
  const inbound = await read('forge_purchase_inbound', ids.inbound);
  assert.deepEqual({ inspection_id: inbound.inspection_id, quantity: inbound.quantity, unit_cost: inbound.unit_cost,
    amount: inbound.inventory_amount, before: inbound.before_on_hand, after: inbound.after_on_hand, status: inbound.status },
  { inspection_id: ids.inspection, quantity: 1, unit_cost: 6800, amount: 6800, before: 0, after: 1, status: 'stocked' });
  const balances = await find('forge_inventory_balance', { balance_key: `${ids.warehouse}:${ids.sku}` });
  assert.equal(balances.length, 1); ids.balance = balances[0].id;
  assert.deepEqual({ on_hand: balances[0].on_hand_quantity, available: balances[0].available_quantity,
    average_cost: balances[0].average_cost, value: balances[0].inventory_value },
  { on_hand: 1, available: 1, average_cost: 6800, value: 6800 });
  const ledgers = await find('forge_inventory_ledger', { source_id: ids.inbound });
  assert.equal(ledgers.length, 1); ids.ledger = ledgers[0].id;
  assert.deepEqual({ source_object: ledgers[0].source_object, direction: ledgers[0].direction,
    movement_type: ledgers[0].movement_type, quantity: ledgers[0].quantity, before: ledgers[0].before_on_hand,
    after: ledgers[0].after_on_hand, amount: ledgers[0].amount },
  { source_object: 'forge_purchase_inbound', direction: 'inbound', movement_type: 'purchase_inbound',
    quantity: 1, before: 0, after: 1, amount: 6800 });
  const order = await read('forge_purchase_order', ids.order), line = await read('forge_purchase_order_line', ids.orderLine);
  assert.deepEqual({ status: order.status, inbound: order.inbound_quantity, line_inbound: line.inbound_quantity,
    receipt_status: (await read('forge_purchase_receipt', ids.receipt)).status },
  { status: 'partially_arrived', inbound: 1, line_inbound: 1, receipt_status: 'stocked' });
});

await test('rejects a second inbound for the same inspection without another stock movement', async () => {
  const response = await invoke('forge_purchase_inspection', 'purchase_inspection_create_inbound', ids.inspection, {
    code: 'PIN-RM-20260909-REPEAT', inbound_on: '2026-09-09',
  });
  assert.equal(response.status, 400, JSON.stringify(response.value));
  assert.match(response.value.error.message, /已经生成采购入库单/);
  assert.equal((await find('forge_inventory_ledger', { source_object: 'forge_purchase_inbound' })).length, 1);
});

await mkdir('.objectstack/acceptance', { recursive: true });
const report = {
  recordedAt: new Date().toISOString(), kind: 'local-procurement-receipt-inspection-inbound-acceptance', ids, cases,
  passed: cases.every(testCase => testCase.status === 'passed'),
  runtime: { url: process.env.FORGE_URL || 'http://localhost:4334', database: '.objectstack/procurement-receipt-inbound.sqlite' },
  observedBoundary: 'An approved line-level arrival notice can be physically received, inspected, and stocked. Only accepted quantity increases the warehouse-SKU balance and creates a source-linked purchase inbound ledger.',
  limitations: [
    'RISEMAP evidence currently confirms the arrival, pending-inspection, inspection and purchase-inbound pages and their sequence, but not a successful same-input business record.',
    'This Forge slice handles one material per arrival notice, one inspection per receipt, and one inbound per inspection.',
    'Inspection plans, sampling rules, supplier nonconformance disposition, returns, accounts payable and purchase invoices remain outside this slice.',
    'Writes remain sequential because ObjectStack 17.3.0 action transactions time out during audit persistence.',
  ],
};
await writeFile('.objectstack/acceptance/procurement-receipt-inbound-report.json', JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
