import { defineAction } from '@objectstack/spec';
import { contactEmploymentSnapshotSource } from './contact-employment-source.js';

const ownedContact = String.raw`
const actor = String(ctx.session && ctx.session.userId || ''), organizationId = String(ctx.session && ctx.session.organizationId || ''), id = String(ctx.recordId || '');
if (!actor || !organizationId || !id || ctx.recordLoadDenied === true) throw new Error('联系人不存在或不可访问');
const contacts = ctx.api.object('forge_contact');
const owns = row => row && row.organization_id === organizationId && row.owner_id === actor && row.responsible_id === actor;
async function readContact() {
  const row = await contacts.findOne({ where: { id } });
  if (!owns(row)) throw new Error('联系人不存在或不属于本人');
  return row;
}
function versionWhere(row) {
  if (!ctx.input.expected_updated_at || String(row.updated_at) !== String(ctx.input.expected_updated_at)) throw new Error('联系人已被修改，请刷新后重试');
  const ms = Date.parse(row.updated_at);
  if (!Number.isFinite(ms)) throw new Error('联系人读取版本无效');
  return { id, owner_id: actor, responsible_id: actor, organization_id: organizationId,
    updated_at: { $gte: new Date(ms).toISOString(), $lt: new Date(ms + 1).toISOString() } };
}
async function updateContact(row, patch) {
  const changed = await contacts.update(patch, { multi: true, where: versionWhere(row) });
  if (changed !== 1) throw new Error('联系人已被修改，请刷新后重试');
}
function validDate(value, label) {
  const text = String(value || ''), date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text+'T00:00:00Z') : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== text) throw new Error(label+'无效');
  return text;
}
`;
const version = { name: 'expected_updated_at', label: '读取版本', type: 'text' as const, required: true };
const body = (source: string) => ({ language: 'js' as const, capabilities: ['api.read' as const,'api.write' as const,'api.transaction' as const], source });

export const SalesContactSetPrimary = defineAction({
  name: 'sales_contact_set_primary', label: '设为关键决策人', objectName: 'forge_contact',
  requiredPermissions: ['sales_crm_maintain'], locations: [], refreshAfter: true, params: [version],
  body: body(`${ownedContact}
return await ctx.api.transaction(async () => {
  const contact = await readContact(); versionWhere(contact);
  if (contact.employment_status !== 'active') throw new Error('非在职联系人不能设为主要联系人');
  const peers = await contacts.find({ where: { customer_id: contact.customer_id, is_primary: true } });
  if (peers.some(row => !owns(row))) throw new Error('现有主要联系人不属于本人，请先核对');
  for (const peer of peers) if (peer.id !== id) await contacts.update({id:peer.id,is_primary:false});
  await updateContact(contact,{customer_id:contact.customer_id,is_primary:true});
  return {id,is_primary:true};
});`),
});

export const SalesContactChangeEmployment = defineAction({
  name: 'sales_contact_change_employment', label: '更新任职', objectName: 'forge_contact',
  requiredPermissions: ['sales_crm_maintain'], locations: [], refreshAfter: true,
  params: [version,
    {name:'employment_status',label:'任职状态',type:'select',required:true,options:[{value:'active',label:'在职'},{value:'transferred',label:'已跳槽'},{value:'resigned',label:'已离职'},{value:'retired',label:'已退休'},{value:'inactive',label:'停用'}]},
    {name:'changed_on',label:'异动日期',type:'date',required:true},
    {name:'current_customer_id',label:'系统内新客户',type:'text'},
    {name:'company_name',label:'新公司名称',type:'text'},
    {name:'job_title',label:'新职位',type:'text'},
    {name:'note',label:'说明',type:'textarea'},
  ],
  body: body(`${ownedContact}${contactEmploymentSnapshotSource}
const status = String(ctx.input.employment_status || '');
if (!['active','transferred','resigned','retired','inactive'].includes(status)) throw new Error('任职状态无效');
const changedOn = validDate(ctx.input.changed_on,'异动日期');
const note = String(ctx.input.note || '').trim();
if (note.length > 500) throw new Error('说明不能超过500字');
return await ctx.api.transaction(async () => {
  const contact = await readContact(); versionWhere(contact);
  const currentCustomerId = status === 'transferred' ? String(ctx.input.current_customer_id || '').trim() : contact.current_customer_id || null;
  let company = String(contact.current_company_name || contact.customer_name || '');
  if (status === 'transferred') {
    company = String(ctx.input.company_name || '').trim();
    if (currentCustomerId) {
      const target = await ctx.api.object('forge_customer').findOne({where:{id:currentCustomerId}});
      if (!owns(target)) throw new Error('新客户不存在或不属于本人');
      company = String(target.name || '');
    }
    if (!company || company.length > 255) throw new Error('请填写有效的新公司名称');
  }
  await appendEmploymentSnapshot(contact);
  const patch = {customer_id:contact.customer_id,employment_status:status,employment_changed_on:changedOn,
    employment_note:note || null,employment_revision:Number(contact.employment_revision || 0)+1,
    current_company_name:company || null,current_customer_id:currentCustomerId,
    is_primary:status==='active' ? contact.is_primary===true : false};
  if (status==='transferred') {
    const job=String(ctx.input.job_title || '').trim();if(job.length>255)throw new Error('新职位过长');patch.job_title=job||null;
  }
  await updateContact(contact,patch);
  return {id,employment_status:status};
});`),
});

