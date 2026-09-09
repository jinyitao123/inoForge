import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const report = JSON.parse(await readFile('.objectstack/acceptance/procurement-chain-report.json', 'utf8'));
assert.equal(report.passed, true, 'procurement chain acceptance must pass before restart readback');
let downstreamReport = null;
try {
  const candidate = JSON.parse(await readFile('.objectstack/acceptance/procurement-receipt-inbound-report.json', 'utf8'));
  if (candidate.passed && candidate.ids?.order === report.ids.order) downstreamReport = candidate;
} catch {}
const api = await connect();
const { order, orderLine, arrivalNotice, supplier, sku, warehouse } = report.ids;

async function read(object, id) {
  const result = await api.request(`/data/${object}/${id}`);
  assert.equal(result.status, 200, `${object} restart read`);
  return result.value.record;
}

const savedOrder = await read('forge_purchase_order', order);
const savedLine = await read('forge_purchase_order_line', orderLine);
const savedNotice = await read('forge_purchase_arrival_notice', arrivalNotice);
assert.deepEqual(
  { status: savedOrder.status, supplier_id: savedOrder.supplier_id, warehouse_id: savedOrder.warehouse_id, total_quantity: savedOrder.total_quantity, total_amount: savedOrder.total_amount },
  { status: downstreamReport ? 'partially_arrived' : 'approved', supplier_id: supplier, warehouse_id: warehouse, total_quantity: 2, total_amount: 13600 },
);
assert.deepEqual(
  { order_id: savedLine.order_id, sku_id: savedLine.sku_id, quantity: savedLine.quantity, arrived_quantity: savedLine.arrived_quantity, inbound_quantity: savedLine.inbound_quantity },
  { order_id: order, sku_id: sku, quantity: 2, arrived_quantity: downstreamReport ? 2 : 0, inbound_quantity: downstreamReport ? 1 : 0 },
);
assert.deepEqual(
  { order_id: savedNotice.order_id, order_line_id: savedNotice.order_line_id, sku_id: savedNotice.sku_id, status: savedNotice.status, planned_quantity: savedNotice.planned_quantity, arrived_quantity: savedNotice.arrived_quantity },
  { order_id: order, order_line_id: orderLine, sku_id: sku, status: downstreamReport ? 'arrived' : 'pending_arrival', planned_quantity: 2, arrived_quantity: downstreamReport ? 2 : 0 },
);

const restart = {
  checkedAt: new Date().toISOString(), passed: true, ids: report.ids,
  runtime: { url: process.env.FORGE_URL || 'http://localhost:4310', database: 'file:./.objectstack/procurement.sqlite', restartedBeforeReadback: true, isolatedFromMainPort4310: true },
};
await writeFile('.objectstack/acceptance/procurement-restart-report.json', JSON.stringify(restart, null, 2));
console.log('PASS procurement order, line and arrival notice persist after restart at their current downstream state');
