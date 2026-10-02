import { defineHook } from '@objectstack/spec/data';

function parentGuard(parentObject: string, parentField: string) {
  return `
const record = { ...(ctx.previous || {}), ...(ctx.input || {}) };
if (!(ctx.session && ctx.session.isSystem === true)) {
  const actor = String(ctx.session && ctx.session.userId || '');
  const organizationId = String(ctx.session && ctx.session.organizationId || '');
  if (!actor || !organizationId) throw new Error('登录已失效，请重新登录');
  const parentId = String(record.${parentField} || '');
  if (!parentId) throw new Error('所属客户或联系人不能为空');
  let parent;
  try { parent = await ctx.api.object('${parentObject}').findOne({ where: { id: parentId } }); }
  catch { throw new Error('所属客户或联系人不存在或不可访问'); }
  if (!parent || String(parent.organization_id || '') !== organizationId) throw new Error('所属客户或联系人不存在或不可访问');
  if (String(parent.owner_id || '') !== actor || String(parent.responsible_id || parent.owner_id || '') !== actor) throw new Error('只能为本人负责的客户或联系人维护资料');
  if (ctx.previous && ctx.input.${parentField} !== undefined && ctx.input.${parentField} !== ctx.previous.${parentField}) throw new Error('不能通过编辑变更所属客户或联系人');
}
`;
}

export const SalesContactRelationshipGuard = defineHook({
  name: 'sales_contact_relationship_guard', object: 'forge_contact',
  events: ['beforeInsert', 'beforeUpdate'], priority: 100, runAs: 'user',
  body: { language: 'js', capabilities: ['api.read'], source: `${parentGuard('forge_customer', 'customer_id')}
if (!(ctx.session && ctx.session.isSystem === true)) {
  const actor = String(ctx.session && ctx.session.userId || '');
  if (record.responsible_id && String(record.responsible_id) !== actor) throw new Error('当前入口只支持本人负责的联系人');
  if (!record.responsible_id) ctx.input.responsible_id = actor;
}
// A nullable unique lookup enforces one primary contact per customer in storage.
ctx.input.primary_customer_id = record.is_primary === true ? record.customer_id : null;
` },
});

export const SalesContactChannelRelationshipGuard = defineHook({
  name: 'sales_contact_channel_relationship_guard', object: 'forge_contact_channel',
  events: ['beforeInsert', 'beforeUpdate'], priority: 100, runAs: 'user',
  body: { language: 'js', capabilities: ['api.read'], source: `${parentGuard('forge_contact', 'contact_id')}
if (!(ctx.session && ctx.session.isSystem === true)) {
  const contact = await ctx.api.object('forge_contact').findOne({ where: { id: record.contact_id } });
  const customer = contact && await ctx.api.object('forge_customer').findOne({ where: { id: contact.customer_id } });
  const actor = String(ctx.session && ctx.session.userId || '');
  if (!customer || String(customer.owner_id || '') !== actor || String(customer.responsible_id || '') !== actor || String(customer.organization_id || '') !== String(ctx.session.organizationId || '')) throw new Error('所属客户不存在或不属于本人');
}
ctx.input.primary_contact_id = record.is_primary === true ? record.contact_id : null;
` },
});

export const SalesCustomerOwnerCreateGuard = defineHook({
  name: 'sales_customer_owner_create_guard', object: 'forge_customer', events: ['beforeInsert'], priority: 100, runAs: 'user',
  body: { language: 'js', capabilities: [], source: `
if (!(ctx.session && ctx.session.isSystem === true)) {
  const actor = String(ctx.session && ctx.session.userId || '');
  if (!actor) throw new Error('登录已失效，请重新登录');
  if (ctx.input.responsible_id && String(ctx.input.responsible_id) !== actor) throw new Error('当前入口只支持本人负责的客户');
  ctx.input.responsible_id = actor;
}
` },
});

/** Keep searchable quote customer titles consistent with the authoritative customer. */
export const SalesCustomerQuotationNameMirror = defineHook({
  name: 'sales_customer_quotation_name_mirror', object: 'forge_customer',
  events: ['afterUpdate'], priority: 150, runAs: 'system',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
if (!ctx.input || ctx.input.name === undefined || ctx.input.name === (ctx.previous && ctx.previous.name)) return;
const id = String(ctx.previous && ctx.previous.id || ctx.input.id || ctx.result && ctx.result.id || '');
const organizationId = String(ctx.previous && ctx.previous.organization_id || ctx.session && ctx.session.organizationId || '');
if (!id || !organizationId) throw new Error('客户名称同步缺少有效组织和记录');
const object = ctx.api.object('forge_quotation');
const quotes = await object.find({ where: { customer_id: id, organization_id: organizationId }, fields: ['id'] });
for (const quote of quotes) await object.update({ id: quote.id, customer_name: String(ctx.input.name) });
` },
});
