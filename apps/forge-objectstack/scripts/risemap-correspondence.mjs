#!/usr/bin/env node
// Build the Forge navigation ↔ RISEMAP reference candidate inventory.
// Exact-label matches are leads for review, never acceptance evidence.

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { flattenApplicationNavigation } from '../src/apps/navigation.ts';
import { forgePageNamesByApplication, forgePageDefinitionCount } from '../src/apps/page-ownership.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const references = JSON.parse(await readFile(path.join(root, '../../docs/risemap-feature-inventory.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(root, 'tests/risemap-correspondence-overrides.json'), 'utf8'));
const navigation = flattenApplicationNavigation();
const categoryByApplication = {
  supply_chain: '供应链', sales: '销售', production: '生产', project: '项目',
  administration: '行政', finance: '财务', reports: '报表',
};
const normalize = (value) => String(value || '').replace(/[\s／/（）()·_-]+/g, '').toLowerCase();
const referenceById = new Map(references.map((item) => [item.id, item]));
const navigationByKey = new Map(navigation.map((item) => [item.application + ':' + item.id, item]));

assert.equal(navigationByKey.size, navigation.length, 'Navigation IDs must be unique within each application');
assert.equal(new Set(references.map((item) => item.id)).size, references.length, 'RISEMAP IDs must be unique');

for (const [key, referenceId] of Object.entries(overrides)) {
  assert.ok(navigationByKey.has(key), `Unknown Forge navigation entry: ${key}`);
  assert.ok(referenceById.has(referenceId), `Unknown RISEMAP reference ID: ${referenceId}`);
}

const rows = navigation.map((item) => {
  const key = item.application + ':' + item.id;
  const explicit = overrides[key];
  const label = normalize(item.label);
  const candidates = references.filter((reference) =>
    reference.category === categoryByApplication[item.application]
    && normalize(reference.name) === label,
  );
  const referenceId = explicit || (candidates.length === 1 ? candidates[0].id : null);
  const reference = referenceId ? referenceById.get(referenceId) : null;
  return {
    application: item.application,
    navigationId: item.id,
    navigationLabel: item.label || null,
    areaId: item.areaId,
    surfaceType: item.type,
    target: item.target || null,
    referenceId,
    referenceMatch: explicit ? 'explicit_candidate' : reference ? 'exact_label_candidate' : 'unmapped',
    referenceName: reference?.name || null,
    referenceUrl: reference?.url || null,
    referenceCaptureStatus: reference?.status || null,
    interactionReview: 'pending',
    businessReview: 'pending',
    visualReview: 'pending',
  };
});

const navigatedPages = new Set(rows.filter((row) => row.surfaceType === 'page').map((row) => row.target));
const registeredPages = Object.entries(forgePageNamesByApplication).flatMap(([application, names]) =>
  names.map((name) => ({ application, name, inNavigation: navigatedPages.has(name) })),
);
assert.equal(registeredPages.length, forgePageDefinitionCount, 'Registered Page ownership count differs');

const inventory = {
  schemaVersion: 1,
  meaning: 'Reference matches are candidates only; every review state starts pending.',
  counts: {
    forgeNavigationEntries: rows.length,
    registeredPages: registeredPages.length,
    unnavigatedRegisteredPages: registeredPages.filter((page) => !page.inNavigation).length,
    risemapReferenceEntries: references.length,
    explicitCandidates: rows.filter((row) => row.referenceMatch === 'explicit_candidate').length,
    exactLabelCandidates: rows.filter((row) => row.referenceMatch === 'exact_label_candidate').length,
    unmapped: rows.filter((row) => row.referenceMatch === 'unmapped').length,
  },
  entries: rows,
  unnavigatedRegisteredPages: registeredPages.filter((page) => !page.inNavigation),
};

const output = JSON.stringify(inventory, null, 2) + '\n';
const outputPath = path.join(root, 'tests/risemap-correspondence.json');
if (process.argv.includes('--write')) {
  await writeFile(outputPath, output);
  process.stdout.write(JSON.stringify(inventory.counts) + '\n');
} else if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8');
  assert.equal(current, output, 'Correspondence inventory is stale; regenerate it with --write');
  process.stdout.write(JSON.stringify(inventory.counts) + '\n');
} else {
  process.stdout.write(output);
}
