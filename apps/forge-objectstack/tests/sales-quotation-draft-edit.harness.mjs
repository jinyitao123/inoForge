import assert from 'node:assert/strict';
import { SalesQuotationDraftUpdateHeader } from '../src/actions/sales-quotation-draft-edit.action.ts';

const actor = 'sales-user-1';
const organizationId = 'org-1';
const version = '2026-10-01T12:00:00.123Z';
const nextVersion = '2026-10-01T12:00:00.124Z';

assert.equal(SalesQuotationDraftUpdateHeader.name, 'sales_quotation_draft_update_header');
assert.deepEqual(SalesQuotationDraftUpdateHeader.requiredPermissions, ['sales_quotation_draft_create']);
assert.ok(SalesQuotationDraftUpdateHeader.params.some(param => param.name === 'expected_updated_at' && param.required));
assert.deepEqual(
  SalesQuotationDraftUpdateHeader.params.map(param => param.name),
  ['expected_updated_at', 'name', 'valid_until', 'payment_term', 'remarks'],
);

function makeQuote(overrides = {}) {
  return {
    id: 'quote-1',
    organization_id: organizationId,
    owner_id: actor,
    responsible_id: actor,
    status: 'draft',
    updated_at: version,
    name: '控制柜报价草稿',
    quotation_date: '2026-10-01',
    valid_until: '2026-10-31',
    payment_term: '待协商',
    remarks: '初始备注',
    customer_id: 'customer-1',
    contact_id: 'contact-1',
    opportunity_id: 'opportunity-1',
    pricing_version: 2,
    item_count: 2,
    subtotal: 1000,
    discount_amount: 0,
    tax_amount: 130,
    total_amount: 1130,
    ...overrides,
  };
}

function matches(row, where) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (key === 'updated_at' && expected && typeof expected === 'object') {
      const value = Date.parse(actual);
      return value >= Date.parse(expected.$gte) && value < Date.parse(expected.$lt);
    }
    return actual === expected;
  });
}

function makeContext({
  quote = makeQuote(),
  input = {
    expected_updated_at: version,
    name: '控制柜报价草稿（修订）',
    valid_until: '2026-11-15',
    payment_term: '验收后30天',
    remarks: '等待客户确认交期',
  },
  session = { userId: actor, organizationId },
  recordLoadDenied = false,
  record,
  raceBeforeConditionalUpdate,
  updateTimestamp = nextVersion,
} = {}) {
  const state = { quote: structuredClone(quote), updateCalls: [], readCalls: [], transactionCalls: 0 };
  let inTransactionWrites = 0;
  const quotationApi = {
    async findOne({ where = {}, fields } = {}) {
      state.readCalls.push({ where: structuredClone(where), fields: fields ? [...fields] : undefined });
      if (where.id !== state.quote.id) return null;
      return structuredClone(state.quote);
    },
    async update(patch, options = {}) {
      state.updateCalls.push({ patch: structuredClone(patch), options: structuredClone(options) });
      assert.equal(options.multi, true, 'CAS must use ObjectQL predicate-update mode');
      assert.equal(Object.hasOwn(patch, 'id'), false, 'predicate update payload must not switch to by-id mode');
      await raceBeforeConditionalUpdate?.(state);
      if (!matches(state.quote, options.where || {})) return 0;
      state.quote = { ...state.quote, ...structuredClone(patch), updated_at: updateTimestamp };
      inTransactionWrites += 1;
      return 1;
    },
  };
  const ctx = {
    recordId: 'quote-1',
    record: structuredClone(record || quote),
    recordLoadDenied,
    session,
    input: structuredClone(input),
    api: {
      object(name) {
        assert.equal(name, 'forge_quotation');
        return quotationApi;
      },
      async transaction(callback) {
        state.transactionCalls += 1;
        const before = structuredClone(state.quote);
        const writesBefore = inTransactionWrites;
        try {
          return await callback();
        } catch (error) {
          if (inTransactionWrites > writesBefore) state.quote = before;
          throw error;
        }
      },
    },
  };
  const execute = new Function('ctx', `return (async function(input,ctx){\n${SalesQuotationDraftUpdateHeader.body.source}\n})(ctx.input,ctx)`);
  return { ctx, state, execute: () => execute(ctx) };
}

const successful = makeContext();
const result = await successful.execute();
assert.equal(successful.state.transactionCalls, 1);
assert.equal(successful.state.updateCalls.length, 1);
assert.deepEqual(successful.state.updateCalls[0].patch, {
  name: '控制柜报价草稿（修订）',
  valid_until: '2026-11-15',
  payment_term: '验收后30天',
  remarks: '等待客户确认交期',
});
assert.equal(successful.state.updateCalls[0].options.where.id, 'quote-1');
assert.equal(successful.state.updateCalls[0].options.where.status, 'draft');
assert.equal(successful.state.updateCalls[0].options.where.organization_id, organizationId);
assert.equal(successful.state.updateCalls[0].options.where.owner_id, actor);
assert.equal(successful.state.updateCalls[0].options.where.responsible_id, actor);
assert.equal(successful.state.updateCalls[0].options.where.updated_at.$gte, version);
assert.equal(successful.state.updateCalls[0].options.where.updated_at.$lt, nextVersion);
assert.equal(result.updated_at, nextVersion);
assert.equal(successful.state.quote.customer_id, 'customer-1');
assert.equal(successful.state.quote.contact_id, 'contact-1');
assert.equal(successful.state.quote.opportunity_id, 'opportunity-1');
assert.equal(successful.state.quote.status, 'draft');
assert.equal(successful.state.quote.pricing_version, 2);
assert.equal(successful.state.quote.total_amount, 1130);

