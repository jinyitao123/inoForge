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

export const SubcontractIssueCreate = defineAction({
  name: 'subcontract_issue_create', label: '创建委外发料单', objectName: 'forge_subcontract_order', icon: 'package-minus',
  locations: [...locations], order: 30, visible: `(record.status == 'approved' || record.status == 'in_progress') && record.supply_mode == 'customer_supplied'`, refreshAfter: true,
  params: [
    { name: 'issue_code', label: '发料单号', type: 'text', required: true },
    { name: 'issue_type', label: '发料类型', type: 'select', required: true, options: [{ value: 'normal', label: '正常发料' }, { value: 'overconsumption', label: '超耗补料' }] },
    { name: 'issue_on', label: '发料日期', type: 'date', required: true },
    { name: 'handler_id', label: '经办人 ID', type: 'text' },
    { name: 'lines_json', label: '发料明细 JSON', type: 'textarea', required: true },
    { name: 'remarks', label: '备注', type: 'textarea' },
  ],
  successMessage: '委外发料单草稿已创建',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),order=ctx.record,actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!id||!order)throw new Error('当前委外订单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');
if(!['approved','in_progress'].includes(order.status)||order.supply_mode!=='customer_supplied')throw new Error('只有已审核且仍可发料的甲供料订单可以创建发料单');
const code=String(ctx.input.issue_code||'').trim(),issueType=String(ctx.input.issue_type||'normal'),issueOn=ctx.input.issue_on;
if(!code||!issueOn)throw new Error('发料单号和发料日期不能为空');if(issueType!=='normal')throw new Error('超耗补料需要独立的超耗依据和审批规则，当前仅允许正常发料');
let requested;try{requested=JSON.parse(String(ctx.input.lines_json||'[]'));}catch(e){throw new Error('发料明细格式不正确');}if(!Array.isArray(requested)||!requested.length)throw new Error('至少需要一行发料明细');
const profile=await ctx.api.object('forge_subcontract_supplier_profile').findOne({where:{id:order.supplier_profile_id}});if(!profile||profile.status!=='active'||!profile.default_issue_warehouse_id)throw new Error('委外供应商未配置有效的默认发料来源仓');
const warehouse=await ctx.api.object('forge_warehouse').findOne({where:{id:profile.default_issue_warehouse_id}});if(!warehouse)throw new Error('默认发料来源仓不存在或不可访问');
const plans=await ctx.api.object('forge_subcontract_material_plan').find({where:{order_id:id}}),planMap={};for(const plan of plans)planMap[plan.id]=plan;
const seen=new Set(),prepared=[];for(const input of requested){const plan=planMap[input.plan_id],qty=Number(input.quantity||0);if(!plan||seen.has(plan.id))throw new Error('发料计划不存在、重复或不属于当前订单');seen.add(plan.id);if(!(qty>0))throw new Error('本次发料数量必须大于0');
 const priorLines=await ctx.api.object('forge_subcontract_issue_line').find({where:{plan_id:plan.id}});let occupied=0;for(const prior of priorLines){const parent=await ctx.api.object('forge_subcontract_issue').findOne({where:{id:prior.issue_id}});if(parent&&['draft','pending_approval','ready_to_issue'].includes(parent.status))occupied+=Number(prior.issue_quantity||0);}
 const remaining=Math.round((Number(plan.planned_quantity||0)-Number(plan.issued_quantity||0)-occupied+Number.EPSILON)*10000)/10000;if(qty>remaining)throw new Error((plan.item_code||plan.name)+' 发料数量超过剩余计划 '+remaining);
 const balances=await ctx.api.object('forge_inventory_balance').find({where:{balance_key:warehouse.id+':'+plan.sku_id}});if(balances.length!==1||qty>Number(balances[0].available_quantity||0))throw new Error((plan.item_code||plan.name)+' 来源仓库可用库存不足');prepared.push({plan,qty,remaining,batch:String(input.batch_number||'').trim()||null});}
