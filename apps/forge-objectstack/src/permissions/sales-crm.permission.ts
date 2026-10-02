import { definePermissionSet } from '@objectstack/spec';

/** CRM maintenance stays owner-scoped; edits use guarded business Actions. */
export const salesCrmMaintenancePermission = definePermissionSet({
  name: 'sales_crm_maintenance_operator', label: '销售客户与联系人维护',
  systemPermissions: ['sales_crm_maintain'],
  fields: Object.fromEntries([
    ...['name','customer_type','category_id','level_id','credit_code','legal_representative','registered_capital','established_on','enterprise_scale','website','business_scope','industry','description','province','city','address','remarks','responsible_id'].map(field=>'forge_customer.'+field),
    ...['name','customer_id','is_primary','employment_status','responsible_id','job_title','gender','department','decision_weight','remarks'].map(field=>'forge_contact.'+field),
    ...['channel_type','name','value','is_primary'].map(field=>'forge_contact_channel.'+field),
  ].map(field=>[field,{readable:true,editable:true}]).concat(['credit_limit','payment_days','credit_status','revenue_recognition'].map(field=>['forge_customer.'+field,{readable:true,editable:false}]))),
  objects: {
    forge_customer: { allowCreate: true, allowRead: true, readScope: 'own', writeScope: 'own' },
    forge_contact: { allowCreate: true, allowRead: true, readScope: 'own', writeScope: 'own' },
    forge_contact_channel: { allowCreate: true, allowRead: true, readScope: 'own', writeScope: 'own' },
    forge_customer_team_member: { allowRead: true, readScope: 'own' },
    forge_sales_follow_up: { allowRead: true, readScope: 'own' },
    forge_sales_order: { allowRead: true, readScope: 'own' },
    forge_customer_category: { allowRead: true, readScope: 'org' },
    forge_customer_level: { allowRead: true, readScope: 'org' },
  },
});
