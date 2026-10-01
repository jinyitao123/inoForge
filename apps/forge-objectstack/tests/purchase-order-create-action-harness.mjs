import assert from 'node:assert/strict';
import { BomShortageCreatePurchaseOrder, PurchaseOrderCreate } from '../src/actions/procurement.action.ts';

const orderFields = [
  'supplier_order_number', 'currency', 'exchange_rate', 'payable_trigger',
  'settlement_on', 'arrival_address', 'order_on', 'unified_delivery_date',
  'supplier_confirmed_arrival_on',
];

for (const action of [PurchaseOrderCreate, BomShortageCreatePurchaseOrder]) {
  for (const field of orderFields) {
    assert.ok(action.params.some((param) => param.field === field && param.objectOverride === 'forge_purchase_order'), `${action.name} should expose ${field} from PurchaseOrder metadata`);
  }
  const expectedArrivalParam = action.params.find((param) => param.field === 'expected_arrival_on' || param.name === 'expected_arrival_on');
  assert.ok(expectedArrivalParam, `${action.name} should keep the order-level arrival date parameter`);
  assert.notEqual(expectedArrivalParam.required, true, `${action.name} must defer requiredness to the unified-mode Action validation`);
}
assert.ok(BomShortageCreatePurchaseOrder.params.some((param) => param.name === 'delivery_dates_json' && param.type === 'textarea'), 'BOM per-line overrides should use the constrained JSON parameter');

function makeContext(action, input, { existingOrders = [], shortageLines = null } = {}) {
  const writes = [];
  const analysis = { id: 'analysis-1', status: 'completed', bom_id: 'bom-1', project_id: 'project-1' };
  const shortageLine = {
    id: 'shortage-line-1', analysis_id: analysis.id, source_type: 'purchased', sku_id: 'sku-1',
    name: '轴承', item_code: 'BRG-01', model: '6204', specification: '6204', unit_name: '个',
    shortage_quantity: 2, untaxed_unit_price: 10,
  };
  const rowsByObject = {
    forge_bom_shortage_line: shortageLines ?? [shortageLine],
  };
  let sequence = 0;
  const api = {
    object(name) {
      return {
        async findOne({ where = {} } = {}) {
          if (name === 'forge_supplier' && where.id === 'supplier-1') return { id: 'supplier-1', name: '合规供应商', status: 'active', approval_status: 'approved' };
          if (name === 'forge_bom' && where.id === 'bom-1') return { id: 'bom-1', code: 'BOM-01', status: 'active', project_id: 'project-1', tax_rate: 13 };
          if (name === 'forge_bom_shortage_analysis' && where.id === analysis.id) return analysis;
          if (name === 'forge_material_sku' && where.id === 'sku-1') return { id: 'sku-1', material_id: 'material-1', name: '6204', code: 'BRG-01', enabled: true };
          if (name === 'forge_material' && where.id === 'material-1') return { id: 'material-1', name: '轴承', code: 'BRG-01', model: '6204', unit_name: '个', status: 'active' };
          if (name === 'forge_purchase_order' && where.shortage_analysis_id === analysis.id) return null;
          return null;
        },
        async find({ where = {} } = {}) {
          if (name === 'forge_purchase_order') {
            if (where.code) return existingOrders.filter((row) => row.code === where.code);
            return existingOrders;
          }
          if (name === 'forge_bom_shortage_line') return (rowsByObject[name] || []).filter((row) => row.analysis_id === where.analysis_id);
          return rowsByObject[name] || [];
        },
        async insert(value) {
          sequence += 1;
          const id = name === 'forge_purchase_order' ? `order-${sequence}` : `${name}-${sequence}`;
          writes.push({ object: name, value: { ...value }, id });
          return { id };
        },
      };
    },
  };
  const ctx = {
    session: { userId: 'user-1' },
    input,
    api,
    ...(action === BomShortageCreatePurchaseOrder ? { recordId: analysis.id, record: analysis } : {}),
  };
  const execute = new Function('ctx', `return (async function(){\n${action.body.source}\n})()`);
  return { execute: () => execute(ctx), writes };
}

const ordinaryBase = {
  mode: 'draft', source_type: 'inventory_replenishment', code: '', supplier_id: 'supplier-1',
  expected_arrival_on: '2026-11-15', payment_term: '30 days', payment_method: 'bank_transfer',
  lines_json: JSON.stringify([{ sku_id: 'sku-1', quantity: 2, taxed_unit_price: 20, tax_rate: 0 }]),
};