const created=await ctx.api.object('forge_subcontract_issue').insert({name:code+' '+(order.name||''),code,order_id:id,supplier_id:order.supplier_id,issue_type:issueType,issue_on:issueOn,handler_id:ctx.input.handler_id||actor,warehouse_id:warehouse.id,line_count:prepared.length,total_quantity:prepared.reduce((s,x)=>s+x.qty,0),status:'draft',outbound_id:null,responsible_id:order.responsible_id||actor,remarks:String(ctx.input.remarks||'').trim()||null}),issueId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id));if(!issueId)throw new Error('委外发料单创建后未返回 ID');
const lineIds=[];for(const item of prepared){const saved=await ctx.api.object('forge_subcontract_issue_line').insert({name:item.plan.name,issue_id:issueId,order_id:id,plan_id:item.plan.id,order_line_id:item.plan.order_line_id,sku_id:item.plan.sku_id,warehouse_id:warehouse.id,item_code:item.plan.item_code,specification:item.plan.specification||null,unit_name:item.plan.unit_name,planned_quantity:Number(item.plan.planned_quantity||0),remaining_snapshot:item.remaining,issue_quantity:item.qty,batch_number:item.batch,reserved_quantity:0,outbounded_quantity:0,unit_cost:0,inventory_amount:0,status:'draft'}),lineId=typeof saved==='string'?saved:saved&&(saved.id||(saved.record&&saved.record.id));lineIds.push(lineId);}
return{id:issueId,code,status:'draft',order_id:id,line_ids:lineIds,total_quantity:prepared.reduce((s,x)=>s+x.qty,0)};
` },
});

export const SubcontractIssueSubmit = defineAction({
  name: 'subcontract_issue_submit', label: '提交审核', objectName: 'forge_subcontract_issue', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft' || record.status == 'rejected'`, refreshAfter: true,
  successMessage: '委外发料单已提交审核',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),record=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!record)throw new Error('委外发料单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(!['draft','rejected'].includes(record.status))throw new Error('发料单状态已变化，请刷新后重试');
const order=await ctx.api.object('forge_subcontract_order').findOne({where:{id:record.order_id}});if(!order||!['approved','in_progress'].includes(order.status)||order.supply_mode!=='customer_supplied')throw new Error('关联订单不再满足发料条件');
const lines=await ctx.api.object('forge_subcontract_issue_line').find({where:{issue_id:id}});if(!lines.length)throw new Error('至少需要一行发料明细');const claimed={};for(const line of lines){const qty=Number(line.issue_quantity||0);if(!(qty>0))throw new Error('发料数量必须大于0');const plan=await ctx.api.object('forge_subcontract_material_plan').findOne({where:{id:line.plan_id}});if(!plan||plan.order_id!==record.order_id)throw new Error('发料计划与订单不一致');const balances=await ctx.api.object('forge_inventory_balance').find({where:{balance_key:record.warehouse_id+':'+line.sku_id}});if(balances.length!==1)throw new Error((line.item_code||line.name)+' 来源库存余额不存在或重复');const key=balances[0].id;claimed[key]=(claimed[key]||0)+qty;if(claimed[key]>Number(balances[0].available_quantity||0))throw new Error((line.item_code||line.name)+' 来源仓库可用库存不足');}
const now=new Date().toISOString();await ctx.api.object('forge_subcontract_issue').update({id,status:'pending_approval',submitted_by:actor,submitted_at:now,reviewed_by:null,reviewed_at:null,review_note:null});await ctx.api.object('forge_subcontract_issue_log').insert({name:record.code+' 提交审核',issue_id:id,action:'submitted',from_status:record.status,to_status:'pending_approval',comment:'提交审核',occurred_at:now,operator_id:actor});return{id,status:'pending_approval',line_count:lines.length,total_quantity:Number(record.total_quantity||0)};
` },
});

export const SubcontractIssueReview = defineAction({
  name: 'subcontract_issue_review', label: '审核发料单', objectName: 'forge_subcontract_issue', icon: 'circle-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  params: [{ name: 'decision', label: '审核结论', type: 'select', required: true, options: [{ value: 'approve', label: '同意' }, { value: 'reject', label: '驳回' }] }, { name: 'comment', label: '审核意见', type: 'textarea', required: true }],
  successMessage: '委外发料审核已完成',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),record=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!record)throw new Error('委外发料单不存在或不可访问');if(!actor)throw new Error('无法识别当前审核人');if(record.status!=='pending_approval')throw new Error('发料单状态已变化，请刷新后重试');const decision=ctx.input.decision,comment=String(ctx.input.comment||'').trim();if(!['approve','reject'].includes(decision)||!comment)throw new Error('审核结论和审核意见不能为空');const now=new Date().toISOString(),lines=await ctx.api.object('forge_subcontract_issue_line').find({where:{issue_id:id}});
if(decision==='reject'){await ctx.api.object('forge_subcontract_issue').update({id,status:'rejected',reviewed_by:actor,reviewed_at:now,review_note:comment});for(const line of lines)await ctx.api.object('forge_subcontract_issue_line').update({id:line.id,status:'draft'});await ctx.api.object('forge_subcontract_issue_log').insert({name:record.code+' 审核驳回',issue_id:id,action:'rejected',from_status:'pending_approval',to_status:'rejected',comment,occurred_at:now,operator_id:actor});return{id,status:'rejected'};}
const grouped={};for(const line of lines){const balances=await ctx.api.object('forge_inventory_balance').find({where:{balance_key:record.warehouse_id+':'+line.sku_id}});if(balances.length!==1)throw new Error((line.item_code||line.name)+' 来源库存余额不存在或重复');const b=balances[0],qty=Number(line.issue_quantity||0);if(!grouped[b.id])grouped[b.id]={balance:b,quantity:0};grouped[b.id].quantity+=qty;if(grouped[b.id].quantity>Number(b.available_quantity||0))throw new Error((line.item_code||line.name)+' 可用库存不足，不能审核锁定');}
for(const key of Object.keys(grouped)){const item=grouped[key],b=item.balance,reserved=Math.round((Number(b.reserved_quantity||0)+item.quantity+Number.EPSILON)*10000)/10000,available=Math.round((Number(b.on_hand_quantity||0)-reserved+Number.EPSILON)*10000)/10000;await ctx.api.object('forge_inventory_balance').update({id:b.id,reserved_quantity:reserved,available_quantity:available,last_movement_at:now});}
for(const line of lines)await ctx.api.object('forge_subcontract_issue_line').update({id:line.id,reserved_quantity:Number(line.issue_quantity||0),status:'reserved'});
const outboundCreated=await ctx.api.object('forge_subcontract_outbound').insert({name:'SOUT-'+record.code+' '+record.name,code:'SOUT-'+record.code,issue_id:id,order_id:record.order_id,supplier_id:record.supplier_id,warehouse_id:record.warehouse_id,total_quantity:Number(record.total_quantity||0),status:'pending',remarks:'由发料单审核通过生成'}),outboundId=typeof outboundCreated==='string'?outboundCreated:outboundCreated&&(outboundCreated.id||(outboundCreated.record&&outboundCreated.record.id));if(!outboundId)throw new Error('委外出库单创建后未返回 ID');
await ctx.api.object('forge_subcontract_issue').update({id,status:'ready_to_issue',outbound_id:outboundId,reviewed_by:actor,reviewed_at:now,review_note:comment});await ctx.api.object('forge_subcontract_issue_log').insert({name:record.code+' 审核通过',issue_id:id,action:'approved',from_status:'pending_approval',to_status:'ready_to_issue',comment,occurred_at:now,operator_id:actor});return{id,status:'ready_to_issue',outbound_id:outboundId,locked_quantity:Number(record.total_quantity||0)};
` },
});

