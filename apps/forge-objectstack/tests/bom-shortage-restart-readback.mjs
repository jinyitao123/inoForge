import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const path = '.objectstack/acceptance/bom-shortage-report.json';
const report = JSON.parse(await readFile(path, 'utf8'));
assert.equal(report.passed, true);
const api = await connect();
async function find(object, where) { const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '100' }); const response = await api.request(`/data/${object}?${query}`); assert.equal(response.status, 200); return response.value.records.filter(record => Object.entries(where).every(([key,value]) => record[key] === value)); }
const analyses = await find('forge_bom_shortage_analysis', { bom_id: report.ids.bom });
assert.equal(analyses.length, report.ids.browserAnalysis ? 3 : 2);
const zero = analyses.find(item => item.id === report.ids.zeroStockAnalysis), partial = analyses.find(item => item.id === report.ids.partialStockAnalysis);
assert.deepEqual({ shortage: zero.shortage_count, kit: zero.kit_rate, amount: zero.estimated_purchase_amount }, { shortage: 4, kit: 0, amount: 14442.48 });
assert.deepEqual({ shortage: partial.shortage_count, kit: partial.kit_rate, max: partial.max_producible_quantity }, { shortage: 3, kit: 60, max: 0 });
assert.equal((await find('forge_bom_shortage_line', { analysis_id: zero.id })).length, 4);
assert.equal((await find('forge_bom_shortage_line', { analysis_id: partial.id })).length, 4);
if (report.ids.browserAnalysis) {
  const browser = analyses.find(item => item.id === report.ids.browserAnalysis);
  assert.deepEqual({ planned: browser.planned_quantity, shortage: browser.shortage_count, kit: browser.kit_rate, amount: browser.estimated_purchase_amount }, { planned: 1, shortage: 1, kit: 80, amount: 2831.86 });
  assert.equal((await find('forge_bom_shortage_line', { analysis_id: browser.id })).length, 4);
}
assert.equal((await find('forge_inventory_balance', {})).length, 3);
report.restartVerification = { verifiedAt: new Date().toISOString(), status: 'passed', database: process.env.FORGE_DB || report.database, recordsRead: report.ids.browserAnalysis ? 18 : 13, assertion: report.ids.browserAnalysis ? 'three shortage summaries, twelve snapshot lines and three source inventory balances survived a full stop/start' : 'two shortage summaries, eight snapshot lines and three source inventory balances survived a full stop/start' };
await writeFile(path, JSON.stringify(report, null, 2));
console.log('PASS BOM shortage snapshots survived full server restart');
