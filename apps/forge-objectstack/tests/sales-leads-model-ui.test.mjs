import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { SalesLeadsPage } from '../src/pages/sales-leads.page.ts';
import { SalesLeadViews } from '../src/views/sales-lead.view.ts';
import { SalesLead } from '../src/objects/sales.object.ts';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@objectstack/cli'));
const { transformSync } = cliRequire('esbuild');
const code = transformSync(SalesLeadsPage.source, { loader: 'jsx', format: 'cjs' }).code;

function harness({ recordStatus = 'converted' } = {}) {
  const slots = [], requests = [];
  let cursor = 0;
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        let value = typeof initial === 'function' ? initial() : initial;
        if (value?.loading === true) value = { ...value, loading: false, currentUserId: 'actor-1', users: [{ id: 'actor-1', name: '测试销售' }] };
        slots[index] = value;
      }
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback(callback) { cursor++; return callback; },
    useMemo(factory, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useEffect() { cursor++; },
  };
  const adapter = {
    baseUrl: 'http://forge.test/api/v1', getAuthHeaders: () => ({}),
    async fetchImpl(url, options = {}) {
      const pathname = new URL(url).pathname;
      requests.push({ pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
      const payload = pathname.endsWith('/auth/get-session') ? { user: { id: 'actor-1' } }
        : pathname.includes('/data/sys_user') ? { records: [{ id: 'actor-1', name: '测试销售' }] }
        : pathname.endsWith('/data/forge_sales_lead/lead-1') ? { record: { id: 'lead-1', name: '现场需求', code: 'LD-EDIT-1', company_name: '测试客户', status: recordStatus, converted_customer_id: 'customer-1', converted_opportunity_id: 'opportunity-1' } }
        : { record: { id: 'lead-created' } };
      return { ok: true, status: 200, json: async () => payload };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    React, module, exports: module.exports, useAdapter: () => adapter,
    ListView: 'ListView', ObjectForm: 'ObjectForm', CompositeDialog: 'CompositeDialog',
    URL, URLSearchParams, console, setTimeout, clearTimeout,
    window: { location: { origin: 'http://forge.test', pathname: '/_console/apps/com.inoforge.forge.sales/page_sales_leads', search: '' } },
  });
  return {
    requests,
    render() { cursor = 0; return module.exports.default(); },
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  if (node.type === 'CompositeDialog' && !node.props.open) return null;
  for (const child of node.props?.children || []) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}
const text = node => (node.props?.children || []).filter(value => typeof value === 'string').join('');
const component = (tree, type) => find(tree, node => node.type === type);
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node) === label);
function dialog(h, title) { return find(h.render(), node => node.type === 'CompositeDialog' && node.props.open && node.props.title === title); }
function footer(d) { return d.props.footer({ requestClose: () => d.props.onOpenChange(false) }); }

test('the lead list uses model columns, server pagination and functional scope filters', () => {
  const h = harness();
  let list = component(h.render(), 'ListView');
  assert.equal(list.props.data.object, 'forge_sales_lead');
  assert.equal(list.props.pagination.pageSize, 20);
  assert.deepEqual(JSON.parse(JSON.stringify(list.props.columns)), SalesLeadViews.list.columns);
  assert.ok(list.props.columns.every(column => Object.hasOwn(SalesLead.fields, column.field)));
  assert.equal(list.props.columns.some(column => ['score', 'estimated_amount', 'region'].includes(column.field)), false);
  list.props.onSearchChange('控制柜');
  button(h.render(), '我的线索').props.onClick();
  list = component(h.render(), 'ListView');
  assert.deepEqual(Array.from(list.props.filters), ['responsible_id', '=', 'actor-1']);
  assert.equal(list.props.initialSearchTerm, '控制柜');
  const currentFilters = list.props.filters;
  button(h.render(), '新建线索').props.onClick();
  component(dialog(h, '新建线索'), 'ObjectForm').props.onValuesChange({ name: '修改草稿' });
  assert.equal(component(h.render(), 'ListView').props.filters, currentFilters, 'editing a draft must keep the query scope stable');
  dialog(h, '新建线索').props.onOpenChange(false);
  button(h.render(), '线索公海').props.onClick();
  assert.deepEqual(Array.from(component(h.render(), 'ListView').props.filters), ['status', '=', 'public_pool']);
  button(h.render(), '全部线索').props.onClick();
  assert.equal(component(h.render(), 'ListView').props.filters, undefined);
  assert.equal(h.requests.length, 0, 'the page must not prefetch 500 leads and paginate locally');
});

