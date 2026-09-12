import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4399';
const database = process.env.FORGE_DB || '.objectstack/subcontract-product-sample.sqlite';
const reconciliationCode = process.env.FORGE_RECONCILIATION_CODE || 'REC-20260912-001';
const payableCode = process.env.FORGE_PAYABLE_CODE || `AP-${reconciliationCode}`;
const orderCode = process.env.FORGE_SUBCONTRACT_ORDER_CODE || 'OS-SAMPLE-001';
const api = await connect(endpoint);

async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '500' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, `${object} query`);
  return (response.value.records || []).filter(record => Object.entries(where).every(([key, value]) => record[key] === value));
}

const [orders, reconciliations, lines, payables, logs] = await Promise.all([
  find('forge_subcontract_order', { code: orderCode }),
  find('forge_subcontract_reconciliation', { code: reconciliationCode }),
  find('forge_subcontract_reconciliation_line'),
  find('forge_accounts_payable', { code: payableCode }),
  find('forge_subcontract_reconciliation_log'),
]);

const order = orders[0];
const reconciliation = reconciliations[0];
const payable = payables[0];
assert.ok(order, `expected subcontract order ${orderCode}`);
assert.ok(reconciliation, `expected reconciliation ${reconciliationCode}`);
assert.ok(payable, `expected payable ${payableCode}`);
assert.equal(reconciliation.status, 'payable_generated');
assert.equal(reconciliation.payable_id, payable.id);
assert.equal(payable.reconciliation_id, reconciliation.id);
assert.equal(payable.source_type, 'subcontract_reconciliation');
assert.equal(order.status, 'reconciled');
assert.equal(Number(order.reconciled_amount), Number(reconciliation.payable_amount));

const sourceLines = lines.filter(line => line.reconciliation_id === reconciliation.id);
const sourceLineIds = sourceLines.map(line => line.receipt_line_id);
assert.equal(sourceLines.length, Number(reconciliation.line_count));
assert.equal(new Set(sourceLineIds).size, sourceLineIds.length, 'source receipt lines must be unique');
assert.ok(sourceLines.every(line => line.source_key?.startsWith('receipt-line:')));

const auditLogs = logs.filter(log => log.reconciliation_id === reconciliation.id);
auditLogs.sort((left, right) => String(left.occurred_at).localeCompare(String(right.occurred_at)));
assert.deepEqual(auditLogs.map(log => log.action), ['generated', 'confirmed', 'payable_generated']);

const report = {
  recordedAt: new Date().toISOString(),
  kind: 'subcontract-reconciliation-restart-readback',
  status: 'passed',
  endpoint,
  database,
  ids: {
    order: order.id,
    reconciliation: reconciliation.id,
    sourceLines: sourceLines.map(line => line.id),
    payable: payable.id,
    auditLogs: auditLogs.map(log => log.id),
  },
  result: {
    reconciliationStatus: reconciliation.status,
    payableStatus: payable.status,
    payableAmount: reconciliation.payable_amount,
    lineCount: sourceLines.length,
    orderStatus: order.status,
    orderReconciledAmount: order.reconciled_amount,
  },
  boundary: 'This readback proves that the same restarted Forge service can recover the saved subcontract reconciliation, source lines, order settlement amount, payable link and audit sequence. It does not prove RISEMAP write behavior or the unstocked/unresolved-NCR fixtures.',
};

await mkdir('.objectstack/acceptance', { recursive: true });
await writeFile('.objectstack/acceptance/subcontract-reconciliation-readback-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