const ordinaryDefault = makeContext(PurchaseOrderCreate, ordinaryBase, { existingOrders: [{ code: 'PO-2026-0001' }] });
await ordinaryDefault.execute();
const ordinaryDefaultOrder = ordinaryDefault.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.equal(ordinaryDefaultOrder.code, 'PO-2026-0002', 'legacy blank-code input keeps the existing generator');
assert.deepEqual({
  supplier_order_number: ordinaryDefaultOrder.supplier_order_number,
  currency: ordinaryDefaultOrder.currency,
  exchange_rate: ordinaryDefaultOrder.exchange_rate,
  payable_trigger: ordinaryDefaultOrder.payable_trigger,
  settlement_on: ordinaryDefaultOrder.settlement_on,
  arrival_address: ordinaryDefaultOrder.arrival_address,
  order_on: ordinaryDefaultOrder.order_on,
  unified_delivery_date: ordinaryDefaultOrder.unified_delivery_date,
  supplier_confirmed_arrival_on: ordinaryDefaultOrder.supplier_confirmed_arrival_on,
}, {
  supplier_order_number: null, currency: 'cny', exchange_rate: 1, payable_trigger: 'inbound',
  settlement_on: null, arrival_address: null, order_on: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10),
  unified_delivery_date: true, supplier_confirmed_arrival_on: null,
});
assert.equal(ordinaryDefaultOrder.total_amount, 40, 'the default currency path keeps the original line amount calculation');
const ordinaryDefaultLine = ordinaryDefault.writes.find((entry) => entry.object === 'forge_purchase_order_line').value;
assert.deepEqual({ expected_arrival_on: ordinaryDefaultLine.expected_arrival_on, supplier_confirmed_arrival_on: ordinaryDefaultLine.supplier_confirmed_arrival_on }, {
  expected_arrival_on: ordinaryBase.expected_arrival_on, supplier_confirmed_arrival_on: null,
});

const explicitOrderFields = {
  supplier_order_number: 'SUP-PO-2026-31', currency: 'usd', exchange_rate: 7.123456,
  payable_trigger: 'invoice', settlement_on: '2026-12-20', arrival_address: '上海市浦东新区到货点',
  order_on: '2026-10-22', unified_delivery_date: true, supplier_confirmed_arrival_on: '2026-10-10',
};
const ordinaryExplicit = makeContext(PurchaseOrderCreate, { ...ordinaryBase, code: 'PO-EXPLICIT-01', ...explicitOrderFields });
await ordinaryExplicit.execute();
const ordinaryExplicitOrder = ordinaryExplicit.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.deepEqual(Object.fromEntries(orderFields.map((field) => [field, ordinaryExplicitOrder[field]])), explicitOrderFields);
assert.equal(ordinaryExplicitOrder.total_amount, 40, 'foreign-currency orders retain their entered-currency amount without exchange-rate multiplication');

const ordinaryUnifiedRows = makeContext(PurchaseOrderCreate, {
  ...ordinaryBase,
  code: 'PO-UNIFIED-ROWS',
  expected_arrival_on: '2026-11-15',
  supplier_confirmed_arrival_on: '2026-11-12',
  unified_delivery_date: true,
  lines_json: JSON.stringify([
    { sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0, expected_arrival_on: '2026-02-30', supplier_confirmed_arrival_on: 'not-a-date' },
    { sku_id: 'sku-1', quantity: 2, taxed_unit_price: 20, tax_rate: 0, expected_arrival_on: '2026-11-30', supplier_confirmed_arrival_on: '2026-11-28' },
  ]),
});
await ordinaryUnifiedRows.execute();
const ordinaryUnifiedLines = ordinaryUnifiedRows.writes.filter((entry) => entry.object === 'forge_purchase_order_line').map((entry) => entry.value);
assert.equal(ordinaryUnifiedLines.length, 2);
assert.deepEqual(ordinaryUnifiedLines.map((line) => [line.expected_arrival_on, line.supplier_confirmed_arrival_on]), [
  ['2026-11-15', '2026-11-12'], ['2026-11-15', '2026-11-12'],
], 'unified mode applies the header dates to every row');

