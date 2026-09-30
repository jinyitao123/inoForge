import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PurchaseOrderWorkspacePage } = await import('../src/pages/purchase-order-workspace.page.ts');
const { PurchaseOrderViews } = await import('../src/views/purchase-order.view.ts');
const { PurchaseOrder } = await import('../src/objects/procurement.object.ts');
const cliRequire = createRequire(require.resolve('@objectstack/cli'));
const { transformSync } = cliRequire('esbuild');

assert.equal(PurchaseOrderWorkspacePage.kind, 'react');
transformSync(PurchaseOrderWorkspacePage.source, {
  loader: 'jsx',
  format: 'esm',
  sourcefile: 'page_purchase_order_workspace.jsx',
});

const sourceFields = PurchaseOrderViews.form.sections.find((section) => section.name === 'source')?.fields ?? [];
const informationFields = PurchaseOrderViews.form.sections.find((section) => section.name === 'purchase_information')?.fields ?? [];
assert.deepEqual(sourceFields, ['source_type']);
for (const field of ['code', 'supplier_id', 'warehouse_id', 'expected_arrival_on', 'payment_term', 'payment_method', 'remarks']) {
  assert.ok(informationFields.includes(field), `purchase-order View is missing ${field}`);
}
for (const field of [...sourceFields, ...informationFields]) {
  assert.ok(Object.hasOwn(PurchaseOrder.fields, field), `purchase-order View references an undeclared model field: ${field}`);
}
assert.equal(typeof PurchaseOrder.fields.source_type.defaultValue, 'string');

assert.match(PurchaseOrderWorkspacePage.source, /<ObjectForm/);
assert.match(PurchaseOrderWorkspacePage.source, /onControllerReady=\{onSourceControllerReady\}/);
assert.match(PurchaseOrderWorkspacePage.source, /onControllerReady=\{onInformationControllerReady\}/);
assert.match(PurchaseOrderWorkspacePage.source, /sourceController\.current\.validate\(\)/);
assert.match(PurchaseOrderWorkspacePage.source, /informationController\.current\.validate\(\)/);
assert.match(PurchaseOrderWorkspacePage.source, /submitHandler=\{values=>values\}/);
assert.match(PurchaseOrderWorkspacePage.source, /<Block type="field:grid"/);
assert.match(PurchaseOrderWorkspacePage.source, /bom_shortage_create_purchase_order/);
assert.match(PurchaseOrderWorkspacePage.source, /purchase_order_create/);
assert.doesNotMatch(PurchaseOrderWorkspacePage.source, /adapter\?\.(create|update)|adapter\.(create|update)\(/);

process.stdout.write('PASS purchase-order workspace source parses and uses View-backed controlled ObjectForms without changing its business actions\n');
