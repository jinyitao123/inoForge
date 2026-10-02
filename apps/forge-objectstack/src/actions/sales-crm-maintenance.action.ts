import { defineAction } from '@objectstack/spec';
import { contactEmploymentSnapshotSource } from './contact-employment-source.js';

export const SalesContactSave = defineAction({
  name: 'sales_contact_save', label: '保存联系人', objectName: 'forge_contact',
  requiredPermissions: ['sales_crm_maintain'], refreshAfter: true,
  params: [
    { name: 'header_json', label: '联系人资料', type: 'textarea', required: true },
    { name: 'channels_json', label: '联系方式', type: 'textarea', required: true },
  ],
  body: { language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `${contactEmploymentSnapshotSource}
const actor = String(ctx.session && ctx.session.userId || '');
const organizationId = String(ctx.session && ctx.session.organizationId || '');
if (!actor || !organizationId) throw new Error('登录已失效，请重新登录');
let header, channels;
try { header = JSON.parse(ctx.input.header_json); channels = JSON.parse(ctx.input.channels_json); } catch { throw new Error('联系人资料格式无效'); }
if (!header || typeof header !== 'object' || Array.isArray(header) || !Array.isArray(channels) || channels.length > 30) throw new Error('联系人资料格式无效');
const id = String(ctx.recordId || '').trim();
if (id && ctx.recordLoadDenied === true) throw new Error('联系人不存在或不可访问');
const owns = row => row && String(row.organization_id || '') === organizationId && String(row.owner_id || '') === actor;
const versionWhere = (row, fields) => { const ms = Date.parse(row.updated_at); if (!Number.isFinite(ms)) throw new Error('联系人缺少有效读取版本'); return { id: row.id, owner_id: actor, organization_id: organizationId, updated_at: { $gte: new Date(ms).toISOString(), $lt: new Date(ms + 1).toISOString() }, ...Object.fromEntries(fields.map(field => [field, row[field] ?? null])) }; };
const text = (value, max = 255) => { const result = String(value == null ? '' : value).trim(); if (result.length > max) throw new Error('字段内容过长'); return result || null; };
const name = text(header.name), customerId = text(header.customer_id);
if (!name || !customerId) throw new Error('请填写姓名和所属客户');
if (header.responsible_id && String(header.responsible_id) !== actor) throw new Error('只能维护本人负责的联系人');
const status = header.employment_status || 'active';
if (!['active','transferred','resigned','retired','inactive'].includes(status)) throw new Error('任职状态无效');
const gender = text(header.gender), weight = text(header.decision_weight);
if (gender && !['male','female','男','女'].includes(gender)) throw new Error('性别无效');
if (weight && !['price','delivery','quality','service','brand','payment_terms','价格','交期','质量','服务','品牌','付款条件'].includes(weight)) throw new Error('决策权重无效');
const normalized = channels.filter(row => text(row.value)).map(row => {
  if (!['mobile','telephone','email','wechat','dingtalk','qq','linkedin','other'].includes(row.channel_type)) throw new Error('联系方式类型无效');
  const value = text(row.value), label = text(row.name);
  if (!label) throw new Error('请填写联系方式标签');
  if (row.channel_type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) throw new Error('邮箱格式无效');
  return { id: text(row.id), name: label, channel_type: row.channel_type, value, is_primary: row.is_primary === true };
});
if (normalized.filter(row => row.is_primary).length > 1) throw new Error('只能设置一个主要联系方式');
if (new Set(normalized.map(row => row.channel_type + ':' + row.value)).size !== normalized.length) throw new Error('联系方式重复');
const contacts = ctx.api.object('forge_contact'), channelObject = ctx.api.object('forge_contact_channel');
return await ctx.api.transaction(async () => {
  const customer = await ctx.api.object('forge_customer').findOne({ where: { id: customerId } });
  if (!owns(customer) || String(customer.responsible_id || '') !== actor) throw new Error('所属客户不存在或不属于本人');
  let existing = null;
  if (id) {
    existing = await contacts.findOne({ where: { id } });
    if (!owns(existing) || String(existing.responsible_id || '') !== actor) throw new Error('联系人不存在或不属于本人');
    if (existing.customer_id !== customerId) throw new Error('不能通过编辑变更联系人所属客户');
    if (!header.expected_updated_at || String(existing.updated_at) !== String(header.expected_updated_at)) throw new Error('联系人已被修改，请刷新后重新编辑');
  }
  const oldChannels = id ? await channelObject.find({ where: { contact_id: id } }) : [];
  if (oldChannels.some(row => !owns(row))) throw new Error('联系方式归属不一致，请先核对');
  const suppliedIds = normalized.filter(row => row.id).map(row => row.id);
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some(channelId => !oldChannels.some(row => row.id === channelId))) throw new Error('联系方式不存在或不属于当前联系人');
  const values = { name, customer_id: customerId, responsible_id: actor, employment_status: status, gender, decision_weight: weight,
    job_title: text(header.job_title), department: text(header.department), is_primary: header.is_primary === true, remarks: text(header.remarks, 20000) };
  if (values.is_primary && status !== 'active') throw new Error('非在职联系人不能设为主要联系人');
  if (existing && ['employment_status','job_title','department'].some(field=>(existing[field]??null)!==(values[field]??null))) {
    await appendEmploymentSnapshot(existing);
    values.employment_revision=Number(existing.employment_revision||0)+1;
    values.employment_changed_on=new Date().toISOString().slice(0,10);
    values.employment_note='编辑任职资料';
  }
  if (values.is_primary) {
    const others = await contacts.find({ where: { customer_id: customerId, is_primary: true } });
    for (const other of others) if (other.id !== id) {
      if (!owns(other)) throw new Error('现有主要联系人不属于本人，请先核对');
      await contacts.update({ id: other.id, is_primary: false });
    }
  }
  let contactId = id;
  if (id) {
    const affected = await contacts.update(values, { multi: true, where: versionWhere(existing, ['name','customer_id','responsible_id','employment_status','gender','decision_weight','job_title','department','is_primary','remarks']) });
    if (affected !== 1) throw new Error('联系人已被修改，请刷新后重新编辑');
    const current = await contacts.findOne({ where: { id } });
    if (!current || Date.parse(current.updated_at) <= Date.parse(existing.updated_at)) throw new Error('联系人保存版本未推进，请稍后重试');
  } else {
    const created = await contacts.insert({ ...values, owner_id: actor, organization_id: organizationId });
    contactId = typeof created === 'string' ? created : created && (created.id || created.record && created.record.id);
    if (!contactId) throw new Error('联系人保存失败');
  }
  const primaryId = normalized.find(row=>row.is_primary)?.id || null;
  for (const old of oldChannels) if (old.is_primary === true && old.id !== primaryId) await channelObject.update({ id: old.id, is_primary: false });
  for (const row of oldChannels) if (!suppliedIds.includes(row.id)) await channelObject.delete({ where: { id: row.id } });
  for (const row of normalized) {
    const { id: channelId, ...fields } = row;
    if (channelId) await channelObject.update({ id: channelId, ...fields });
    else await channelObject.insert({ ...fields, contact_id: contactId, owner_id: actor, organization_id: organizationId });
  }
  return { id: contactId, customer_id: customerId, channel_count: normalized.length };
});
` },
});