export const SalesContactCreateFollowUp = defineAction({
  name:'sales_contact_create_follow_up', label:'新增联系人跟进', objectName:'forge_contact',
  requiredPermissions:['sales_crm_maintain'],locations:[],refreshAfter:true,
  params:[
    {name:'request_key',label:'请求标识',type:'text',required:true},
    {name:'follow_type',label:'跟进方式',type:'text',required:true},
    {name:'followed_at',label:'跟进日期',type:'date',required:true},
    {name:'next_follow_on',label:'下次跟进',type:'date'},
    {name:'content',label:'跟进内容',type:'textarea',required:true},
  ],
  body:body(`${ownedContact}
const key=String(ctx.input.request_key||'').trim(),content=String(ctx.input.content||'').trim(),type=String(ctx.input.follow_type||'');
if(!key||key.length>100||!content||content.length>20000)throw new Error('请填写有效的跟进内容');
if(!['phone','wechat','email','onsite_visit','customer_visit','online_meeting','demo','proposal','negotiation','other'].includes(type))throw new Error('跟进方式无效');
const date=validDate(ctx.input.followed_at,'跟进日期'),next=ctx.input.next_follow_on?validDate(ctx.input.next_follow_on,'下次跟进日期'):null;
return await ctx.api.transaction(async()=>{
  const contact=await readContact(),object=ctx.api.object('forge_sales_follow_up');
  const prior=await object.findOne({where:{request_key:key,owner_id:actor,organization_id:organizationId}});
  if(prior){if(prior.contact_id!==id||prior.content!==content||prior.follow_type!==type||String(prior.followed_at).slice(0,10)!==date||(prior.next_follow_on?String(prior.next_follow_on).slice(0,10):null)!==next)throw new Error('同一请求不能更换跟进内容');return{id:prior.id};}
  const record=await object.insert({name:(contact.name+' 跟进').slice(0,255),request_key:key,contact_id:id,customer_id:contact.customer_id,
    follow_type:type,followed_at:date,next_follow_on:next,content,status:'completed',responsible_id:actor,owner_id:actor,organization_id:organizationId});
  return{id:typeof record==='string'?record:record.id};
});`),
});

export const SalesContactDelete = defineAction({
  name:'sales_contact_delete',label:'删除联系人',objectName:'forge_contact',requiredPermissions:['sales_crm_maintain'],locations:[],refreshAfter:true,params:[version],
  body:body(`${ownedContact}
return await ctx.api.transaction(async()=>{
  const contact=await readContact();versionWhere(contact);
  for(const name of ['forge_quotation','forge_sales_contract','forge_sales_order','forge_sales_opportunity','forge_service_order','forge_sales_follow_up']){
    const references=await ctx.api.object(name).find({where:{contact_id:id},limit:1});
    if(references.length)throw new Error('联系人已有业务引用，请保留档案并更新任职状态');
  }
  // Acquire the row through the version predicate before deleting its children.
  await updateContact(contact,{customer_id:contact.customer_id,is_primary:false});
  const channels=await ctx.api.object('forge_contact_channel').find({where:{contact_id:id}});
  if(channels.some(row=>row.owner_id!==actor||row.organization_id!==organizationId))throw new Error('联系方式归属不一致');
  for(const channel of channels)await ctx.api.object('forge_contact_channel').delete({where:{id:channel.id}});
  await ctx.api.object('forge_contact_employment').delete({where:{contact_id:id}});
  await contacts.delete({where:{id,owner_id:actor,organization_id:organizationId}});
  return{id,deleted:true};
});`),
});
