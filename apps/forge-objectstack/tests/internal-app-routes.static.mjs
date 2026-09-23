#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const artifactPath = new URL('../dist/objectstack.json', import.meta.url);
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
const bundles = (artifact.plugins ?? []).map((plugin) => plugin.bundle).filter(Boolean);
const pageOwnerByName = new Map();
const appIds = new Set();

for (const bundle of bundles) {
  const packageId = bundle.manifest?.id;
  if (bundle.manifest?.type === 'app' && packageId) appIds.add(packageId);
  for (const page of bundle.pages ?? []) {
    assert.ok(page.name, 'compiled Page is missing its name');
    assert.ok(!pageOwnerByName.has(page.name), `duplicate compiled Page ${page.name}`);
    pageOwnerByName.set(page.name, packageId);
  }
}

assert.equal(appIds.size, 7, 'expected the seven Forge business App packages');
assert.ok(pageOwnerByName.size > 0, 'compiled artifact must contain registered Pages');

function stringsIn(value, result = []) {
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => stringsIn(entry, result));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => stringsIn(entry, result));
  }
  return result;
}

const coreBundle = bundles.find((bundle) => bundle.manifest?.id === 'forge');
assert.ok(coreBundle, 'compiled artifact must contain the shared Forge business core');

const coreRouteStrings = stringsIn([coreBundle.actions ?? [], coreBundle.flows ?? []]);
for (const value of coreRouteStrings) {
  assert.ok(
    !value.includes('/_console/apps/forge/'),
    `Action/Flow still points at the shared core as a visible App: ${value.slice(0, 180)}`,
  );
}

const pageRoutePattern = /\/_console\/apps\/([a-z0-9.-]+)\/(page_[a-z0-9_]+)/g;
let checkedPageRoutes = 0;
function checkPageRoutes(source) {
  for (const match of source.matchAll(pageRoutePattern)) {
    const [, packageId, pageName] = match;
    assert.ok(appIds.has(packageId), `Page route uses an unknown App package ${packageId}`);
    assert.equal(
      pageOwnerByName.get(pageName),
      packageId,
      `${pageName} must be routed through its owning App package`,
    );
    checkedPageRoutes += 1;
  }
}

for (const bundle of bundles.filter((candidate) => candidate.manifest?.type === 'app')) {
  for (const source of stringsIn(bundle.pages ?? [])) {
    assert.ok(
      !/\/_console\/apps\/forge\/page\/(page_[a-z0-9_]+)/.test(source),
      'compiled Page still contains an old shared-core Page route',
    );
    assert.ok(
      !/forgeBase\s*\+\s*['"]\/page\/(page_[a-z0-9_]+)/.test(source),
      'compiled Page still builds a legacy /page/page_* URL from forgeBase',
    );
    checkPageRoutes(source);
  }
}

for (const source of coreRouteStrings) checkPageRoutes(source);

const objectRouteOwnerByName = new Map([
  ['forge_bom', 'com.inoforge.forge.supply-chain'],
  ['forge_sales_contract', 'com.inoforge.forge.sales'],
  ['forge_sales_order', 'com.inoforge.forge.sales'],
  ['forge_sales_shipment', 'com.inoforge.forge.sales'],
  ['forge_sales_outbound', 'com.inoforge.forge.supply-chain'],
  ['forge_sales_invoice', 'com.inoforge.forge.finance'],
  ['forge_cash_receipt', 'com.inoforge.forge.finance'],
  ['forge_collection_allocation', 'com.inoforge.forge.finance'],
  ['forge_purchase_invoice', 'com.inoforge.forge.finance'],
  ['forge_project', 'com.inoforge.forge.project'],
  ['forge_project_plan', 'com.inoforge.forge.project'],
]);
let checkedObjectRoutes = 0;
const objectRoutePattern = /\/_console\/apps\/([a-z0-9.-]+)\/([a-z][a-z0-9_]*)\/record\//g;
for (const source of coreRouteStrings) {
  for (const [, packageId, objectName] of source.matchAll(objectRoutePattern)) {
    assert.ok(appIds.has(packageId), `Record route uses an unknown App package ${packageId}`);
    assert.equal(
      objectRouteOwnerByName.get(objectName),
      packageId,
      `${objectName} record route must use its business App package`,
    );
    checkedObjectRoutes += 1;
  }
}

assert.ok(checkedPageRoutes > 0, 'expected to validate compiled Page-to-App routes');
assert.ok(checkedObjectRoutes > 0, 'expected to validate compiled Action record routes');
console.log(
  `PASS compiled ${pageOwnerByName.size} registered Pages across ${appIds.size} Apps; ${checkedPageRoutes} Page routes and ${checkedObjectRoutes} Action record routes resolve to their business App`,
);