const ordinaryWithoutHeaderDate = { ...ordinaryBase };
delete ordinaryWithoutHeaderDate.expected_arrival_on;
const ordinaryIndependentLinesJson = JSON.stringify([
  { sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0, expected_arrival_on: '2026-11-20', supplier_confirmed_arrival_on: '2026-11-18' },
  { sku_id: 'sku-1', quantity: 2, taxed_unit_price: 20, tax_rate: 0, expected_arrival_on: '2026-11-25', supplier_confirmed_arrival_on: '2026-11-22' },
]);
const ordinaryIndependentRows = makeContext(PurchaseOrderCreate, {
  ...ordinaryWithoutHeaderDate,
  code: 'PO-INDEPENDENT-ROWS', unified_delivery_date: false,
  lines_json: ordinaryIndependentLinesJson,
});
await ordinaryIndependentRows.execute();
const ordinaryIndependentOrder = ordinaryIndependentRows.writes.find((entry) => entry.object === 'forge_purchase_order').value;
const ordinaryIndependentLines = ordinaryIndependentRows.writes.filter((entry) => entry.object === 'forge_purchase_order_line').map((entry) => entry.value);
assert.equal(ordinaryIndependentOrder.expected_arrival_on, '2026-11-20', 'the order-level notice date is summarized from the earliest line when no header date is submitted');
assert.equal(ordinaryIndependentOrder.unified_delivery_date, false);
assert.equal(ordinaryIndependentOrder.supplier_confirmed_arrival_on, null, 'non-unified mode does not copy a header feedback date to the order');
assert.deepEqual(ordinaryIndependentLines.map((line) => [line.expected_arrival_on, line.supplier_confirmed_arrival_on]), [
  ['2026-11-20', '2026-11-18'], ['2026-11-25', '2026-11-22'],
], 'non-unified mode preserves each valid row date');

const ordinaryStaleHeader = makeContext(PurchaseOrderCreate, {
  ...ordinaryWithoutHeaderDate,
  code: 'PO-STALE-HEADER', expected_arrival_on: '2026-12-30', supplier_confirmed_arrival_on: '2026-12-28',
  unified_delivery_date: false, lines_json: ordinaryIndependentLinesJson,
});
await ordinaryStaleHeader.execute();
const ordinaryStaleHeaderOrder = ordinaryStaleHeader.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.equal(ordinaryStaleHeaderOrder.expected_arrival_on, '2026-11-20', 'a stale header date cannot change the non-unified earliest-date summary');
assert.equal(ordinaryStaleHeaderOrder.supplier_confirmed_arrival_on, null, 'a stale header feedback date cannot become a non-unified parent fact');

for (const invalidLines of [
  [{ sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0 }],
  [{ sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0, expected_arrival_on: '2026-02-30' }],
  [
    { sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0, expected_arrival_on: '2026-11-20' },
    { sku_id: 'sku-1', quantity: 1, taxed_unit_price: 10, tax_rate: 0, expected_arrival_on: '2026-11-21', supplier_confirmed_arrival_on: 'not-a-date' },
  ],
]) {
  const invalidRows = makeContext(PurchaseOrderCreate, {
    ...ordinaryWithoutHeaderDate, code: 'PO-INVALID-ROW-DATE', unified_delivery_date: false, lines_json: JSON.stringify(invalidLines),
  });
  await assert.rejects(invalidRows.execute(), undefined, 'non-unified ordinary rows require valid per-line dates');
  assert.equal(invalidRows.writes.length, 0, 'ordinary per-line date failure must happen before parent or line writes');
}
const ordinaryMissingUnifiedHeader = makeContext(PurchaseOrderCreate, {
  ...ordinaryBase, code: 'PO-MISSING-UNIFIED-HEADER', expected_arrival_on: '', unified_delivery_date: true,
});
await assert.rejects(ordinaryMissingUnifiedHeader.execute(), undefined, 'unified ordinary mode still requires the header expected date');
assert.equal(ordinaryMissingUnifiedHeader.writes.length, 0);

