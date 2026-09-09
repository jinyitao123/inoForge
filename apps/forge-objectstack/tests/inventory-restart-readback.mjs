import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const reportPath = '.objectstack/acceptance/inventory-opening-report.json';
const report = JSON.parse(await readFile(reportPath, 'utf8'));
assert.equal(report.passed, true, 'inventory opening acceptance must pass before restart verification');
const endpoint = process.env.FORGE_URL || 'http://localhost:4321';
const api = await connect(endpoint);
const read = async (object, id) => {
  const result = await api.request(`/data/${object}/${id}`);
  assert.equal(result.status, 200, `${object}/${id} read after restart`);
  return result.value.record;
};

const inbound = await read('forge_opening_inbound', report.ids.inbound);
const line = await read('forge_opening_inbound_line', report.ids.line);
const balance = await read('forge_inventory_balance', report.ids.balance);
const ledger = await read('forge_inventory_ledger', report.ids.ledger);
const secondInbound = await read('forge_opening_inbound', report.ids.secondInbound);
const secondLedger = await read('forge_inventory_ledger', report.ids.secondLedger);

assert.deepEqual({ status: inbound.status, line_count: inbound.line_count, total_quantity: inbound.total_quantity, total_amount: inbound.total_amount },
  { status: 'stocked', line_count: 1, total_quantity: 1, total_amount: 54000 });
assert.equal(line.inbound_id, report.ids.inbound);
assert.equal(line.sku_id, report.ids.sku);
assert.deepEqual({ warehouse_id: balance.warehouse_id, sku_id: balance.sku_id, on_hand_quantity: balance.on_hand_quantity, reserved_quantity: balance.reserved_quantity, available_quantity: balance.available_quantity, inventory_value: balance.inventory_value },
  { warehouse_id: report.ids.warehouse, sku_id: report.ids.sku, on_hand_quantity: 3, reserved_quantity: 0, available_quantity: 3, inventory_value: 174000 });
assert.deepEqual({ source_id: ledger.source_id, source_line_id: ledger.source_line_id, direction: ledger.direction, movement_type: ledger.movement_type, before_available: ledger.before_available, after_available: ledger.after_available },
  { source_id: report.ids.inbound, source_line_id: report.ids.line, direction: 'inbound', movement_type: 'opening_inbound', before_available: 0, after_available: 1 });
assert.equal(secondInbound.status, 'stocked');
assert.deepEqual({ source_id: secondLedger.source_id, source_line_id: secondLedger.source_line_id, before_on_hand: secondLedger.before_on_hand, after_on_hand: secondLedger.after_on_hand, before_available: secondLedger.before_available, after_available: secondLedger.after_available },
  { source_id: report.ids.secondInbound, source_line_id: report.ids.secondLine, before_on_hand: 1, after_on_hand: 3, before_available: 1, after_available: 3 });

report.restartVerification = {
  verifiedAt: new Date().toISOString(), status: 'passed', endpoint, database: '.objectstack/inventory.sqlite', recordsRead: 6,
  assertion: 'two stocked opening documents, the accumulated warehouse-SKU balance and both source-linked inventory ledgers survived a full server stop/start',
};
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log('PASS inventory opening restart readback');