export const SalesCustomerProfileUpdate = defineAction({
  name: 'sales_customer_profile_update', label: '保存客户资料', objectName: 'forge_customer',
  requiredPermissions: ['sales_crm_maintain'], refreshAfter: true,
  params: [
    { name: 'values_json', label: '客户资料', type: 'textarea', required: true },
    { name: 'expected_updated_at', label: '读取版本', type: 'text', required: true },
  ],
  body: { language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `
const actor = String(ctx.session && ctx.session.userId || ''), organizationId = String(ctx.session && ctx.session.organizationId || ''), id = String(ctx.recordId || '');
if (!actor || !organizationId || !id || ctx.recordLoadDenied === true) throw new Error('客户不存在或不可访问');
let values;
try { values = JSON.parse(ctx.input.values_json); } catch { throw new Error('客户资料格式无效'); }
const allowed = ['name','customer_type','category_id','level_id','credit_code','legal_representative','registered_capital','established_on','enterprise_scale','website','business_scope','industry','description','province','city','address','remarks'];
if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !allowed.includes(key))) throw new Error('客户资料包含不可编辑字段');
if (!String(values.name || '').trim() || !values.category_id) throw new Error('请填写客户名称和分类');
if (!['company','person'].includes(values.customer_type)) throw new Error('客户类型无效');
const patch = Object.fromEntries(Object.entries(values).map(([field,value])=>[field,typeof value === 'string' ? value.trim() || null : value]));
if (patch.established_on != null) {
  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(patch.established_on)) ? new Date(patch.established_on + 'T00:00:00.000Z') : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== patch.established_on) throw new Error('成立日期必须是有效日期');
}
const object = ctx.api.object('forge_customer');
return await ctx.api.transaction(async () => {
  const record = await object.findOne({ where: { id } });
  if (!record || String(record.organization_id || '') !== organizationId || String(record.owner_id || '') !== actor || String(record.responsible_id || '') !== actor) throw new Error('客户不存在或不属于本人');
  if (!ctx.input.expected_updated_at || String(record.updated_at) !== String(ctx.input.expected_updated_at)) throw new Error('客户已被修改，请刷新后重新编辑');
  for (const [field, objectName] of [['category_id','forge_customer_category'],['level_id','forge_customer_level']]) {
    if (values[field]) {
      const reference = await ctx.api.object(objectName).findOne({ where: { id: values[field] } });
      if (!reference || String(reference.organization_id || '') !== organizationId) throw new Error('客户分类或级别无效');
    }
  }
  const ms = Date.parse(record.updated_at);
  if (!Number.isFinite(ms)) throw new Error('客户缺少有效读取版本');
  const compare = { id, owner_id: actor, responsible_id: actor, organization_id: organizationId, updated_at: { $gte: new Date(ms).toISOString(), $lt: new Date(ms + 1).toISOString() }, ...Object.fromEntries(allowed.map(field => [field, record[field] ?? null])) };
  const changed = await object.update({ ...patch, name: String(values.name).trim() }, { multi: true, where: compare });
  if (changed !== 1) throw new Error('客户已被修改，请刷新后重新编辑');
  const current = await object.findOne({ where: { id } });
  if (!current || Date.parse(current.updated_at) <= ms) throw new Error('客户保存版本未推进，请稍后重试');
  return { id };
});
` },
});