await assert.rejects(successful.execute(), /已被修改|版本已变化/);
assert.equal(successful.state.updateCalls.length, 1, 'replaying a stale token must not issue a second write');

const timestampPrecision = makeContext({
  quote: makeQuote({ updated_at: '2026-10-01T12:00:00.123456Z' }),
  input: { expected_updated_at: version, payment_term: '30天' },
  updateTimestamp: '2026-10-01T12:00:00.124001Z',
});
await timestampPrecision.execute();
assert.equal(timestampPrecision.state.quote.payment_term, '30天', 'millisecond token should match its stored PostgreSQL sub-millisecond timestamp bucket');

const staleRace = makeContext({
  input: { expected_updated_at: version, payment_term: '本次请求的旧付款条件' },
  raceBeforeConditionalUpdate(state) {
    state.quote = { ...state.quote, payment_term: '并发保存的付款条件', updated_at: nextVersion };
  },
});
await assert.rejects(staleRace.execute(), /版本已变化/);
assert.equal(staleRace.state.updateCalls.length, 1, 'the conditional statement is issued once');
assert.equal(staleRace.state.quote.payment_term, '并发保存的付款条件', 'a concurrent header edit must remain intact');

const stalePriceRace = makeContext({
  input: { expected_updated_at: version, name: '旧报价名' },
  raceBeforeConditionalUpdate(state) {
    state.quote = { ...state.quote, pricing_version: 3, total_amount: 1200, updated_at: nextVersion };
  },
});
await assert.rejects(stalePriceRace.execute(), /版本已变化/);
assert.equal(stalePriceRace.state.quote.pricing_version, 3, 'a concurrent price version must remain intact');
assert.equal(stalePriceRace.state.quote.total_amount, 1200);

for (const [label, overrides, pattern] of [
  ['other organization', { quote: makeQuote({ organization_id: 'org-2' }) }, /不存在或不可访问/],
  ['other owner', { quote: makeQuote({ owner_id: 'sales-user-2' }) }, /不存在或不可访问/],
  ['other responsible salesperson', { quote: makeQuote({ responsible_id: 'sales-user-2' }) }, /不存在或不可访问/],
  ['non-draft status', { quote: makeQuote({ status: 'pending_approval' }) }, /仅本人负责的草稿报价/],
  ['record read denied', { recordLoadDenied: true }, /无权读取/],
  ['missing actor', { session: { organizationId } }, /无法识别/],
  ['missing organization', { session: { userId: actor } }, /无法确认/],
  ['stale caller version', { quote: makeQuote({ updated_at: nextVersion }) }, /已被修改/],
  ['invalid expiration date', { input: { expected_updated_at: version, valid_until: '2026-02-30' } }, /有效的 YYYY-MM-DD/],
  ['expiration before quote date', { input: { expected_updated_at: version, valid_until: '2026-09-30' } }, /不得早于报价日期/],
  ['empty quote name', { input: { expected_updated_at: version, name: '  ' } }, /报价名称不能为空/],
  ['missing version', { input: { payment_term: '30天' } }, /报价版本缺失/],
  ['malformed version', { input: { expected_updated_at: 'yesterday', payment_term: '30天' } }, /报价版本格式无效/],
  ['no editable fields', { input: { expected_updated_at: version } }, /至少修改/],
]) {
  const invalid = makeContext(overrides);
  await assert.rejects(invalid.execute(), pattern, label);
  assert.equal(invalid.state.updateCalls.length, 0, `${label} must be rejected before update`);
}

for (const forbiddenField of ['customer_id', 'contact_id', 'opportunity_id', 'total_amount', 'status', 'owner_id', 'responsible_id', 'pricing_version', 'quotation_type_id']) {
  const invalid = makeContext({ input: { expected_updated_at: version, payment_term: '30天', [forbiddenField]: 'forged' } });
  await assert.rejects(invalid.execute(), /未授权字段/, `must reject ${forbiddenField}`);
  assert.equal(invalid.state.updateCalls.length, 0, `${forbiddenField} must never reach ObjectQL update`);
}

const clearOptionalFields = makeContext({ input: { expected_updated_at: version, payment_term: '', remarks: null } });
await clearOptionalFields.execute();
assert.equal(clearOptionalFields.state.updateCalls[0].patch.payment_term, null);
assert.equal(clearOptionalFields.state.updateCalls[0].patch.remarks, null);

const nonAdvancingTimestamp = makeContext({
  quote: makeQuote({ updated_at: '2026-10-01T12:00:00.123456Z' }),
  input: { expected_updated_at: version, name: '不应提交的更新' },
  updateTimestamp: '2026-10-01T12:00:00.123999Z',
});
await assert.rejects(nonAdvancingTimestamp.execute(), /最后修改时间未推进/);
assert.equal(nonAdvancingTimestamp.state.quote.name, '控制柜报价草稿', 'a write with a non-advancing visible version must roll back');

process.stdout.write('PASS quotation draft header whitelist, own-organization/state checks, updated_at predicate update, stale replay/race rejection, precision bucket handling, and rollback on non-advancing version\n');
