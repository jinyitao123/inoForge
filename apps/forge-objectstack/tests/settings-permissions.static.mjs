import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../src/apps/application-navigation.json', import.meta.url), 'utf8'));
const permissions = await readFile(new URL('../src/permissions/application-settings.permission.ts', import.meta.url), 'utf8');
const salesPermissions = await readFile(new URL('../src/permissions/sales-contract.permission.ts', import.meta.url), 'utf8');
const settingsObjects = await readFile(new URL('../src/objects/business-setting.object.ts', import.meta.url), 'utf8');
const salesObjects = await readFile(new URL('../src/objects/sales.object.ts', import.meta.url), 'utf8');
const pageOwnership = await readFile(new URL('../src/apps/page-ownership.ts', import.meta.url), 'utf8');

const settingsGroups = {
  supply_chain: ['material_settings', 'inventory_settings'],
  sales: ['customer_settings', 'sales_contract_settings'],
  production: ['drawing_settings', 'production_settings', 'subcontract_settings'],
  project: ['project_business_settings'],
  administration: ['administration_settings', 'other_settings', 'hr_settings'],
  finance: ['settlement_condition_settings', 'finance_settings'],
  reports: [],
};
const managerCapabilities = {
  supply_chain: 'forge_supply_chain_settings_manage',
  sales: 'forge_sales_settings_manage',
  production: 'forge_production_settings_manage',
  project: 'forge_project_settings_manage',
  administration: 'forge_administration_settings_manage',
  finance: 'forge_finance_settings_manage',
};

function walk(items, visit) {
  for (const item of items ?? []) {
    visit(item);
    walk(item.children, visit);
  }
}

for (const application of nav.applications) {
  const key = application.key;
  const items = application.definition.areas.flatMap((area) => area.navigation);
  const byId = new Map();
  walk(items, (item) => {
    const entries = byId.get(item.id) ?? [];
    entries.push(item);
    byId.set(item.id, entries);
  });
  for (const groupId of settingsGroups[key] ?? []) {
    assert.ok(byId.get(groupId)?.some((item) => item.type === 'group' && item.requiredPermissions?.includes(managerCapabilities[key])), `${key}/${groupId} must be hidden without its exact settings capability`);
  }
  assert.ok(byId.get('document_printing')?.some((item) => item.type === 'group' && item.requiredPermissions?.includes('forge_print_settings_manage')), `${key} printing settings must use the shared print capability`);
}

const dictionaryGrantSets = [
  ['forge_material_category', 'forge_supply_chain_reference_reader'],
  ['forge_supplier_category', 'forge_supply_chain_reference_reader'],
  ['forge_supplier_level', 'forge_supply_chain_reference_reader'],
  ['forge_customer_category', 'sales_contract_operator'],
  ['forge_customer_level', 'sales_contract_operator'],
  ['forge_payment_condition', 'forge_production_reference_reader'],
  ['forge_quotation_type', 'sales_contract_operator'],
  ['forge_quotation_issuer', 'sales_contract_operator'],
  ['forge_warehouse_type', 'forge_supply_chain_reference_reader'],
];
for (const [objectName, permissionSetName] of dictionaryGrantSets) {
  assert.ok(permissions.includes(`    ${objectName}: orgRead,`) || salesPermissions.includes(`    ${objectName}: readOrganizationReferenceData,`), `${objectName} must have a named, organization-scoped read set`);
  assert.ok(permissions.includes(`name: '${permissionSetName}'`) || salesPermissions.includes(`name: '${permissionSetName}'`), `${permissionSetName} must be registered as the reader`);
}
assert.ok(permissions.includes('forge_unit: orgRead,'), 'unit read remains limited to the supply-chain reference set');
assert.ok(permissions.includes('forge_payment_condition: orgRead,'), 'production reads finance-owned payment conditions through an explicit read-only set');
assert.equal(settingsObjects.match(/sharingModel: 'private'/g)?.length, 4, 'all four maintenance-only shared settings objects require an explicit permission set');

const scopedStore = permissions.slice(permissions.indexOf('function scopedSettingsManager'), permissions.indexOf('export const supplyChainReferenceReaderPermission'));
assert.ok(scopedStore.includes('using: `scope =='), 'shared business settings reads must be filtered by app scope');
assert.ok(scopedStore.includes('check: `scope =='), 'shared business settings writes must be filtered by app scope');
assert.ok(!scopedStore.includes('viewAllRecords') && !scopedStore.includes('modifyAllRecords'), 'app settings must not bypass row-level scope');
for (const capability of Object.values(managerCapabilities)) assert.ok(permissions.includes(capability));

const followUpBlock = permissions.slice(permissions.indexOf('export const salesCustomerFollowUpOperatorPermission'), permissions.indexOf('export const productionSettingsManagerPermission'));
assert.ok(salesObjects.includes("customer_id: reference('forge_customer', '客户')"), 'sales follow-up must be a real customer-related record');
assert.ok(followUpBlock.includes('forge_sales_follow_up: {') && followUpBlock.includes('allowCreate: true') && followUpBlock.includes("readScope: 'own'"), 'the customer-related follow-up grant must only create/read the caller-owned child records');
assert.ok(!followUpBlock.includes('forge_contact:') && !followUpBlock.includes('forge_accounts_receivable:') && !followUpBlock.includes('forge_bom:'), 'no other customer related-list child gains create permission');
assert.ok(!followUpBlock.includes('forge_customer: orgManage'), 'the follow-up grant cannot create or edit customer master records');

assert.ok(pageOwnership.includes("page_onboarding_center: 'initialization guidance belongs to native Setup'"));
assert.ok(!nav.applications.some((application) => JSON.stringify(application.definition).includes('page_company_entities')),
  'the retired onboarding destination must not appear in any registered app navigation');

console.log('Settings access is app-scoped; nine dictionary reads, customer follow-up creation, and retired onboarding navigation are covered.');
