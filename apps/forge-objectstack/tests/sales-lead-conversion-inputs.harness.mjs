import assert from 'node:assert/strict';
import { SalesLeadConvertToOpportunity } from '../src/actions/sales.action.ts';
import { SalesOpportunity } from '../src/objects/sales.object.ts';
import { SalesLeadsPage } from '../src/pages/sales-crm-service-pages.page.ts';

const stageField = SalesOpportunity.fields.stage;
const stageOptions = stageField.options;
const defaultStage = stageField.defaultValue;
const stageValues = stageOptions.map(option => option.value);
const actionParams = SalesLeadConvertToOpportunity.params;
for (const field of ['name', 'amount', 'expected_close_on', 'stage', 'remarks']) {
  assert.ok(actionParams.some(param => param.field === field && param.objectOverride === 'forge_sales_opportunity'), `conversion Action must bind ${field} to SalesOpportunity metadata`);
}

function executePageFunction(source, signature, args) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Page source must include ${signature}`);
  const opening = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
  assert.ok(end > opening, `Page function ${signature} must have balanced braces`);
  const fn = new Function('opportunityDefaultStage', `return (${source.slice(start, end)});`)(defaultStage);
  return fn(...args);
}

const pageSource = SalesLeadsPage.source;
const embeddedStageOptions = pageSource.match(/const opportunityStageOptions=(\[[^;]*\]);/);
assert.ok(embeddedStageOptions, 'Lead conversion page must embed stage options from the Opportunity model');
assert.deepEqual(JSON.parse(embeddedStageOptions[1]), stageOptions);
assert.match(pageSource, /<ForgeSelectControl[^>]*aria-label="商机阶段"[^>]*value=\{dialog\?\.stage\|\|opportunityDefaultStage\}/);
assert.match(pageSource, /<textarea[^>]*aria-label="商机备注"[^>]*value=\{dialog\?\.remarks/);
assert.match(pageSource, /body:JSON\.stringify\(\{params\}\)/, 'the confirmed conversion must post the normalized form payload');
assert.match(pageSource, /const params=conversionPayload\(dialog\)/, 'the formal Action payload must come from the editable dialog state');

const pagePayload = executePageFunction(pageSource, 'function conversionPayload(value)', [{
  name: '  现场改造商机  ', amount: '180000', expected_close_on: '2026-12-31',
  stage: 'proposal_quoted', remarks: '  预算已确认  ',
}]);
assert.deepEqual(pagePayload, {
  name: '现场改造商机', amount: 180000, expected_close_on: '2026-12-31',
  stage: 'proposal_quoted', remarks: '预算已确认',
});

const category = { id: 'category-project', code: 'CUST-CAT-PROJECT' };
const actor = 'sales-user-1';
const organizationId = 'sales-org-1';
const customerName = '苏州衡舟设备有限公司';
const sourceRemarks = '由线索收集的原始需求';

function makeContext(input, { converted = false, oldSignature = false } = {}) {
  const opportunityStore = new Map();
  const customerStore = new Map();
  const contactStore = new Map();
  const channelStore = new Map();
  const lead = {
    id: 'lead-1', company_name: customerName, contact_name: '陈策', phone: '13900000103',
    source: '展会获取', remarks: sourceRemarks, responsible_id: actor, owner_id: actor, organization_id: organizationId,
    status: converted ? 'converted' : 'new',
    converted_customer_id: converted ? 'customer-old' : null,
    converted_opportunity_id: converted ? 'opportunity-old' : null,
    conversion_request_signature: converted && oldSignature
      ? JSON.stringify({ amount: 180000, expected_close_on: null })
      : null,
  };
  if (converted && oldSignature) {
    opportunityStore.set('opportunity-old', {
      id: 'opportunity-old', lead_id: lead.id, customer_id: 'customer-old', owner_id: actor, organization_id: organizationId,
      name: `${customerName} 项目商机`, stage: 'needs_confirmed', amount: 180000,
    });
  }
  const writes = [];
  const api = {
    async transaction(callback) { return callback(); },
    object(name) {
      return {
        async findOne({ where = {} } = {}) {
          if (name === 'forge_sales_lead' && where.id === lead.id) return lead;
          if (name === 'forge_sales_opportunity' && where.id) return opportunityStore.get(where.id) ?? null;
          if (name === 'forge_contact' && where.id) return contactStore.get(where.id) ?? null;
          return null;
        },
        async find({ where = {} } = {}) {
          if (name === 'forge_sales_opportunity') return [...opportunityStore.values()].filter(row => row.lead_id === where.lead_id);
          if (name === 'forge_customer') return [...customerStore.values()].filter(row => row.name === where.name);
          if (name === 'forge_contact') return [...contactStore.values()].filter(row => row.customer_id === where.customer_id && (!where.name || row.name === where.name));
          if (name === 'forge_contact_channel') return [...channelStore.values()].filter(row => row.contact_id === where.contact_id);
          if (name === 'forge_customer_category') return where.code === category.code ? [category] : [];
          return [];
        },
        async insert(value) {
          const stores = { forge_customer: customerStore, forge_sales_opportunity: opportunityStore, forge_contact: contactStore, forge_contact_channel: channelStore };
          const store = stores[name];
          const id = `${name}-${store.size + 1}`;
          const record = { id, ...value };
          store.set(id, record);
          writes.push({ object: name, record });
          return { id };
        },
        async update(value) {
          if (name === 'forge_sales_lead') Object.assign(lead, value);
          writes.push({ object: name, record: { ...value } });
          return value;
        },
      };
    },
  };
  const ctx = { recordId: lead.id, record: lead, session: { userId: actor, organizationId }, input, api };
  const run = new Function('ctx', `return (async function(){\n${SalesLeadConvertToOpportunity.body.source}\n})()`);
  return { lead, writes, opportunities: opportunityStore, contacts: contactStore, channels: channelStore, run: () => run(ctx) };
}

const explicit = makeContext({
  name: '  现场改造商机  ', amount: 180000, expected_close_on: '2026-12-31',
  stage: 'proposal_quoted', remarks: '  预算已确认  ',
});
const explicitResult = await explicit.run();
const explicitOpportunity = [...explicit.opportunities.values()].find(row => row.id === explicitResult.opportunity_id);
assert.equal(explicit.contacts.size, 1);
assert.equal(explicit.channels.size, 1);
const contact = explicit.contacts.get(explicitOpportunity.contact_id);
assert.equal(contact.name, '陈策');
assert.equal(contact.customer_id, explicitResult.customer_id);
assert.equal(contact.owner_id, actor);
assert.equal([...explicit.channels.values()][0].contact_id, contact.id);
assert.equal([...explicit.channels.values()][0].value, '13900000103');
assert.equal(explicitOpportunity.name, '现场改造商机');
assert.equal(explicitOpportunity.amount, 180000);
assert.equal(explicitOpportunity.expected_close_on, '2026-12-31');
assert.equal(explicitOpportunity.stage, 'proposal_quoted');
assert.equal(explicitOpportunity.remarks, '预算已确认');
assert.equal(explicitOpportunity.win_rate, 30, 'the nonterminal opportunity stage preserves the existing conversion win-rate rule');
assert.equal(explicitOpportunity.description, sourceRemarks, 'the existing lead-to-description snapshot remains intact');
const explicitWriteCount = explicit.writes.length;
assert.deepEqual(await explicit.run(), explicitResult, 'replaying the same full form returns the existing conversion');
assert.equal(explicit.writes.length, explicitWriteCount, 'same-input replay must not create a second customer/opportunity');

const legacy = makeContext({ amount: 120000, expected_close_on: null });
const legacyResult = await legacy.run();
const legacyOpportunity = [...legacy.opportunities.values()].find(row => row.id === legacyResult.opportunity_id);
assert.equal(legacyOpportunity.name, `${customerName} 项目商机`, 'older clients may omit the new name parameter');
assert.equal(legacyOpportunity.stage, defaultStage, 'omitting stage follows the actual SalesOpportunity model default');
assert.equal(legacyOpportunity.remarks, null);
assert.equal(legacyOpportunity.description, sourceRemarks);
assert.equal(legacy.lead.conversion_request_signature, JSON.stringify({ amount: 120000, expected_close_on: null }), 'old parameter signatures remain replayable');

const oldConverted = makeContext({
  name: `${customerName} 项目商机`, amount: 180000, expected_close_on: null,
  stage: defaultStage, remarks: null,
}, { converted: true, oldSignature: true });
assert.deepEqual(await oldConverted.run(), {
  id: 'lead-1', status: 'converted', customer_id: 'customer-old', opportunity_id: 'opportunity-old',
}, 'the new default form remains compatible with an existing legacy conversion signature');
assert.equal(oldConverted.writes.length, 0, 'legacy conversion replay is read-only');

for (const [stage, expectedWinRate] of [['won', 100], ['lost', 0]]) {
  const terminal = makeContext({ name: `阶段${stage}商机`, amount: 1, stage });
  const result = await terminal.run();
  const opportunity = terminal.opportunities.get(result.opportunity_id);
  assert.equal(opportunity.stage, stage);
  assert.equal(opportunity.win_rate, expectedWinRate, 'terminal stages use the same win-rate rule as SalesOpportunityAdvance');
}

for (const [label, input] of [
  ['invalid stage', { name: '新商机', amount: 1, stage: 'invented_stage' }],
  ['invalid date', { name: '新商机', amount: 1, expected_close_on: '2026-02-30' }],
  ['empty provided name', { name: '  ', amount: 1 }],
]) {
  const invalid = makeContext(input);
  await assert.rejects(invalid.run(), undefined, `${label} should be rejected`);
  assert.equal(invalid.writes.length, 0, `${label} must be rejected before business writes`);
}

process.stdout.write('PASS lead conversion form forwards model-backed name, stage, remarks, amount and date; Action validates, persists and replays without duplicate writes\n');

const unrelated = makeContext({ amount: 1 });
unrelated.lead.owner_id = 'other-sales';
await assert.rejects(unrelated.run(), /不属于本人/);
assert.equal(unrelated.writes.length, 0);
const foreignOrganization = makeContext({ amount: 1 });
foreignOrganization.lead.organization_id = 'other-org';
await assert.rejects(foreignOrganization.run(), /不属于本人/);
assert.equal(foreignOrganization.writes.length, 0);
