import assert from 'node:assert/strict';
import { SalesContactSave, SalesCustomerProfileUpdate } from '../src/actions/sales-crm-maintenance.action.ts';
const actor='sales-a',org='org-a';
function fixture({failChannel=false}={}){
 const tables={forge_customer:[{id:'customer',name:'栖原包装设备有限公司（隔离样例）',category_id:'category',owner_id:actor,responsible_id:actor,organization_id:org,updated_at:'2026-10-02T02:00:00.000Z'}],forge_customer_category:[{id:'category',organization_id:org}],forge_contact:[{id:'contact',name:'林工',customer_id:'customer',responsible_id:actor,owner_id:actor,organization_id:org,updated_at:'2026-10-02T02:00:00.000Z',employment_status:'active'}],forge_contact_channel:[{id:'phone',contact_id:'contact',name:'电话',channel_type:'other',value:'13700000001',owner_id:actor,organization_id:org}]};
 let sequence=100;
 const matches=(row,where)=>Object.entries(where||{}).every(([key,value])=>value&&typeof value==='object'?(!value.$gte||Date.parse(row[key])>=Date.parse(value.$gte))&&(!value.$lt||Date.parse(row[key])<Date.parse(value.$lt)):(row[key]??null)===value);
 const api={object(name){return {async find({where}={}){return structuredClone(tables[name]?.filter(row=>matches(row,where))||[])},async findOne({where}){return structuredClone(tables[name]?.find(row=>matches(row,where))||null)},async insert(values){if(name==='forge_contact_channel'&&failChannel)throw new Error('channel storage unavailable');const row={id:'new-'+(++sequence),...values,updated_at:new Date(Date.parse('2026-10-02T02:00:00.000Z')+(++sequence)).toISOString()};(tables[name]??=[]).push(row);return row},async update(values,options={}){const rows=tables[name].filter(row=>matches(row,options.where||{id:values.id}));for(const row of rows)Object.assign(row,values,{updated_at:new Date(Date.parse('2026-10-02T02:00:00.000Z')+(++sequence)).toISOString()});return options.multi?rows.length:rows[0]},async delete({where}){tables[name]=tables[name].filter(row=>!matches(row,where))}}},async transaction(callback){const snapshot=structuredClone(tables);try{return await callback()}catch(e){for(const key of Object.keys(tables))delete tables[key];Object.assign(tables,snapshot);throw e}}};
 async function run(action,input,recordId='contact',userId=actor){return new Function('ctx',`return (async()=>{${action.body.source}})()`)({session:{userId,organizationId:org},recordId,input,api})}
 return {tables,run};
}
const header={name:'林工',customer_id:'customer',responsible_id:actor,employment_status:'active',job_title:'项目工程师',expected_updated_at:'2026-10-02T02:00:00.000Z'};
const input=channels=>({header_json:JSON.stringify(header),channels_json:JSON.stringify(channels)});
const normal=fixture();
await normal.run(SalesContactSave,input([{id:'phone',name:'工作电话',channel_type:'other',value:'13700000002',is_primary:true}]));
assert.equal(normal.tables.forge_contact[0].job_title,'项目工程师');
assert.equal(normal.tables.forge_contact_channel[0].id,'phone','editing preserves the channel identity');
assert.equal(normal.tables.forge_contact_channel[0].value,'13700000002');
const saved=structuredClone(normal.tables);
await assert.rejects(normal.run(SalesContactSave,input([])),/已被修改/);
assert.deepEqual(normal.tables,saved,'stale editor changes nothing');
const rollback=fixture({failChannel:true}),before=structuredClone(rollback.tables);
await assert.rejects(rollback.run(SalesContactSave,input([{name:'邮箱',channel_type:'email',value:'lin@example.test'}])),/storage unavailable/);
assert.deepEqual(rollback.tables,before,'channel failure restores profile and removed channels');
for(const user of ['sales-b']){const denied=fixture();await assert.rejects(denied.run(SalesContactSave,input([]),'contact',user),/本人/);assert.equal(denied.tables.forge_contact[0].name,'林工')}
const injected=fixture();await assert.rejects(injected.run(SalesContactSave,input([{id:'foreign-channel',name:'邮箱',channel_type:'email',value:'lin@example.test'}])),/不属于当前联系人/);
const customer=fixture();const profile={name:'栖原包装设备有限公司（隔离样例）',customer_type:'company',category_id:'category',industry:'包装设备',established_on:''};
await customer.run(SalesCustomerProfileUpdate,{values_json:JSON.stringify(profile),expected_updated_at:'2026-10-02T02:00:00.000Z'},'customer');
assert.equal(customer.tables.forge_customer[0].industry,'包装设备');
assert.equal(customer.tables.forge_customer[0].established_on,null,'blank optional dates never reach SQL as empty strings');
await assert.rejects(fixture().run(SalesCustomerProfileUpdate,{values_json:JSON.stringify({...profile,established_on:'2026-02-30'}),expected_updated_at:'2026-10-02T02:00:00.000Z'},'customer'),/有效日期/);
await assert.rejects(fixture().run(SalesCustomerProfileUpdate,{values_json:JSON.stringify({...profile,owner_id:'sales-b'}),expected_updated_at:'2026-10-02T02:00:00.000Z'},'customer'),/不可编辑字段/);
console.log('PASS CRM profile/contact save: ownership, reference rejection, stable channels, stale versions and rollback');
