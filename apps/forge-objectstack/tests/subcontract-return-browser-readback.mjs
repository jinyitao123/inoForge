import assert from 'node:assert/strict';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4443';
const database = process.env.FORGE_DB || '/tmp/forge-subcontract-return-browser-20260912.sqlite';
const api = await connect(endpoint);
async function find(object, where = {}) {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '500' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, object);
  return (response.value.records || []).filter(row => Object.entries(where).every(([key, value]) => row[key] === value));
}
const record = (await find('forge_subcontract_return', { code: 'RET-BROWSER-20260912-001' }))[0];
assert.ok(record, 'browser-created return must exist');
const inbound = (await find('forge_subcontract_return_inbound', { return_id: record.id }))[0];
const line = (await find('forge_subcontract_return_line', { return_id: record.id }))[0];
const stock = (await find('forge_subcontract_stock_balance', { order_id: record.order_id, sku_id: line.sku_id }))[0];
const ledgers = await find('forge_subcontract_stock_ledger', { source_id: record.id, movement_type: 'material_return' });
assert.deepEqual({ returnStatus: record.status, inboundStatus: inbound.status, lineStatus: line.status, quantity: line.requested_quantity, onHand: stock.on_hand_quantity, returned: stock.returned_quantity, ledgerRows: ledgers.length }, { returnStatus: 'stocked', inboundStatus: 'stocked', lineStatus: 'stocked', quantity: 1, onHand: 5, returned: 1, ledgerRows: 1 });
console.log(JSON.stringify({ suite: 'subcontract-return-browser-readback', status: 'passed', database, returnId: record.id, inboundId: inbound.id, assertion: '内置浏览器创建的退料单在停服重启后仍保持已入库状态，并与库存余额和流水一致' }, null, 2));
