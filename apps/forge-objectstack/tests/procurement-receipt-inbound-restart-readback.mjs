import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const path = '.objectstack/acceptance/procurement-receipt-inbound-report.json';
const report = JSON.parse(await readFile(path, 'utf8'));
assert.equal(report.passed, true, 'procurement receipt acceptance must pass before restart verification');
const api = await connect();
const read = async (object, id) => {
  const response = await api.request(`/data/${object}/${id}`);
  assert.equal(response.status, 200, `${object}/${id} persisted across restart`);
  return response.value.record;
};
const receipt = await read('forge_purchase_receipt', report.ids.receipt);
const inspection = await read('forge_purchase_inspection', report.ids.inspection);
const inbound = await read('forge_purchase_inbound', report.ids.inbound);
const balance = await read('forge_inventory_balance', report.ids.balance);
const ledger = await read('forge_inventory_ledger', report.ids.ledger);
const order = await read('forge_purchase_order', report.ids.order);
const line = await read('forge_purchase_order_line', report.ids.orderLine);
assert.deepEqual({ receipt_status: receipt.status, receipt_quantity: receipt.quantity, inspection_status: inspection.status,
  inspection_result: inspection.result, accepted: inspection.accepted_quantity, rejected: inspection.rejected_quantity,
  inbound_status: inbound.status, inbound_quantity: inbound.quantity, inbound_amount: inbound.inventory_amount },
{ receipt_status: 'stocked', receipt_quantity: 2, inspection_status: 'completed', inspection_result: 'partial',
  accepted: 1, rejected: 1, inbound_status: 'stocked', inbound_quantity: 1, inbound_amount: 6800 });
assert.deepEqual({ on_hand: balance.on_hand_quantity, available: balance.available_quantity, average_cost: balance.average_cost,
  value: balance.inventory_value, source_object: ledger.source_object, source_id: ledger.source_id,
  movement_type: ledger.movement_type, before: ledger.before_on_hand, after: ledger.after_on_hand },
{ on_hand: 1, available: 1, average_cost: 6800, value: 6800, source_object: 'forge_purchase_inbound',
  source_id: report.ids.inbound, movement_type: 'purchase_inbound', before: 0, after: 1 });
assert.deepEqual({ order_status: order.status, arrived: order.arrived_quantity, inbound: order.inbound_quantity,
  line_arrived: line.arrived_quantity, line_inspected: line.inspected_quantity, line_accepted: line.accepted_quantity,
  line_inbound: line.inbound_quantity },
{ order_status: 'partially_arrived', arrived: 2, inbound: 1, line_arrived: 2, line_inspected: 2, line_accepted: 1, line_inbound: 1 });
report.restartVerification = {
  verifiedAt: new Date().toISOString(), status: 'passed', database: '.objectstack/procurement-receipt-inbound.sqlite',
  recordsRead: 7, assertion: 'receipt, partial inspection, accepted-quantity inbound, inventory balance, source-linked ledger and purchase rollups survived a full stop/start',
};
await writeFile(path, JSON.stringify(report, null, 2));
console.log('PASS procurement receipt, inspection and inbound chain survived full server restart');
