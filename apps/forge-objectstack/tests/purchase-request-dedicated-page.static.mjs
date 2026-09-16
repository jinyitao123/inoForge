import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/pages/purchase-request.page.ts', import.meta.url), 'utf8');
const routing = await readFile(new URL('../src/pages/supply-production-routing.page.ts', import.meta.url), 'utf8');
const objects = await readFile(new URL('../src/objects/procurement.object.ts', import.meta.url), 'utf8');
const actions = await readFile(new URL('../src/actions/procurement.action.ts', import.meta.url), 'utf8');

for (const marker of [
  'ForgePageHeader', 'ForgeSelectControl', 'ForgeDateInput', 'ForgeDialog',
  '从物料库选择', '手动添加', '快速粘贴', 'saveDraft', '保存并提交审批',
  'purchase_request_submit', 'purchase_request_approve', 'purchase_request_reject',
]) assert.match(page, new RegExp(marker), `purchase request page missing ${marker}`);

for (const marker of ['entry_mode', 'category_name']) {
  assert.match(objects, new RegExp(marker), `purchase request model missing ${marker}`);
}
assert.match(actions, /手工明细必须填写物料名称、型号、物料分类和单位/);
assert.doesNotMatch(routing, /page_purchase_request_pool/, 'generic routing page must not shadow dedicated purchase request page');
assert.doesNotMatch(page, /alert\(|confirm\(|prompt\(/, 'browser-native dialogs are forbidden');
assert.match(page, /附件存储尚未接入/);

console.log('PASS purchase request is a dedicated executable page with mixed detail entry and approval actions');