/** Metadata-only backfill: preserves existing primary flags and rejects ambiguous old data. */
export const SalesCrmPrimaryRelationshipReconcile = defineAction({
  name: 'sales_crm_primary_relationship_reconcile', label: '校验联系人主项关系',
  objectName: 'forge_contact', locations: [], requiredPermissions: ['manage_metadata'],
  ai: { exposed: false },
  body: { language: 'js', capabilities: ['api.read', 'api.write', 'api.transaction'], source: `
const organizationId = String(ctx.session && ctx.session.organizationId || '');
if (!organizationId) throw new Error('无法确认当前组织');
return await ctx.api.transaction(async () => {
  const definitions = [
    { object: 'forge_contact', parent: 'customer_id', helper: 'primary_customer_id', label: '客户主要联系人' },
    { object: 'forge_contact_channel', parent: 'contact_id', helper: 'primary_contact_id', label: '联系人主要联系方式' },
  ];
  const groups = [];
  for (const definition of definitions) {
    const repository = ctx.api.object(definition.object);
    const rows = await repository.find({ where: { organization_id: organizationId } });
    const claimed = new Set();
    for (const row of rows) if (row.is_primary === true) {
      const parent = String(row[definition.parent] || '');
      if (!parent || claimed.has(parent)) throw new Error(definition.label + '存在缺失或重复主项，请先从正常业务页面核对；本次没有修改');
      claimed.add(parent);
    }
    groups.push({ definition, repository, rows });
  }
  let updated = 0;
  for (const { definition, repository, rows } of groups) {
    // Release stale helper claims before setting the exact existing primary flags.
    for (const row of rows) if (row.is_primary !== true && row[definition.helper] != null) {
      await repository.update({ id: row.id, is_primary: false });
      updated += 1;
    }
    for (const row of rows) if (row.is_primary === true && row[definition.helper] !== row[definition.parent]) {
      await repository.update({ id: row.id, is_primary: true });
      updated += 1;
    }
  }
  for (const { definition, repository } of groups) {
    const rows = await repository.find({ where: { organization_id: organizationId } });
    if (rows.some(row => (row[definition.helper] || null) !== (row.is_primary === true ? row[definition.parent] : null))) throw new Error('主项关系派生结果不一致，本次修改已取消');
  }
  return { primary_flags_preserved: true, updated_helpers: updated };
});
` },
});

/** Rebuild search projections only; no employment events are invented for old records. */
export const SalesCrmDirectoryReconcile = defineAction({
  name: 'sales_crm_directory_reconcile', label: '重建联系人搜索索引', objectName: 'forge_contact',
  locations: [], requiredPermissions: ['manage_metadata'], ai: { exposed: false },
  body: { language: 'js', capabilities: ['api.read','api.write','api.transaction'], source: String.raw`
const organizationId=String(ctx.session&&ctx.session.organizationId||'');
if(!organizationId)throw new Error('无法确认当前组织');
return await ctx.api.transaction(async()=>{
  const contacts=ctx.api.object('forge_contact'),customers=ctx.api.object('forge_customer'),channels=ctx.api.object('forge_contact_channel');let updated=0;
  for(const contact of await contacts.find({where:{organization_id:organizationId}})){
    const customer=await customers.findOne({where:{id:contact.customer_id,organization_id:organizationId}});
    if(!customer)throw new Error('联系人所属客户不可读，请先核对');
    const rows=await channels.find({where:{contact_id:contact.id,organization_id:organizationId,owner_id:contact.owner_id}});
    const summary=rows.sort((a,b)=>Number(b.is_primary===true)-Number(a.is_primary===true)||String(a.id).localeCompare(String(b.id))).map(row=>String(row.value||'')).filter(Boolean).join('\n');
    if(contact.customer_name!==customer.name||String(contact.channel_summary||'')!==summary){await contacts.update({id:contact.id,customer_name:customer.name,channel_summary:summary});updated++}
  }
  return{updated,employment_history_preserved:true};
});` },
});