export const SubcontractIssueDispatch = defineAction({
  name: 'subcontract_issue_dispatch', label: '确认出库', objectName: 'forge_subcontract_issue', icon: 'truck',
  locations: [...locations], order: 30, visible: `record.status == 'ready_to_issue'`, refreshAfter: true,
  params: [{ name: 'comment', label: '出库说明', type: 'textarea', required: true }], successMessage: '委外物料已发出',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),record=ctx.record,actor=ctx.session&&ctx.session.userId,comment=String(ctx.input.comment||'').trim();if(ctx.recordLoadDenied===true||!id||!record)throw new Error('委外发料单不存在或不可访问');if(!actor)throw new Error('无法识别当前出库人');if(record.status!=='ready_to_issue'||!record.outbound_id)throw new Error('仅已审核并生成出库单的发料单可以确认出库');if(!comment)throw new Error('出库说明不能为空');
const outbound=await ctx.api.object('forge_subcontract_outbound').findOne({where:{id:record.outbound_id}});if(!outbound||outbound.status!=='pending')throw new Error('关联委外出库单不存在或已执行');const existing=await ctx.api.object('forge_inventory_ledger').find({where:{source_object:'forge_subcontract_issue',source_id:id}});if(existing.length)throw new Error('该发料单已经生成库存出库流水');
const lines=await ctx.api.object('forge_subcontract_issue_line').find({where:{issue_id:id}}),round=v=>Math.round((Number(v)+Number.EPSILON)*10000)/10000,now=new Date().toISOString();let totalAmount=0;
for(let index=0;index<lines.length;index++){const line=lines[index],qty=Number(line.issue_quantity||0),balances=await ctx.api.object('forge_inventory_balance').find({where:{balance_key:record.warehouse_id+':'+line.sku_id}});if(balances.length!==1)throw new Error((line.item_code||line.name)+' 来源库存余额不存在或重复');const b=balances[0],before=Number(b.on_hand_quantity||0),beforeReserved=Number(b.reserved_quantity||0),beforeAvailable=Number(b.available_quantity||0);if(qty>before||qty>beforeReserved||Number(line.reserved_quantity||0)!==qty)throw new Error((line.item_code||line.name)+' 锁定库存不足，不能确认出库');const unitCost=Number(b.average_cost||0),amount=round(qty*unitCost),after=round(before-qty),reserved=round(beforeReserved-qty),available=round(after-reserved),value=round(Math.max(0,Number(b.inventory_value||0)-amount)),average=after>0?round(value/after):0;await ctx.api.object('forge_inventory_balance').update({id:b.id,on_hand_quantity:after,reserved_quantity:reserved,available_quantity:available,inventory_value:value,average_cost:average,last_movement_at:now});
 await ctx.api.object('forge_inventory_ledger').insert({name:record.code+' '+line.name+' 委外发料出库',code:record.code+'-OUT-'+String(index+1).padStart(3,'0'),warehouse_id:record.warehouse_id,sku_id:line.sku_id,direction:'outbound',movement_type:'subcontract_issue_outbound',quantity:qty,before_on_hand:before,after_on_hand:after,before_available:beforeAvailable,after_available:available,unit_cost:unitCost,amount,occurred_at:now,source_object:'forge_subcontract_issue',source_id:id,source_line_id:line.id,responsible_id:actor,remarks:comment});
 const stockKey=record.supplier_id+':'+record.order_id+':'+line.sku_id,stocks=await ctx.api.object('forge_subcontract_stock_balance').find({where:{balance_key:stockKey}});if(stocks.length>1)throw new Error('同一供应商订单物料存在重复委外库存余额');const stock=stocks[0]||null,stockBefore=Number(stock&&stock.on_hand_quantity||0),stockAfter=round(stockBefore+qty),stockValue=round(Number(stock&&stock.inventory_value||0)+amount),stockIssued=round(Number(stock&&stock.cumulative_issued_quantity||0)+qty);if(stock)await ctx.api.object('forge_subcontract_stock_balance').update({id:stock.id,cumulative_issued_quantity:stockIssued,on_hand_quantity:stockAfter,unit_cost:unitCost,inventory_value:stockValue,last_movement_at:now});else await ctx.api.object('forge_subcontract_stock_balance').insert({name:(record.code+' '+line.name),balance_key:stockKey,supplier_id:record.supplier_id,order_id:record.order_id,sku_id:line.sku_id,cumulative_issued_quantity:qty,backflushed_quantity:0,returned_quantity:0,on_hand_quantity:qty,unit_cost:unitCost,inventory_value:amount,last_movement_at:now});
 await ctx.api.object('forge_subcontract_stock_ledger').insert({name:record.code+' '+line.name+' 入委外仓',code:record.code+'-SUB-'+String(index+1).padStart(3,'0'),supplier_id:record.supplier_id,order_id:record.order_id,sku_id:line.sku_id,direction:'inbound',movement_type:'issue_inbound',quantity:qty,before_on_hand:stockBefore,after_on_hand:stockAfter,unit_cost:unitCost,amount,occurred_at:now,source_object:'forge_subcontract_issue',source_id:id,source_line_id:line.id,responsible_id:actor,remarks:comment});
 const plan=await ctx.api.object('forge_subcontract_material_plan').findOne({where:{id:line.plan_id}});if(!plan)throw new Error('关联发料计划不存在');await ctx.api.object('forge_subcontract_material_plan').update({id:plan.id,issued_quantity:round(Number(plan.issued_quantity||0)+qty)});await ctx.api.object('forge_subcontract_issue_line').update({id:line.id,outbounded_quantity:qty,unit_cost:unitCost,inventory_amount:amount,status:'outbounded'});totalAmount=round(totalAmount+amount);}
const order=await ctx.api.object('forge_subcontract_order').findOne({where:{id:record.order_id}});await ctx.api.object('forge_subcontract_order').update({id:order.id,issued_quantity:round(Number(order.issued_quantity||0)+Number(record.total_quantity||0)),status:'in_progress'});await ctx.api.object('forge_subcontract_outbound').update({id:outbound.id,status:'outbounded',outbounded_by:actor,outbounded_at:now,remarks:comment});await ctx.api.object('forge_subcontract_issue').update({id,status:'issued',issued_by:actor,issued_at:now});await ctx.api.object('forge_subcontract_issue_log').insert({name:record.code+' 确认出库',issue_id:id,action:'issued',from_status:'ready_to_issue',to_status:'issued',comment,occurred_at:now,operator_id:actor});return{id,status:'issued',outbound_id:outbound.id,quantity:Number(record.total_quantity||0),inventory_amount:totalAmount,supplier_stock_added:Number(record.total_quantity||0)};
` },
});

export const SubcontractIssueSign = defineAction({
  name: 'subcontract_issue_sign', label: '登记供应商签收', objectName: 'forge_subcontract_issue', icon: 'badge-check',
  locations: [...locations], order: 40, visible: `record.status == 'issued'`, refreshAfter: true,
  params: [{ name: 'sign_note', label: '签收说明', type: 'textarea', required: true }], successMessage: '供应商签收已登记',
  body: { language: 'js', capabilities: ['api.read','api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),record=ctx.record,actor=ctx.session&&ctx.session.userId,note=String(ctx.input.sign_note||'').trim();if(ctx.recordLoadDenied===true||!id||!record)throw new Error('委外发料单不存在或不可访问');if(!actor)throw new Error('无法识别当前登记人');if(record.status!=='issued')throw new Error('只有已实际发出的物料可以登记供应商签收');if(!note)throw new Error('签收说明不能为空');const now=new Date().toISOString();await ctx.api.object('forge_subcontract_issue').update({id,status:'signed',signed_by:actor,signed_at:now,sign_note:note});const lines=await ctx.api.object('forge_subcontract_issue_line').find({where:{issue_id:id}});for(const line of lines)await ctx.api.object('forge_subcontract_issue_line').update({id:line.id,status:'signed'});await ctx.api.object('forge_subcontract_issue_log').insert({name:record.code+' 供应商签收',issue_id:id,action:'signed',from_status:'issued',to_status:'signed',comment:note,occurred_at:now,operator_id:actor});return{id,status:'signed',processing_started:false,quantity:Number(record.total_quantity||0)};
` },
});
