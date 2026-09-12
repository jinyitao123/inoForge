import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4401';
const database = process.env.FORGE_DB || 'fixture database supplied by the caller';
const scenario = process.env.FORGE_BLOCK_SCENARIO || 'unstocked-inbound';
const receiptCode = process.env.FORGE_BLOCK_RECEIPT_CODE || 'SR-20260912-001';
const expectedMessage = process.env.FORGE_BLOCK_EXPECTED_MESSAGE || (scenario === 'unresolved-ncr' ? '不良处置' : '正式入库');
const actionCode = `REC-BLOCK-${scenario.toUpperCase()}-${Date.now()}`;
const api = await connect(endpoint);

async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '500' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, `${object} query`);
  return response.value.records || [];
}

const supplier = (await find('forge_supplier', { code: process.env.FORGE_SUPPLIER_CODE || 'SUP-SAMPLE-001' }))[0] || (await find('forge_supplier'))[0];
const receipt = (await find('forge_subcontract_receipt', { code: receiptCode }))[0];
assert.ok(supplier, 'blocking fixture supplier');
assert.ok(receipt, `blocking fixture receipt ${receiptCode}`);

const snapshot = async () => {
  const [reconciliations, lines, logs, payables, orders] = await Promise.all([
    find('forge_subcontract_reconciliation'),
    find('forge_subcontract_reconciliation_line'),
    find('forge_subcontract_reconciliation_log'),
    find('forge_accounts_payable'),
    find('forge_subcontract_order', { code: process.env.FORGE_SUBCONTRACT_ORDER_CODE || 'OS-SAMPLE-001' }),
  ]);
  return {
    reconciliations: reconciliations.length,
    lines: lines.length,
    logs: logs.length,
    payables: payables.filter(payable => payable.reconciliation_id).length,
    order: orders[0] && { status: orders[0].status, reconciled_amount: orders[0].reconciled_amount },
  };
};

const before = await snapshot();
const response = await api.request(`/actions/forge_supplier/subcontract_reconciliation_create/${supplier.id}`, 'POST', {
  params: {
    code: actionCode,
    period_start: '2026-09-01',
    period_end: '2026-09-12',
    receipt_ids_json: JSON.stringify([receipt.id]),
  },
});
assert.equal(response.status, 400, JSON.stringify(response.value));
const errorMessage = response.value.error?.message || response.value.message || '';
assert.match(errorMessage, new RegExp(expectedMessage));
const after = await snapshot();
assert.deepEqual(after, before, 'blocked reconciliation must not leave partial writes');

const report = {
  recordedAt: new Date().toISOString(),
  kind: 'subcontract-reconciliation-blocking-acceptance',
  status: 'passed',
  scenario,
  endpoint,
  database,
  fixture: { supplier_id: supplier.id, receipt_id: receipt.id, receipt_code: receipt.code },
  http: { status: response.status, error: errorMessage },
  noMutation: true,
  before,
  after,
  boundary: 'This acceptance proves the server-side blocking rule and no-partial-write result for the supplied local fixture. Browser feedback and RISEMAP write behavior remain separate evidence layers.',
};
await mkdir('.objectstack/acceptance', { recursive: true });
await writeFile(`.objectstack/acceptance/subcontract-reconciliation-block-${scenario}-report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
