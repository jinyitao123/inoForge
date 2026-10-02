import assert from 'node:assert/strict';
import { SalesQuotationDraftCreate } from '../src/actions/sales.action.ts';

assert.ok(SalesQuotationDraftCreate.params.some((param) => param.field === 'opportunity_id' && param.objectOverride === 'forge_quotation'), 'quotation draft Action must bind the opportunity FK from Quotation metadata');

function makeContext({ opportunityId = 'opportunity-1', opportunity = null } = {}) {
  const actor = 'sales-user-1';
  const organizationId = 'org-1';
  const writes = [];
  const reads = [];
  const opportunityRecord = opportunity ?? {
    id: 'opportunity-1', organization_id: organizationId, owner_id: actor,
    responsible_id: actor, customer_id: 'customer-1', name: '控制柜年度采购商机', stage: 'proposal_quoted',
  };
  const records = {
    forge_customer: { id: 'customer-1', organization_id: organizationId, owner_id: actor },
    forge_quotation_type: { id: 'type-1', organization_id: organizationId, status: 'active' },
    forge_quotation_issuer: { id: 'issuer-1', organization_id: organizationId, name: '销售主体' },
  };
  const api = {
    async transaction(callback) { return callback(); },
    object(name) {
      return {
        async findOne({ where = {} } = {}) {
          reads.push({ object: name, where });
          if (name === 'forge_quotation' && where.code) return null;
          if (name === 'forge_sales_opportunity' && where.id === opportunityId) return opportunityRecord;
          if (records[name]?.id === where.id) return records[name];
          return null;
        },
        async insert(value) {
          const id = name === 'forge_quotation' ? 'quote-created-1' : `created-${writes.length + 1}`;
          writes.push({ object: name, value: { ...value }, id });
          return { id };
        },
      };
    },
  };
  const ctx = {
    session: { userId: actor, organizationId },
    input: {
      code: 'QT-OPP-LINK-01', name: '控制柜年度报价', customer_id: 'customer-1',
      opportunity_id: opportunityId, quotation_type_id: 'type-1', issuer_id: 'issuer-1',
      quotation_date: '2026-10-01', valid_until: '2026-11-01',
      lines_json: JSON.stringify([{ line_type: 'service', name: '现场联调服务', quantity: 1, taxed_unit_price: 300, tax_rate: 13, discount_rate: 0 }]),
    },
    api,
  };
  const execute = new Function('ctx', `return (async function(){\n${SalesQuotationDraftCreate.body.source}\n})()`);
  return { execute: () => execute(ctx), reads, writes };
}

const linked = makeContext();
await linked.execute();
const linkedQuote = linked.writes.find((entry) => entry.object === 'forge_quotation').value;
assert.equal(linkedQuote.opportunity_id, 'opportunity-1');
assert.equal(linkedQuote.opportunity_name, '控制柜年度采购商机', 'legacy display snapshot should agree with the canonical relationship');
assert.equal(linked.reads.filter((entry) => entry.object === 'forge_sales_opportunity').length, 1);

const unlinked = makeContext({ opportunityId: null });
await unlinked.execute();
const unlinkedQuote = unlinked.writes.find((entry) => entry.object === 'forge_quotation').value;
assert.equal(unlinkedQuote.opportunity_id, null, 'existing customer-only quote draft calls remain supported');
assert.equal(unlinkedQuote.opportunity_name, null);

for (const [caseName, opportunity] of [
  ['another customer', { id: 'opportunity-1', organization_id: 'org-1', owner_id: 'sales-user-1', responsible_id: 'sales-user-1', customer_id: 'customer-2', name: 'Other customer' }],
  ['another organization', { id: 'opportunity-1', organization_id: 'org-2', owner_id: 'sales-user-1', responsible_id: 'sales-user-1', customer_id: 'customer-1', name: 'Foreign organization' }],
  ['another owner', { id: 'opportunity-1', organization_id: 'org-1', owner_id: 'sales-user-2', responsible_id: 'sales-user-2', customer_id: 'customer-1', name: 'Other owner' }],
  ['another responsible salesperson', { id: 'opportunity-1', organization_id: 'org-1', owner_id: 'sales-user-1', responsible_id: 'sales-user-2', customer_id: 'customer-1', name: 'Other responsible' }],
]) {
  const invalid = makeContext({ opportunity });
  await assert.rejects(invalid.execute(), undefined, `draft Action should reject an opportunity belonging to ${caseName}`);
  assert.equal(invalid.writes.length, 0, `invalid ${caseName} relationship must be rejected before quotation or line writes`);
}

process.stdout.write('PASS quote draft Action persists an owned same-customer opportunity FK and rejects cross-customer, cross-organization, and unauthorized links\n');
