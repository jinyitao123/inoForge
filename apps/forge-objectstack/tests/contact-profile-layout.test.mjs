import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { contactProfileRuntime } from '../src/pages/contact-profile.page.ts';
import { ContactViews } from '../src/views/customer.view.ts';

const require = createRequire(import.meta.url);
const { transformSync } = createRequire(require.resolve('@objectstack/cli'))('esbuild');
const code = transformSync(`${contactProfileRuntime}\nexport default ContactProfileEditor;`, { loader: 'jsx', format: 'cjs' }).code;
function harness(row = { id: 'contact-1', name: 'Test contact', remarks: 'Original note', updated_at: '2026-10-02T00:00:00Z' }) {
  const slots = [], requests = [];
  let cursor = 0, saves = 0;
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect() { cursor++; },
    useCallback(callback) { cursor++; return callback; },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { React, module, exports: module.exports, useAdapter: () => ({}),
    ObjectForm: 'ObjectForm', CompositeDialog: 'CompositeDialog', RelationshipCollectionEditor: 'RelationshipCollectionEditor', ForgeNotice: 'ForgeNotice',
    ForgeApiRequest: async (_adapter, url, options) => requests.push({ url, body: JSON.parse(options.body) }),
  });
  return { requests, get saves() { return saves; }, render() { cursor = 0; return module.exports.default({ row, channels: [], currentUserId: 'actor-1', onClose() {}, onSaved() { saves++; } }); } };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  return [...(tree.type === type ? [tree] : []), ...(tree.props?.children || []).flatMap(child => nodes(child, type))];
}
function wire(tree, { notesValid = true } = {}) {
  for (const form of nodes(tree, 'ObjectForm')) form.props.onControllerReady({ validate: async () => ({ valid: form.props.fields.includes('remarks') ? notesValid : true, values: Object.fromEntries(form.props.fields.map(field => [field, form.props.values[field]])) }) });
  const channels = nodes(tree, 'RelationshipCollectionEditor')[0];
  channels.props.onControllerReady({ validate: async () => ({ valid: true, draft: { rows: channels.props.value.filter(channels.props.includeRow) } }) });
}

test('standalone profile keeps two-column employment fields separate from embedded four-column contacts', () => {
  assert.equal(ContactViews.form.columns, 4);
  assert.equal(ContactViews.formViews.profile.columns, 2);
  const h = harness(), tree = h.render();
  assert.equal(tree.props.sidebarLabel, '联系人摘要');
  assert.equal(nodes(tree, 'ObjectForm').length, 2);
  assert.equal(nodes(tree, 'ObjectForm')[0].props.columns, 2);
  assert.equal(nodes(tree, 'RelationshipCollectionEditor')[0].props.primaryField, 'is_primary');
});

test('employment and note controllers preserve sibling draft fields and save only one action', async () => {
  const h = harness();
  let forms = nodes(h.render(), 'ObjectForm');
  forms[0].props.onValuesChange({ name: 'Updated contact' });
  forms = nodes(h.render(), 'ObjectForm');
  forms[1].props.onValuesChange({ remarks: 'Updated note' });
  const tree = h.render(); wire(tree);
  await tree.props.footer({ requestClose() {} }).props.onSave();
  assert.equal(h.requests.length, 1);
  const header = JSON.parse(h.requests[0].body.params.header_json);
  assert.equal(header.name, 'Updated contact');
  assert.equal(header.remarks, 'Updated note');
  assert.equal(header.expected_updated_at, '2026-10-02T00:00:00Z');
  assert.equal(h.saves, 1);
});

test('invalid supplemental form prevents a write and blank initial channels are omitted', async () => {
  const h = harness(null), tree = h.render();
  const channels = nodes(tree, 'RelationshipCollectionEditor')[0];
  assert.equal(channels.props.value.length, 3);
  assert.equal(channels.props.value.filter(channels.props.includeRow).length, 0);
  wire(tree, { notesValid: false });
  await tree.props.footer({ requestClose() {} }).props.onSave();
  assert.equal(h.requests.length, 0);
});
