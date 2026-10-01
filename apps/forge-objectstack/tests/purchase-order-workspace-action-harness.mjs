import assert from 'node:assert/strict';

const { PurchaseOrderWorkspacePage } = await import('../src/pages/purchase-order-workspace.page.ts');
const pageSource = PurchaseOrderWorkspacePage.source;
const loadNewStart = pageSource.indexOf('async function loadNew(){');
const loadNewEnd = pageSource.indexOf('\n  async function loadDetail', loadNewStart);
assert.ok(loadNewStart >= 0 && loadNewEnd > loadNewStart, 'the source-owned loadNew path should be extractable');
const loadNewSource = pageSource.slice(loadNewStart, loadNewEnd).trim();
const codeGeneratorStart = pageSource.indexOf('function forgeDocCode(');
const codeGeneratorEnd = pageSource.indexOf('\nfunction ForgeDateInput', codeGeneratorStart);
assert.ok(codeGeneratorStart >= 0 && codeGeneratorEnd > codeGeneratorStart, 'loadNew should use the existing forgeDocCode runtime helper');
const forgeDocCodeSource = pageSource.slice(codeGeneratorStart, codeGeneratorEnd).trim();
const forgeDocCode = new Function(`return (${forgeDocCodeSource});`)();
const functionStart = pageSource.indexOf('async function createOrder(mode){');
const functionEnd = pageSource.indexOf('\n  async function approve()', functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'the source-owned createOrder action should be extractable');
const createOrderSource = pageSource.slice(functionStart, functionEnd).trim();
assert.ok(pageSource.includes('<fieldset disabled={busy}'), 'busy state must disable native form controls without changing their readonly payload policy');
assert.ok(!pageSource.includes('readOnly={busy}'), 'busy state must not mark validated fields readonly');

function makeHarness({ sourceResult, informationResult, arrivalResult, form, analysis } = {}) {
  const state = { orders: [], analysis: analysis ?? null, analysisLines: analysis?.lines ?? [] };
  const calls = { actions: [], routes: [], toasts: [], busy: [], state: [] };
  const sourceController = { current: { validate: async () => sourceResult ?? { valid: true, values: { source_type: form.source_type } } } };
  const informationController = { current: { validate: async () => informationResult ?? { valid: true, values: {} } } };
  const arrivalController = { current: { validate: async () => arrivalResult ?? {
    valid: true, values: { expected_arrival_on: informationResult?.values?.expected_arrival_on ?? form?.expected_arrival_on },
  } } };
  const request = async (path, options) => {
    calls.actions.push({ path, options });
    return { id: 'created-order' };
  };
  const setState = (next) => calls.state.push(typeof next === 'function' ? next(state) : next);
  const setBusy = (value) => calls.busy.push(value);
  const createOrder = new Function(
    'sourceController', 'informationController', 'arrivalController', 'form', 'state', 'setBusy', 'setState',
    'forgeDocCode', 'request', 'resultId', 'setToast', 'route',
    `return (${createOrderSource});`,
  )(
    sourceController,
    informationController,
    arrivalController,
    form,
    state,
    setBusy,
    setState,
    () => 'PO-GENERATED',
    request,
    (payload) => payload?.id ?? null,
    (message) => calls.toasts.push(message),
    (...args) => calls.routes.push(args),
  );
  return { createOrder, calls };
}

async function runLoadNew({ code, orders, orderOn }) {
  let formState = { code, analysis_id: '', order_on: orderOn };
  let state = { loading: true, error: '', orders: [] };
  const calls = { fetches: [] };
  const setForm = (next) => { formState = typeof next === 'function' ? next(formState) : next; };
  const setState = (next) => { state = typeof next === 'function' ? next(state) : next; };
  const fetchAll = async (object) => {
    calls.fetches.push(object);
    return object === 'forge_purchase_order' ? orders : [];
  };
  const loadNew = new Function(
    'setState', 'setForm', 'fetchAll', 'form', 'params', 'forgeDocCode',
    `return (${loadNewSource});`,
  )(setState, setForm, fetchAll, formState, new URLSearchParams(), forgeDocCode);
  await loadNew();
  return { formState, state, calls };
}

const today = new Date().toISOString().slice(0, 10);
const year = today.slice(0, 4);
const existingOrders = [{ code: `PO-${year}-0001` }, { code: `PO-${year}-0010` }];
const expectedCandidate = forgeDocCode('PO', existingOrders.map((order) => order.code), today);
const generated = await runLoadNew({ code: '', orders: existingOrders });
assert.equal(generated.formState.code, expectedCandidate, 'loadNew should prefill the existing date-scoped next code when the current code is blank');
assert.deepEqual(generated.calls.fetches.slice(0, 1), ['forge_purchase_order'], 'loadNew should derive the candidate from the orders it reads');
assert.equal(generated.state.error, '', 'candidate generation should not put loadNew into its error state');
assert.equal(generated.formState.order_on, new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10), 'new form shows the same business day default as the formal Action');

