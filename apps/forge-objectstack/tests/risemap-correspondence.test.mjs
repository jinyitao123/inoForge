import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('./', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('risemap-correspondence.json', root), 'utf8'));
const references = JSON.parse(await readFile(new URL('../../../docs/risemap-feature-inventory.json', root), 'utf8'));

test('every Forge navigation entry remains pending until reviewed', () => {
  const entries = inventory.entries;
  assert.equal(entries.length, inventory.counts.forgeNavigationEntries);
  assert.equal(new Set(entries.map((entry) => entry.application + ':' + entry.navigationId)).size, entries.length);
  for (const entry of entries) {
    assert.equal(entry.interactionReview, 'pending');
    assert.equal(entry.businessReview, 'pending');
    assert.equal(entry.visualReview, 'pending');
    assert.ok(['explicit_candidate', 'exact_label_candidate', 'unmapped'].includes(entry.referenceMatch));
  }
  assert.equal(
    inventory.counts.explicitCandidates + inventory.counts.exactLabelCandidates + inventory.counts.unmapped,
    entries.length,
  );
});

test('reference candidates point to a known captured entry', () => {
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  for (const entry of inventory.entries) {
    if (!entry.referenceId) continue;
    assert.ok(byId.has(entry.referenceId), entry.referenceId);
    assert.equal(entry.referenceUrl, byId.get(entry.referenceId).url);
  }
});

test('five representative surfaces are listed without claiming acceptance', () => {
  const pilots = {
    'supply_chain:purchase_orders': 'RM-021',
    'sales:customers': 'RM-057',
    'project:projects': 'RM-094',
    'administration:my_approvals': 'RM-099',
    'reports:purchase_statistics': 'RM-150',
  };
  const byKey = new Map(inventory.entries.map((entry) => [entry.application + ':' + entry.navigationId, entry]));
  for (const [key, referenceId] of Object.entries(pilots)) {
    const entry = byKey.get(key);
    assert.ok(entry, key);
    assert.equal(entry.referenceId, referenceId);
    assert.equal(entry.referenceMatch, 'explicit_candidate');
    assert.equal(entry.interactionReview, 'pending');
  }
});