const bomDefault = makeContext(BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-DEFAULT', supplier_id: 'supplier-1', expected_arrival_on: '2026-11-15',
  payment_term: '30 days', payment_method: 'bank_transfer',
});
await bomDefault.execute();
const bomDefaultOrder = bomDefault.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.deepEqual({
  supplier_order_number: bomDefaultOrder.supplier_order_number,
  currency: bomDefaultOrder.currency,
  exchange_rate: bomDefaultOrder.exchange_rate,
  payable_trigger: bomDefaultOrder.payable_trigger,
  settlement_on: bomDefaultOrder.settlement_on,
  arrival_address: bomDefaultOrder.arrival_address,
  order_on: bomDefaultOrder.order_on,
  unified_delivery_date: bomDefaultOrder.unified_delivery_date,
  supplier_confirmed_arrival_on: bomDefaultOrder.supplier_confirmed_arrival_on,
}, {
  supplier_order_number: null, currency: 'cny', exchange_rate: 1, payable_trigger: 'inbound',
  settlement_on: null, arrival_address: null, order_on: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10),
  unified_delivery_date: true, supplier_confirmed_arrival_on: null,
});
assert.equal(bomDefaultOrder.status, 'pending_approval', 'BOM creation keeps its direct submit-to-approval behavior');
const bomDefaultLine = bomDefault.writes.find((entry) => entry.object === 'forge_purchase_order_line').value;
assert.deepEqual({ expected_arrival_on: bomDefaultLine.expected_arrival_on, supplier_confirmed_arrival_on: bomDefaultLine.supplier_confirmed_arrival_on }, {
  expected_arrival_on: '2026-11-15', supplier_confirmed_arrival_on: null,
});

const bomExplicit = makeContext(BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-EXPLICIT', supplier_id: 'supplier-1', expected_arrival_on: '2026-11-15',
  payment_term: '45 days', payment_method: 'wire_transfer', ...explicitOrderFields, delivery_dates_json: 'not parsed in unified mode',
});
await bomExplicit.execute();
const bomExplicitOrder = bomExplicit.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.deepEqual(Object.fromEntries(orderFields.map((field) => [field, bomExplicitOrder[field]])), explicitOrderFields);
assert.equal(bomExplicitOrder.total_amount, 22.6, 'BOM amounts remain in the selected order currency and keep existing tax math');
const bomExplicitLine = bomExplicit.writes.find((entry) => entry.object === 'forge_purchase_order_line').value;
assert.deepEqual({ expected_arrival_on: bomExplicitLine.expected_arrival_on, supplier_confirmed_arrival_on: bomExplicitLine.supplier_confirmed_arrival_on }, {
  expected_arrival_on: '2026-11-15', supplier_confirmed_arrival_on: explicitOrderFields.supplier_confirmed_arrival_on,
});

const bomSourceLines = [
  { id: 'analysis-line-a', analysis_id: 'analysis-1', source_type: 'purchased', sku_id: 'sku-1', name: '轴承 A', item_code: 'BRG-A', model: '6204', specification: '6204', unit_name: '个', shortage_quantity: 2, untaxed_unit_price: 10 },
  { id: 'analysis-line-b', analysis_id: 'analysis-1', source_type: 'purchased', sku_id: 'sku-1', name: '轴承 B', item_code: 'BRG-B', model: '6205', specification: '6205', unit_name: '个', shortage_quantity: 3, untaxed_unit_price: 12 },
];
const bomIndependentRows = makeContext(BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-INDEPENDENT', supplier_id: 'supplier-1',
  payment_term: '30 days', payment_method: 'bank_transfer', unified_delivery_date: false,
  delivery_dates_json: JSON.stringify([
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25', supplier_confirmed_arrival_on: '2026-11-23' },
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20', supplier_confirmed_arrival_on: '2026-11-18' },
  ]),
}, { shortageLines: bomSourceLines });
await bomIndependentRows.execute();
const bomIndependentOrder = bomIndependentRows.writes.find((entry) => entry.object === 'forge_purchase_order').value;
const bomIndependentLines = bomIndependentRows.writes.filter((entry) => entry.object === 'forge_purchase_order_line').map((entry) => entry.value);
assert.equal(bomIndependentOrder.expected_arrival_on, '2026-11-20', 'BOM order-level notice date is summarized from the earliest mapped line when the header date is absent');
assert.equal(bomIndependentOrder.unified_delivery_date, false);
assert.equal(bomIndependentOrder.supplier_confirmed_arrival_on, null, 'non-unified BOM mode does not copy a header feedback date to the order');
assert.deepEqual(Object.fromEntries(bomIndependentLines.map((line) => [line.source_analysis_line_id, [line.expected_arrival_on, line.supplier_confirmed_arrival_on, line.sku_id, line.quantity]])), {
  'analysis-line-a': ['2026-11-20', '2026-11-18', 'sku-1', 2],
  'analysis-line-b': ['2026-11-25', '2026-11-23', 'sku-1', 3],
}, 'BOM overrides map by source id and leave snapshot SKU and quantity unchanged');