const manual = await runLoadNew({ code: 'PO-MANUAL-99', orders: existingOrders, orderOn: '2026-09-30' });
assert.equal(manual.formState.code, 'PO-MANUAL-99', 'loadNew must preserve a nonblank manually entered code');
assert.equal(manual.formState.order_on, '2026-09-30', 'loading metadata must preserve an explicitly entered document date');
assert.equal(manual.state.error, '', 'preserving a manual code should leave loadNew successful');

const ordinary = makeHarness({
  form: {
    source_type: 'inventory_replenishment',
    code: 'stale-code',
    expected_arrival_on: '2026-10-10',
    payment_term: 'stale term',
    payment_method: 'cash',
    remarks: 'stale remarks',
    supplier_id: 'supplier-approved',
    warehouse_id: 'warehouse-main',
    project_id: 'project-1',
    purchase_request_id: '',
    lines: [{ sku_id: 'sku-1', quantity: '2', taxed_unit_price: '12.50', tax_rate: '13' }],
  },
  sourceResult: { valid: true, values: { source_type: 'inventory_replenishment' } },
  informationResult: {
    valid: true,
    values: {
      code: 'PO-NATIVE-01',
      expected_arrival_on: '2026-10-15',
      payment_term: '30 days',
      payment_method: 'bank_transfer',
      remarks: 'validated ObjectForm values',
    },
  },
});
await ordinary.createOrder('draft');
assert.equal(ordinary.calls.actions.length, 1);
assert.equal(ordinary.calls.actions[0].path, '/actions/forge_purchase_order/purchase_order_create');
assert.deepEqual(JSON.parse(ordinary.calls.actions[0].options.body).params, {
  mode: 'draft',
  source_type: 'inventory_replenishment',
  code: 'PO-NATIVE-01',
  supplier_id: 'supplier-approved',
  warehouse_id: 'warehouse-main',
  expected_arrival_on: '2026-10-15',
  payment_term: '30 days',
  payment_method: 'bank_transfer',
  project_id: 'project-1',
  purchase_request_id: null,
  remarks: 'validated ObjectForm values',
  lines_json: JSON.stringify([{ sku_id: 'sku-1', quantity: 2, taxed_unit_price: 12.5, tax_rate: 13 }]),
});
assert.deepEqual(ordinary.calls.routes, [['detail', 'created-order']]);
assert.deepEqual(ordinary.calls.busy, [true, false]);

for (const [section, sourceResult, informationResult] of [
  ['source', { valid: false, errors: {}, formError: '来源表单仍在加载。' }, { valid: true, values: {} }],
  ['information', { valid: true, values: { source_type: 'inventory_replenishment' } }, { valid: false, errors: {}, formError: '主单表单仍在加载。' }],
]) {
  const blocked = makeHarness({
    form: { source_type: 'inventory_replenishment', supplier_id: 'supplier-approved', lines: [] },
    sourceResult,
    informationResult,
  });
  await blocked.createOrder('submit');
  assert.equal(blocked.calls.actions.length, 0, `${section} controller failure must block the business action`);
  assert.equal(blocked.calls.state.at(-1)?.error, sourceResult.formError ?? informationResult.formError);
  assert.deepEqual(blocked.calls.busy, [true, false]);
}

const shortage = makeHarness({
  form: {
    source_type: 'bom_shortage',
    code: 'stale-code',
    expected_arrival_on: '2026-10-10',
    payment_term: 'stale term',
    payment_method: 'cash',
    remarks: 'stale remarks',
    supplier_id: 'supplier-approved',
    warehouse_id: 'warehouse-main',
    lines: [],
  },
  sourceResult: { valid: true, values: { source_type: 'bom_shortage' } },
  informationResult: {
    valid: true,
    values: {
      code: 'PO-BOM-01',
      expected_arrival_on: '2026-10-20',
      payment_term: 'upon receipt',
      payment_method: 'bank_transfer',
      remarks: 'validated BOM header',
    },
  },
  analysis: { id: 'analysis-42' },
});
await shortage.createOrder('submit');
assert.equal(shortage.calls.actions.length, 1);
assert.equal(shortage.calls.actions[0].path, '/actions/forge_bom_shortage_analysis/bom_shortage_create_purchase_order/analysis-42');
assert.deepEqual(JSON.parse(shortage.calls.actions[0].options.body).params, {
  code: 'PO-BOM-01',
  supplier_id: 'supplier-approved',
  warehouse_id: 'warehouse-main',
  expected_arrival_on: '2026-10-20',
  payment_term: 'upon receipt',
  payment_method: 'bank_transfer',
  remarks: 'validated BOM header',
});

const invalidArrival = makeHarness({
  form: { source_type: 'inventory_replenishment' },
  arrivalResult: { valid: false, errors: {}, formError: 'Arrival controls are not ready' },
});
await invalidArrival.createOrder('draft');
assert.equal(invalidArrival.calls.actions.length, 0);
assert.equal(invalidArrival.calls.state.at(-1).error, 'Arrival controls are not ready');

