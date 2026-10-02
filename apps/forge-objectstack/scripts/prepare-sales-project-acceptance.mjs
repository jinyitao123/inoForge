/** Local identity/catalog setup only. Business records are created by employees in Forge. */
import { readFile } from 'node:fs/promises';
import { connect } from './api-client.mjs';
const base=process.env.FORGE_URL||'http://localhost:4635';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local acceptance only');
const accounts=JSON.parse(await readFile('.objectstack/sales-project-accounts.local.json','utf8'));
process.env.FORGE_TEST_EMAIL=accounts.admin.email;process.env.FORGE_TEST_PASSWORD=accounts.admin.password;
const admin=await connect(base);
async function list(object){const r=await admin.request('/data/'+object+'?$top=500');if(r.status!==200)throw new Error('Cannot read setup object '+object+' HTTP '+r.status);return r.value.records||[]}
async function create(object,values){const r=await admin.request('/data/'+object,'POST',values);if(r.status<200||r.status>=300)throw new Error('Setup write failed '+object+' HTTP '+r.status+' '+(r.value.error?.code||''));const row=r.value.record||r.value.data?.record||r.value.data||r.value;if(!row.id)throw new Error('Setup response has no record');return row}
async function ensure(object,criteria,values){const matches=(await list(object)).filter(row=>Object.entries(criteria).every(([key,value])=>row[key]===value));if(matches.length>1)throw new Error('Ambiguous setup record '+object);return matches[0]||create(object,{...criteria,...values})}
const organizations=await list('sys_organization');if(organizations.length!==1)throw new Error('Expected initialized single organization');const org=organizations[0].id;
const position=await ensure('sys_position',{name:'sales_owner'},{label:'销售负责人',organization_id:org,active:true,is_default:false,managed_by:'admin'});
const permissionSets=await list('sys_permission_set');
const names=['sales_lead_owner','sales_lead_conversion_operator','sales_crm_maintenance_operator','sales_quotation_draft_operator','sales_quotation_adjustment_operator','forge_sales_reference_reader'];
for(const name of names){const permission=permissionSets.find(row=>row.name===name);if(!permission)throw new Error('Missing permission '+name);await ensure('sys_position_permission_set',{position_id:position.id,permission_set_id:permission.id},{organization_id:org})}
for(const key of ['salesA','salesB']){if(!accounts[key].id)throw new Error('Create employee through native auth first');await ensure('sys_user_position',{user_id:accounts[key].id,position:position.name,organization_id:org},{reason:'隔离销售到项目岗位验收'})}
await ensure('forge_customer_category',{code:'CUST-CAT-PROJECT'},{name:'项目客户',status:'active',organization_id:org});
await ensure('forge_quotation_type',{code:'QA-SERVICE'},{name:'技术服务报价',status:'active',organization_id:org});
await ensure('forge_quotation_issuer',{name:'Forge销售项目验收公司（隔离样例）'},{credit_code:'QA-FORGE-ISSUER',short_name:'验收公司',organization_id:org,remarks:'本地隔离业务材料'});
await ensure('forge_unit',{code:'QA-SERVICE'},{name:'项',status:'active',organization_id:org});
console.log('PASS local setup: two sales employees share one native position and six owner-scoped permission sets; four reference catalogs prepared');
