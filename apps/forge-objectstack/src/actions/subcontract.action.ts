import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

export const SubcontractSupplierActivate = defineAction({
  name: 'subcontract_supplier_activate', label: '开通委外', objectName: 'forge_supplier', icon: 'factory',
  locations: [...locations], order: 40, visible: `record.status == 'active' && record.approval_status == 'approved'`, refreshAfter: true,
  params: [
    { name: 'process_capabilities', label: '工艺能力', type: 'textarea', required: true },
    { name: 'credit_rating', label: '信用等级', type: 'select', required: true, options: [
      { value: 'one', label: '1 星' }, { value: 'two', label: '2 星' }, { value: 'three', label: '3 星' },
      { value: 'four', label: '4 星' }, { value: 'five', label: '5 星' },
    ] },
    { name: 'default_issue_warehouse_id', label: '默认发料来源仓', type: 'text' },
    { name: 'default_receipt_warehouse_id', label: '默认回厂入库仓', type: 'text' },
    { name: 'loss_rate_limit', label: '损耗率上限（%）', type: 'number' },
    { name: 'warranty_terms', label: '质保条款', type: 'textarea' },
    { name: 'remarks', label: '备注', type: 'textarea' },
  ],
  successMessage: '委外供应商档案已开通',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),supplier=ctx.record,actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!id||!supplier)throw new Error('当前供应商不存在或不可访问');
if(!actor)throw new Error('无法识别当前操作人');
if(supplier.status!=='active'||supplier.approval_status!=='approved')throw new Error('只有已启用且已审批的供应商可以开通委外');
const capabilities=String(ctx.input.process_capabilities||'').trim(),rating=String(ctx.input.credit_rating||'three'),loss=Number(ctx.input.loss_rate_limit||0);
if(!capabilities)throw new Error('请至少填写一项工艺能力');
if(!['one','two','three','four','five'].includes(rating))throw new Error('信用等级不合法');
if(!Number.isFinite(loss)||loss<0||loss>100)throw new Error('损耗率上限必须在 0 到 100 之间');
const active=await ctx.api.object('forge_subcontract_supplier_profile').find({where:{supplier_id:id,status:'active'}});
if(active.length)throw new Error('该供应商已经开通委外档案');
for(const warehouseId of [ctx.input.default_issue_warehouse_id,ctx.input.default_receipt_warehouse_id].filter(Boolean)){
  const warehouse=await ctx.api.object('forge_warehouse').findOne({where:{id:warehouseId}});if(!warehouse)throw new Error('默认仓库不存在或不可访问');
}
const now=new Date().toISOString(),created=await ctx.api.object('forge_subcontract_supplier_profile').insert({
  name:supplier.name+' 委外档案',supplier_id:id,process_capabilities:capabilities,credit_rating:rating,
  default_issue_warehouse_id:ctx.input.default_issue_warehouse_id||null,default_receipt_warehouse_id:ctx.input.default_receipt_warehouse_id||null,
  loss_rate_limit:loss,warranty_terms:String(ctx.input.warranty_terms||'').trim()||null,status:'active',activated_by:actor,activated_at:now,
  responsible_id:supplier.responsible_id||actor,remarks:String(ctx.input.remarks||'').trim()||null,
});
const profileId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id));
if(!profileId)throw new Error('委外供应商档案创建后未返回 ID');return{id:profileId,supplier_id:id,status:'active'};
` },
});

export const SubcontractOrderSubmit = defineAction({
  name: 'subcontract_order_submit', label: '提交审核', objectName: 'forge_subcontract_order', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft' || record.status == 'rejected'`, refreshAfter: true,
  successMessage: '委外订单已提交审核',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),order=ctx.record,actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!id||!order)throw new Error('当前委外订单不存在或不可访问');