const bomStaleHeader = makeContext(BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-STALE-HEADER', supplier_id: 'supplier-1', expected_arrival_on: '2026-12-30',
  supplier_confirmed_arrival_on: '2026-12-28', payment_term: '30 days', payment_method: 'bank_transfer',
  unified_delivery_date: false, delivery_dates_json: JSON.stringify([
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20', supplier_confirmed_arrival_on: '2026-11-18' },
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25', supplier_confirmed_arrival_on: '2026-11-23' },
  ]),
}, { shortageLines: bomSourceLines });
await bomStaleHeader.execute();
const bomStaleHeaderOrder = bomStaleHeader.writes.find((entry) => entry.object === 'forge_purchase_order').value;
assert.equal(bomStaleHeaderOrder.expected_arrival_on, '2026-11-20', 'a stale BOM header date cannot change the non-unified earliest-date summary');
assert.equal(bomStaleHeaderOrder.supplier_confirmed_arrival_on, null, 'a stale BOM header feedback date cannot become a non-unified parent fact');

for (const deliveryDates of [
  [{ source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20' }],
  [
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20' },
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-21' },
  ],
  [
    { source_analysis_line_id: 'not-in-snapshot', expected_arrival_on: '2026-11-20' },
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25' },
  ],
  [
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-02-30' },
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25' },
  ],
  [
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20', supplier_confirmed_arrival_on: '2026-02-30' },
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25' },
  ],
  [
    { source_analysis_line_id: 'analysis-line-a', expected_arrival_on: '2026-11-20', sku_id: 'sku-evil' },
    { source_analysis_line_id: 'analysis-line-b', expected_arrival_on: '2026-11-25' },
  ],
]) {
  const invalidBomOverrides = makeContext(BomShortageCreatePurchaseOrder, {
    code: 'PO-BOM-INVALID-DATE-MAP', supplier_id: 'supplier-1',
    payment_term: '30 days', payment_method: 'bank_transfer', unified_delivery_date: false,
    delivery_dates_json: JSON.stringify(deliveryDates),
  }, { shortageLines: bomSourceLines });
  await assert.rejects(invalidBomOverrides.execute(), undefined, 'BOM overrides must map exactly to the captured purchased shortage lines');
  assert.equal(invalidBomOverrides.writes.length, 0, 'invalid BOM date maps must be rejected before writes');
}
const bomMissingUnifiedHeader = makeContext(BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-MISSING-UNIFIED-HEADER', supplier_id: 'supplier-1', expected_arrival_on: '',
  payment_term: '30 days', payment_method: 'bank_transfer', unified_delivery_date: true,
});
await assert.rejects(bomMissingUnifiedHeader.execute(), undefined, 'unified BOM mode still requires the header expected date');
assert.equal(bomMissingUnifiedHeader.writes.length, 0);

for (const [action, base] of [[PurchaseOrderCreate, ordinaryBase], [BomShortageCreatePurchaseOrder, {
  code: 'PO-BOM-INVALID', supplier_id: 'supplier-1', expected_arrival_on: '2026-11-15', payment_term: '30 days', payment_method: 'bank_transfer',
}]]) {
  for (const invalid of [
    { currency: 'jpy' }, { payable_trigger: 'manual' }, { exchange_rate: 0 }, { currency: 'cny', exchange_rate: 2 },
    { exchange_rate: true }, { exchange_rate: 1.1234567 }, { expected_arrival_on: '2026-02-30' },
    { order_on: '2026-02-30' }, { settlement_on: '2026-02-30' },
  ]) {
    const harness = makeContext(action, { ...base, ...invalid });
    await assert.rejects(harness.execute(), undefined, `${action.name} should reject ${JSON.stringify(invalid)}`);
    assert.equal(harness.writes.length, 0, `${action.name} must not write when ${JSON.stringify(invalid)} is invalid`);
  }
}

process.stdout.write('PASS purchase-order create Actions persist declared commercial fields, preserve legacy defaults and source-specific line semantics, and reject invalid enum/date/rate input before writes\n');
