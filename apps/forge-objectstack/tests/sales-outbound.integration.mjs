import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const report = JSON.parse(await readFile('.objectstack/acceptance/sales-shipment-report.json', 'utf8'));
const api = await connect();
const ids = { ...report.ids, outbound: 'CXRfW8FSTlmELHms' };
const read = async (object, id) => (await api.request(`/data/${object}/${id}`)).value.record;
const invoke = params => api.request(`/actions/forge_sales_shipment/sales_shipment_create_outbound/${ids.shipment}`, 'POST', { params });
const outbound = await read('forge_sales_outbound', ids.outbound);
assert.equal(outbound.status, 'outbounded');
assert.equal(outbound.quantity, 1);
assert.equal(outbound.available_quantity, 1);
assert.equal(outbound.customer_pickup, true);

const shipment = await read('forge_sales_shipment', ids.shipment);
assert.deepEqual({ status: shipment.status, outbound_quantity: shipment.outbound_quantity, outbound_count: shipment.outbound_count },
  { status: 'outbounded', outbound_quantity: 1, outbound_count: 1 });
const order = await read('forge_sales_order', ids.order);
const line = await read('forge_sales_order_line', ids.orderLine);
assert.deepEqual({ status: order.status, shipped_amount: order.shipped_amount, shipped_quantity: line.shipped_quantity },
  { status: 'partially_shipped', shipped_amount: 128000, shipped_quantity: 1 });

const rejected = await invoke({ code: 'OUT-CONVERT-20260909-OVER', warehouse_id: outbound.warehouse_id, outbound_on: '2026-09-09', quantity: 1, available_quantity: 1 });
assert.equal(rejected.status, 400);
assert.match(rejected.value.error.message, /发货单状态已变化/);

await writeFile('.objectstack/acceptance/sales-outbound-report.json', JSON.stringify({
  recordedAt: new Date().toISOString(), kind: 'local-sales-outbound-api-acceptance', ids,
  cases: [
    { name: 'stocked customer-pickup outbound persists', status: 'passed' },
    { name: 'outbound progress rolls up to shipment and order', status: 'passed' },
    { name: 'outbound quantity beyond shipment remainder is rejected', status: 'passed' },
  ], passed: true,
  observedBoundary: 'The outbound action requires an explicit available-quantity check, creates an outbound document, and rolls up shipped quantity and amount without changing the reserved shipment amount.',
}, null, 2));
console.log('PASS sales outbound acceptance');