if(!actor)throw new Error('无法识别当前操作人');
if(!['draft','rejected'].includes(order.status))throw new Error('委外订单状态已变化，请刷新后重试');
if(!order.supplier_profile_id||!order.supplier_id||!order.expected_delivery_on||!order.payment_term)throw new Error('委外供应商、交期和付款条件必须完整');
if(!['customer_supplied','turnkey'].includes(order.supply_mode))throw new Error('料权方式不合法');
const profile=await ctx.api.object('forge_subcontract_supplier_profile').findOne({where:{id:order.supplier_profile_id}});
if(!profile||profile.status!=='active'||profile.supplier_id!==order.supplier_id)throw new Error('委外供应商档案未开通或与订单供应商不一致');
const lines=await ctx.api.object('forge_subcontract_order_line').find({where:{order_id:id}});if(!lines.length)throw new Error('至少需要一行加工件');
let totalQuantity=0,processingAmount=0;for(const line of lines){
  const quantity=Number(line.quantity||0),price=Number(line.unit_price||0);if(!(quantity>0)||price<0||!line.sku_id||!line.item_code||!line.process_type||!line.unit_name)throw new Error('加工件的物料、加工类型、数量、单位和单价必须完整');
  const subtotal=Math.round((quantity*price+Number.EPSILON)*10000)/10000;await ctx.api.object('forge_subcontract_order_line').update({id:line.id,subtotal});totalQuantity+=quantity;processingAmount+=subtotal;
}
const plans=await ctx.api.object('forge_subcontract_material_plan').find({where:{order_id:id}});let issuePlanned=0;
if(order.supply_mode==='customer_supplied'){
  if(!plans.length)throw new Error('甲供料订单必须填写发料计划');
  const lineIds=new Set(lines.map(x=>x.id));for(const plan of plans){const planned=Number(plan.planned_quantity||0),standard=Number(plan.standard_quantity||0);if(!(planned>0)||!(standard>0)||!plan.sku_id||!lineIds.has(plan.order_line_id))throw new Error('发料计划的物料、加工件、计划发料和标准应耗必须完整');issuePlanned+=planned;}
}else if(plans.length)throw new Error('包工包料订单不应包含我方发料计划');
const round=v=>Math.round((v+Number.EPSILON)*10000)/10000,now=new Date().toISOString();
await ctx.api.object('forge_subcontract_order').update({id,line_count:lines.length,total_quantity:round(totalQuantity),processing_amount:round(processingAmount),issue_planned_quantity:round(issuePlanned),status:'pending_approval',submitted_at:now,submitted_by:actor,approved_at:null,approved_by:null,approval_note:null});
await ctx.api.object('forge_subcontract_order_approval_log').insert({name:order.code+' 提交审核',order_id:id,action:'submitted',from_status:order.status,to_status:'pending_approval',comment:'提交审核',occurred_at:now,operator_id:actor});
return{id,status:'pending_approval',line_count:lines.length,total_quantity:round(totalQuantity),processing_amount:round(processingAmount),issue_planned_quantity:round(issuePlanned)};
` },
});

export const SubcontractOrderReview = defineAction({
  name: 'subcontract_order_review', label: '审核委外订单', objectName: 'forge_subcontract_order', icon: 'circle-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  params: [
    { name: 'decision', label: '审核结论', type: 'select', required: true, options: [{ value: 'approve', label: '同意' }, { value: 'reject', label: '驳回' }] },
    { name: 'comment', label: '审核意见', type: 'textarea', required: true },
  ],
  successMessage: '委外订单审核已完成',
  body: { language: 'js', capabilities: ['api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),order=ctx.record,actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!id||!order)throw new Error('当前委外订单不存在或不可访问');
if(!actor)throw new Error('无法识别当前操作人');if(order.status!=='pending_approval')throw new Error('委外订单状态已变化，请刷新后重试');
const decision=ctx.input.decision,comment=String(ctx.input.comment||'').trim();if(!['approve','reject'].includes(decision)||!comment)throw new Error('审核结论和审核意见不能为空');
const next=decision==='approve'?'approved':'rejected',action=decision==='approve'?'approved':'rejected',now=new Date().toISOString();
await ctx.api.object('forge_subcontract_order').update({id,status:next,approved_at:now,approved_by:actor,approval_note:comment});
await ctx.api.object('forge_subcontract_order_approval_log').insert({name:order.code+' '+(decision==='approve'?'审核通过':'审核驳回'),order_id:id,action,from_status:'pending_approval',to_status:next,comment,occurred_at:now,operator_id:actor});
return{id,status:next,supply_mode:order.supply_mode,next_step:decision==='approve'?(order.supply_mode==='customer_supplied'?'创建委外发料单':'等待加工回厂'):'修改后重新提交'};
` },
});