test('model validation blocks writes, and confirmation persists only the validated form values', async () => {
  const h = harness();
  button(h.render(), '新建线索').props.onClick();
  let d = dialog(h, '新建线索');
  let form = component(d, 'ObjectForm');
  assert.equal(form.props.showSubmit, false);
  assert.equal(form.props.dataSource.baseUrl, 'http://forge.test/api/v1');
  form.props.onControllerReady({ validate: async () => ({ valid: false, formError: '请填写公司名称' }) });
  await button(footer(d), '下一步确认').props.onClick();
  assert.equal(h.requests.length, 0);
  d = dialog(h, '新建线索');
  assert.ok(component(d, 'ObjectForm'), 'an invalid form remains open');
  const values = { name: '控制柜扩容需求', code: 'LD-COMPONENT-001', company_name: '测试客户', contact_name: '测试联系人', remarks: '现场扩容' };
  form = component(d, 'ObjectForm');
  form.props.onValuesChange({ ...values, owner_id: 'must-not-forward' });
  form.props.onControllerReady({ validate: async () => ({ valid: true, values }) });
  await button(footer(dialog(h, '新建线索')), '下一步确认').props.onClick();
  assert.equal(h.requests.length, 0, 'validation and confirmation do not write');
  await button(footer(dialog(h, '新建线索')), '确认创建').props.onClick();
  const writes = h.requests.filter(request => request.method === 'POST');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, { ...values, status: 'new' });
  assert.equal(dialog(h, '新建线索'), null);
  assert.equal(component(h.render(), 'ListView').props.initialSearchTerm, values.code);
});

test('record selection reads authoritative detail including converted record links', async () => {
  const h = harness();
  await component(h.render(), 'ListView').props.onRowClick({ id: 'lead-1' });
  const d = dialog(h, '测试客户');
  const actions = footer(d);
  const customerLink = find(actions, node => node.type === 'a' && text(node) === '查看客户与跟进');
  assert.match(customerLink.props.href, /forge_customer\/record\/customer-1$/);
  assert.equal(button(actions, '转化为客户和商机'), null, 'converted leads cannot offer another conversion');
});

test('editing a lead assigns the selected owner without resetting its business state', async () => {
  const h = harness({ recordStatus: 'following' });
  await component(h.render(), 'ListView').props.onRowClick({ id: 'lead-1' });
  button(footer(dialog(h, '测试客户')), '编辑线索').props.onClick();
  let d = dialog(h, '编辑线索');
  assert.equal(d.props.confirmOnDiscard, false, 'opening an unchanged edit form is not a dirty draft');
  const form = component(d, 'ObjectForm');
  assert.equal(form.props.mode, 'edit');
  assert.equal(form.props.recordId, 'lead-1');
  const values = { name: '现场需求', code: 'LD-EDIT-1', company_name: '测试客户', responsible_id: 'actor-1' };
  form.props.onValuesChange(values);
  form.props.onControllerReady({ validate: async () => ({ valid: true, values }) });
  d = dialog(h, '编辑线索');
  assert.equal(d.props.confirmOnDiscard, true);
  await button(footer(d), '下一步确认').props.onClick();
  await button(footer(dialog(h, '编辑线索')), '确认保存').props.onClick();
  const updates = h.requests.filter(request => request.method === 'PATCH');
  assert.equal(updates.length, 1);
  assert.match(updates[0].pathname, /forge_sales_lead\/lead-1$/);
  assert.deepEqual(updates[0].body, values);
  assert.equal(Object.hasOwn(updates[0].body, 'status'), false);
});

test('a late validation result cannot reopen a cancelled draft or replace a new draft', async () => {
  const h = harness();
  button(h.render(), '新建线索').props.onClick();
  const first = dialog(h, '新建线索');
  let finishValidation;
  component(first, 'ObjectForm').props.onControllerReady({ validate: () => new Promise(resolve => { finishValidation = resolve; }) });
  const pending = button(footer(first), '下一步确认').props.onClick();
  first.props.onOpenChange(false);
  button(h.render(), '新建线索').props.onClick();
  component(dialog(h, '新建线索'), 'ObjectForm').props.onValuesChange({ name: '新草稿' });
  finishValidation({ valid: true, values: { name: '旧草稿', code: 'OLD', company_name: '旧客户' } });
  await pending;
  const current = dialog(h, '新建线索');
  assert.equal(component(current, 'ObjectForm').props.values.name, '新草稿');
  assert.ok(button(footer(current), '下一步确认'));
  assert.equal(h.requests.length, 0);
});