const datedLines = [{ sku_id: 'sku-1', quantity: '2', taxed_unit_price: '12.50', tax_rate: '13', expected_arrival_on: '2026-10-18', supplier_confirmed_arrival_on: '2026-10-19' }];
const dated = makeHarness({
  form: { source_type: 'inventory_replenishment', supplier_id: 'supplier-approved', supplier_confirmed_arrival_on: 'stale date', lines: datedLines },
  informationResult: { valid: true, values: { code: 'PO-DATED-01', payment_term: '30 days', payment_method: 'bank_transfer' } },
  arrivalResult: { valid: true, values: { unified_delivery_date: false, expected_arrival_on: '2026-10-18', supplier_confirmed_arrival_on: '2026-10-20' } },
});
await dated.createOrder('draft');
const datedParams = JSON.parse(dated.calls.actions[0].options.body).params;
assert.equal(datedParams.unified_delivery_date, false);
assert.equal(Object.hasOwn(datedParams, 'supplier_confirmed_arrival_on'), false, 'non-unified mode must not forward hidden header feedback');
assert.equal(Object.hasOwn(datedParams, 'expected_arrival_on'), false, 'non-unified mode lets the Action derive the required order date from line dates');
assert.equal(JSON.parse(datedParams.lines_json)[0].supplier_confirmed_arrival_on, '2026-10-19', 'independent line date must survive Page serialization');

const bomDated = makeHarness({
  form: { source_type: 'bom_shortage', supplier_id: 'supplier-approved', lines: [], bom_delivery_dates: [{ source_analysis_line_id: 'shortage-1', expected_arrival_on: '2026-10-22', supplier_confirmed_arrival_on: '2026-10-23' }] },
  informationResult: { valid: true, values: { code: 'PO-BOM-DATED-01', payment_term: '30 days', payment_method: 'bank_transfer' } },
  arrivalResult: { valid: true, values: { unified_delivery_date: false, expected_arrival_on: '2026-10-20' } },
  analysis: { id: 'analysis-42', lines: [{ id: 'shortage-1' }] },
});
await bomDated.createOrder('submit');
assert.deepEqual(JSON.parse(JSON.parse(bomDated.calls.actions[0].options.body).params.delivery_dates_json), [{ source_analysis_line_id: 'shortage-1', expected_arrival_on: '2026-10-22', supplier_confirmed_arrival_on: '2026-10-23' }]);

const bulkStart = pageSource.indexOf('function prepareLineBulkPatch(');
const bulkEnd = pageSource.indexOf('function LineBulkToolbar(', bulkStart);
assert.ok(bulkStart >= 0 && bulkEnd > bulkStart);
const bulkPatch = new Function('return (' + pageSource.slice(bulkStart, bulkEnd).trim() + ');')();
const priceRows = [{ taxed_unit_price: 100, untaxed_unit_price: 88.4956, tax_rate: 13 }, { taxed_unit_price: 200, untaxed_unit_price: 200, tax_rate: 0 }];
const beforeBulk = JSON.stringify(priceRows);
assert.deepEqual(bulkPatch(priceRows, { field: 'taxed_unit_price', mode: 'add', value: '10' }).patches.map(row => row.taxed_unit_price), [110, 210]);
assert.deepEqual(bulkPatch(priceRows, { field: 'taxed_unit_price', mode: 'subtract', value: '10' }).patches.map(row => row.taxed_unit_price), [90, 190]);
assert.deepEqual(bulkPatch(priceRows, { field: 'taxed_unit_price', mode: 'increase', value: '10' }).patches.map(row => row.taxed_unit_price), [110, 220]);
assert.deepEqual(bulkPatch(priceRows, { field: 'taxed_unit_price', mode: 'decrease', value: '10' }).patches.map(row => row.taxed_unit_price), [90, 180]);
assert.deepEqual(bulkPatch(priceRows, { field: 'untaxed_unit_price', mode: 'add', value: '10' }).patches[0], { untaxed_unit_price: 98.4956, taxed_unit_price: 111.3 });
assert.equal(bulkPatch(priceRows, { field: 'tax_rate', value: '0' }).patches[0].untaxed_unit_price, 100);
assert.deepEqual(bulkPatch(priceRows, { field: 'quantity', value: '3.5' }).patches, [{ quantity: 3.5 }, { quantity: 3.5 }]);
for (const edit of [{ field: 'taxed_unit_price', mode: 'subtract', value: '150' }, { field: 'quantity', value: '0' }, { field: 'quantity', value: '' }, { field: 'tax_rate', value: '101' }]) {
  const result = bulkPatch(priceRows, edit);
  assert.ok(result.error);
  assert.equal(result.patches, undefined, 'one invalid selected row must reject the entire bulk operation before mutation');
}
assert.equal(JSON.stringify(priceRows), beforeBulk, 'bulk preparation must not mutate draft rows');

process.stdout.write('PASS extracted purchase-order Page loadNew, validated headers, independent line delivery dates, and ordinary/BOM action payloads\n');
