import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(appDir, 'src/permissions/sales-business-auditor.permission.ts'), 'utf8');
const objectBlock = source.match(/objects:\s*\{([\s\S]*?)\n\s*\},\n\}\);/);
assert.ok(objectBlock, 'The scene auditor must declare a bounded object permission map');
assert.deepEqual(
  [...objectBlock[1].matchAll(/^\s*(forge_[a-z_]+):\s*organizationRead,\s*$/gm)].map(match => match[1]).sort(),
  [
    'forge_customer', 'forge_quotation', 'forge_quotation_line', 'forge_sales_contract',
    'forge_sales_contract_line', 'forge_sales_lead', 'forge_sales_opportunity',
  ],
  'The reviewer may read only the seven business objects required by the three scenes',
);
assert.match(source, /const organizationRead = \{ allowRead: true, readScope: 'org' as const \}/);
assert.doesNotMatch(objectBlock[1], /sys_|['"]\*['"]|allowCreate|allowEdit|allowDelete|allowTransfer|viewAllRecords|modifyAllRecords/);
console.log('PASS sales business auditor is limited to seven organization-scoped read-only business objects');
