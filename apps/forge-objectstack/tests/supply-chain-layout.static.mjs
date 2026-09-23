import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const notice = await readFile(new URL('../src/pages/purchase-arrival-notice.page.ts', import.meta.url), 'utf8');
const arrival = await readFile(new URL('../src/pages/purchase-arrival-workspace.page.ts', import.meta.url), 'utf8');
const ncr = await readFile(new URL('../src/pages/inventory-ncr.page.ts', import.meta.url), 'utf8');

assert.match(notice, /\.card\{[^}]*container-type:inline-size/);
assert.match(notice, /@container \(max-width:1120px\)\{\.filters\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(notice, /\.table th:last-child\{position:sticky;right:0/);
assert.match(notice, /\.table td:last-child:not\(\[colspan\]\)\{position:sticky;right:0/);
assert.match(notice, /arrival-empty-cell\{position:sticky;left:0;width:100cqw/);
assert.ok(!/@media\(max-width:900px\)\{\.filters\{/.test(notice), 'arrival-notice filter layout must respond to its card container');

assert.match(arrival, /\.forge-arrival \.card\{container-type:inline-size\}/);
assert.match(arrival, /@container \(max-width:1120px\)\{\.forge-arrival \.arrival-list-filterbar/);
assert.match(arrival, /\.arrival-orders-table td:last-child:not\(\[colspan\]\)\{position:sticky;right:0/);
assert.match(arrival, /arrival-list-table-wrap td\.arrival-list-empty\{position:sticky;left:0;width:100cqw/);
assert.match(arrival, /arrival-list-pagination-actions/);
assert.ok(arrival.includes('arrival-list-filterbar') && arrival.includes('arrival-list-search'));

assert.match(ncr, /\.forge-inventory-ncr \.fp-card\{container-type:inline-size\}/);
assert.match(ncr, /@container \(max-width:1120px\)\{\.forge-inventory-ncr \.ncr-filter\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(ncr, /\.forge-inventory-ncr \.fp-table td:last-child:not\(\[colspan\]\)\{position:sticky;right:0/);
assert.match(ncr, /fp-empty-cell>\.fp-empty\{position:sticky;left:0;width:100cqw/);
assert.ok(!/@media\(max-width:1000px\)\{\.forge-inventory-ncr \.ncr-filter/.test(ncr), 'NCR filter layout must respond to its card container');

console.log('供应链三页的筛选器按内容容器缩排；宽表格右侧操作固定可达，空态与分页保留在滚动区域内。');
