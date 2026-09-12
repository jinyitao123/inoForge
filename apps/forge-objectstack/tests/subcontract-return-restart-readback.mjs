import assert from 'node:assert/strict';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4442';
const database = process.env.FORGE_DB || '/tmp/forge-subcontract-return-rerun-20260912.sqlite';
const api = await connect(endpoint);
async function find(object, where = {}) { const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '500' }); const response = await api.request(`/data/${object}?${query}`); assert.equal(response.status, 200, object); return (response.value.records || []).filter(row => Object.entries(where).every(([key, value]) => row[key] === value)); }
const returns = await find('forge_subcontract_return', { code: 'RET-CHAIN-20260912-001' });
assert.equal(returns.length, 1);
const record = returns[0];
const inbound = (await find('forge_subcontract_return_inbound', { return_id: record.id }))[0];
const line = (await find('forge_subcontract_return_line', { return_id: record.id }))[0];
const stock = (await find('forge_subcontract_stock_balance', { order_id: record.order_id, sku_id: line.sku_id }))[0];
const ledger = await find('forge_subcontract_stock_ledger', { source_id: record.id, movement_type: 'material_return' });
assert.deepEqual({ returnStatus: record.status, inboundStatus: inbound.status, lineStatus: line.status, onHand: stock.on_hand_quantity, returned: stock.returned_quantity, ledgerRows: ledger.length }, { returnStatus: 'stocked', inboundStatus: 'stocked', lineStatus: 'stocked', onHand: 5, returned: 1, ledgerRows: 1 });
console.log(JSON.stringify({ suite: 'subcontract-return-restart-readback', status: 'passed', database, returnId: record.id, inboundId: inbound.id, assertion: '同一 SQLite 停服重启后退料单、待入库单、明细、委外库存余额和 material_return 流水按原记录回读' }, null, 2));
