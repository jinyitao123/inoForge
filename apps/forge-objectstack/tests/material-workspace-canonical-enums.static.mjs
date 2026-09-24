import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [model, object, page] = await Promise.all([
  readFile(path.join(appDir, 'src/model.ts'), 'utf8'),
  readFile(path.join(appDir, 'src/objects/material.object.ts'), 'utf8'),
  readFile(path.join(appDir, 'src/pages/material-workspace.page.ts'), 'utf8'),
]);
assert.match(model, /贸易商品: 'traded'/);
assert.match(model, /备件: 'spare'/);
assert.match(model, /外协: 'subcontracted'/);
assert.match(object, /choice\('物料属性', materialPropertyLabels/);
assert.match(object, /choice\('来源类型', materialSourceTypeLabels/);
assert.match(page, /materialPropertyOptions, materialSourceTypeOptions/);
assert.match(page, /ForgeApiRequest\(adapter,path/);
assert.doesNotMatch(page, /trade_goods|spare_part|'outsourced'/);
console.log('PASS material choices reuse canonical model codes and the shared API error handler');
