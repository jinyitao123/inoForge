import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

export const PurchaseRequestSubmit = defineAction({
  name: 'purchase_request_submit', label: '提交审批', objectName: 'forge_purchase_request', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft' || record.status == 'rejected'`, refreshAfter: true,
  confirmText: '提交前将校验基本信息与采购明细，是否继续？', successMessage: '采购申请已提交审批',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),request=ctx.record,actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!id||!request)throw new Error('当前采购申请不存在或不可访问');
if(!['draft','rejected'].includes(request.status))throw new Error('仅草稿或已驳回申请可以提交审批');
if(!actor)throw new Error('无法识别当前操作人');
if(!request.name||!request.expected_arrival_on||!request.responsible_id||!String(request.purchase_reason||'').trim())throw new Error('申请标题、期望到货日期、负责人和采购原因不能为空');
const lines=await ctx.api.object('forge_purchase_request_line').find({where:{request_id:id}});if(!lines.length)throw new Error('采购申请至少需要一条物料明细');
const round4=v=>Math.round((Number(v)+Number.EPSILON)*10000)/10000;
for(const line of lines)if(!(Number(line.quantity||0)>0))throw new Error('采购数量必须大于0');
const totalQuantity=round4(lines.reduce((s,x)=>s+Number(x.quantity||0),0)),totalAmount=round4(lines.reduce((s,x)=>s+Number(x.taxed_subtotal||0),0)),now=new Date().toISOString();
await ctx.api.object('forge_purchase_request').update({id,line_count:lines.length,total_quantity:totalQuantity,estimated_taxed_amount:totalAmount,status:'pending_approval',submitted_at:now,submitted_by:actor,approval_comment:null});
await ctx.api.object('forge_purchase_request_approval_log').insert({name:request.code+' 提交审批',request_id:id,action:'submitted',from_status:request.status,to_status:'pending_approval',comment:'提交审批',occurred_at:now,operator_id:actor});
return{id,status:'pending_approval',line_count:lines.length,total_quantity:totalQuantity,estimated_taxed_amount:totalAmount};
` },
});

export const PurchaseRequestApprove = defineAction({
  name: 'purchase_request_approve', label: '审批通过', objectName: 'forge_purchase_request', icon: 'circle-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  params: [{ name: 'approval_comment', label: '审批意见', type: 'textarea', required: true }], successMessage: '采购申请已审批通过',
  body: { language: 'js', capabilities: ['api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),request=ctx.record,actor=ctx.session&&ctx.session.userId,note=String(ctx.input.approval_comment||'').trim();
if(ctx.recordLoadDenied===true||!id||!request)throw new Error('当前采购申请不存在或不可访问');if(request.status!=='pending_approval')throw new Error('采购申请状态已变化，请刷新后重试');if(!actor)throw new Error('无法识别当前操作人');if(!note)throw new Error('审批意见不能为空');
const now=new Date().toISOString();await ctx.api.object('forge_purchase_request').update({id,status:'approved',approved_at:now,approved_by:actor,approval_comment:note});
await ctx.api.object('forge_purchase_request_approval_log').insert({name:request.code+' 审批通过',request_id:id,action:'approved',from_status:'pending_approval',to_status:'approved',comment:note,occurred_at:now,operator_id:actor});return{id,status:'approved'};
` },
});

export const PurchaseRequestReject = defineAction({
  name: 'purchase_request_reject', label: '驳回', objectName: 'forge_purchase_request', icon: 'circle-x',
  locations: [...locations], order: 30, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  params: [{ name: 'approval_comment', label: '驳回原因', type: 'textarea', required: true }], successMessage: '采购申请已驳回',
  body: { language: 'js', capabilities: ['api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),request=ctx.record,actor=ctx.session&&ctx.session.userId,note=String(ctx.input.approval_comment||'').trim();
if(ctx.recordLoadDenied===true||!id||!request)throw new Error('当前采购申请不存在或不可访问');if(request.status!=='pending_approval')throw new Error('采购申请状态已变化，请刷新后重试');if(!actor)throw new Error('无法识别当前操作人');if(!note)throw new Error('驳回原因不能为空');
const now=new Date().toISOString();await ctx.api.object('forge_purchase_request').update({id,status:'rejected',approval_comment:note});await ctx.api.object('forge_purchase_request_approval_log').insert({name:request.code+' 审批驳回',request_id:id,action:'rejected',from_status:'pending_approval',to_status:'rejected',comment:note,occurred_at:now,operator_id:actor});return{id,status:'rejected'};
` },
});

export const PurchaseRequestCancel = defineAction({
  name: 'purchase_request_cancel', label: '取消申请', objectName: 'forge_purchase_request', icon: 'ban',
  locations: [...locations], order: 40, visible: `record.status == 'draft' || record.status == 'rejected'`, refreshAfter: true,
  params: [{ name: 'cancel_reason', label: '取消原因', type: 'textarea', required: true }], successMessage: '采购申请已取消',
  body: { language: 'js', capabilities: ['api.write'], source: `
const id=ctx.recordId||(ctx.record&&ctx.record.id),request=ctx.record,actor=ctx.session&&ctx.session.userId,note=String(ctx.input.cancel_reason||'').trim();
if(ctx.recordLoadDenied===true||!id||!request)throw new Error('当前采购申请不存在或不可访问');if(!['draft','rejected'].includes(request.status))throw new Error('仅草稿或已驳回申请可以取消');if(!actor)throw new Error('无法识别当前操作人');if(!note)throw new Error('取消原因不能为空');
const now=new Date().toISOString();await ctx.api.object('forge_purchase_request').update({id,status:'cancelled',approval_comment:note});await ctx.api.object('forge_purchase_request_approval_log').insert({name:request.code+' 取消',request_id:id,action:'cancelled',from_status:request.status,to_status:'cancelled',comment:note,occurred_at:now,operator_id:actor});return{id,status:'cancelled'};
` },
});

export const BomShortageCreatePurchaseOrder = defineAction({
  name: 'bom_shortage_create_purchase_order', label: '提交采购审核', objectName: 'forge_bom_shortage_analysis', icon: 'shopping-cart',
  locations: [...locations], order: 10, visible: `record.status == 'completed'`, refreshAfter: true,
  description: '以本次缺料快照的缺口项生成一张待审核采购订单。', successMessage: 'BOM缺料采购订单已提交审核',
  params: [
    { field: 'code', objectOverride: 'forge_purchase_order', required: true },
    { field: 'supplier_id', objectOverride: 'forge_purchase_order', required: true },
    { field: 'warehouse_id', objectOverride: 'forge_purchase_order' },
    { field: 'expected_arrival_on', objectOverride: 'forge_purchase_order', required: true },
    { field: 'payment_term', objectOverride: 'forge_purchase_order', required: true },
    { field: 'payment_method', objectOverride: 'forge_purchase_order', required: true },
    { field: 'settlement_on', objectOverride: 'forge_purchase_order' },
    { field: 'arrival_address', objectOverride: 'forge_purchase_order' },
    { field: 'remarks', objectOverride: 'forge_purchase_order' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/page/page_purchase_order_workspace?id=${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const analysisId=ctx.recordId||(ctx.record&&ctx.record.id), analysis=ctx.record, actor=ctx.session&&ctx.session.userId;
if(ctx.recordLoadDenied===true||!analysisId||!analysis) throw new Error('当前缺料分析不存在或不可访问');
if(!actor) throw new Error('无法识别当前操作人');
if(analysis.status!=='completed') throw new Error('仅已完成的缺料分析可以生成采购订单');
const bom=await ctx.api.object('forge_bom').findOne({where:{id:analysis.bom_id}});
if(!bom||bom.status!=='active') throw new Error('关联BOM必须处于已生效状态');
const supplier=await ctx.api.object('forge_supplier').findOne({where:{id:ctx.input.supplier_id}});
if(!supplier||supplier.status!=='active'||supplier.approval_status!=='approved') throw new Error('供应商必须启用且已审批');
const existing=await ctx.api.object('forge_purchase_order').findOne({where:{shortage_analysis_id:analysisId}});
if(existing&&!['cancelled','rejected'].includes(existing.status)) throw new Error('该缺料快照已生成有效采购订单');
const lines=(await ctx.api.object('forge_bom_shortage_line').find({where:{analysis_id:analysisId}})).filter(line=>Number(line.shortage_quantity||0)>0&&line.source_type==='purchased');
if(!lines.length) throw new Error('该缺料快照没有可采购的缺口项');
const code=String(ctx.input.code||'').trim(), expected=ctx.input.expected_arrival_on, paymentTerm=String(ctx.input.payment_term||'').trim();
if(!code||!expected||!paymentTerm||!ctx.input.payment_method) throw new Error('采购订单号、供应商、付款条件、付款方式和期望到货日期不能为空');
const round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000;
const round2=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
let totalQuantity=0,totalAmount=0; const prepared=[];
for(const line of lines){
  const sku=await ctx.api.object('forge_material_sku').findOne({where:{id:line.sku_id}}); if(!sku||sku.enabled===false) throw new Error('缺料明细包含不可用物料规格');
  const quantity=Number(line.shortage_quantity||0), taxRate=Number(bom.tax_rate||13), untaxed=round2(Number(line.untaxed_unit_price||0)), taxed=round4(untaxed*(1+taxRate/100)), subtotal=round2(quantity*taxed);
  totalQuantity+=quantity; totalAmount+=subtotal; prepared.push({line,sku,quantity,taxRate,untaxed,taxed,subtotal});
}
const now=new Date().toISOString(), today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10); totalQuantity=round4(totalQuantity); totalAmount=round4(totalAmount);
const created=await ctx.api.object('forge_purchase_order').insert({name:supplier.name+' - 采购订单',code,supplier_id:supplier.id,source_type:'bom_shortage',bom_id:bom.id,shortage_analysis_id:analysisId,project_id:analysis.project_id||bom.project_id||null,warehouse_id:ctx.input.warehouse_id||null,expected_arrival_on:expected,order_on:today,payment_term:paymentTerm,payment_method:ctx.input.payment_method,currency:'cny',exchange_rate:1,payable_trigger:'inbound',settlement_on:ctx.input.settlement_on||null,arrival_address:ctx.input.arrival_address||null,responsible_id:actor,line_count:prepared.length,total_quantity:totalQuantity,total_amount:totalAmount,arrived_quantity:0,inbound_quantity:0,status:'pending_approval',submitted_at:now,submitted_by:actor,remarks:ctx.input.remarks||('由BOM '+bom.code+' 缺料分析生成')});
const orderId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id)); if(!orderId) throw new Error('采购订单创建后未返回记录ID');
for(const item of prepared) await ctx.api.object('forge_purchase_order_line').insert({name:item.line.name,order_id:orderId,sku_id:item.line.sku_id,item_code:item.line.item_code,model:item.line.model,specification:item.line.specification,unit_name:item.line.unit_name,quantity:item.quantity,arrived_quantity:0,inspected_quantity:0,accepted_quantity:0,inbound_quantity:0,taxed_unit_price:item.taxed,untaxed_unit_price:item.untaxed,tax_rate:item.taxRate,taxed_subtotal:item.subtotal,source_bom_id:bom.id,source_analysis_line_id:item.line.id,expected_arrival_on:expected});
await ctx.api.object('forge_purchase_order_approval_log').insert({name:code+' 提交审核',order_id:orderId,action:'submitted',from_status:'draft',to_status:'pending_approval',comment:ctx.input.remarks||'提交审核',occurred_at:now,operator_id:actor});
return {id:orderId,status:'pending_approval',line_count:prepared.length,total_quantity:totalQuantity,total_amount:totalAmount,bom_id:bom.id,shortage_analysis_id:analysisId};
` },
});

export const PurchaseOrderSubmit = defineAction({
  name: 'purchase_order_submit', label: '提交审核', objectName: 'forge_purchase_order', icon: 'send',
  locations: [...locations], order: 10, visible: `record.status == 'draft'`, refreshAfter: true,
  confirmText: '提交前将校验供应商、付款条件、交期与采购明细，是否继续？', successMessage: '采购订单已提交审核',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前采购订单不存在或不可访问');
if (order.status !== 'draft') throw new Error('采购订单状态已变化，请刷新后重试');
const supplier = await ctx.api.object('forge_supplier').findOne({ where: { id: order.supplier_id } });
if (!supplier || supplier.status !== 'active' || supplier.approval_status !== 'approved') throw new Error('供应商必须启用且已审批');
const lines = await ctx.api.object('forge_purchase_order_line').find({ where: { order_id: id } });
if (!lines.length) throw new Error('采购订单至少需要一条物料明细');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
for (const line of lines) if (!(Number(line.quantity || 0) > 0)) throw new Error('采购数量必须大于0');
const totalQuantity = round4(lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0));
const totalAmount = round4(lines.reduce((sum, line) => sum + Number(line.taxed_subtotal || 0), 0));
const actor=ctx.session&&ctx.session.userId; if(!actor) throw new Error('无法识别当前操作人'); const now=new Date().toISOString(), today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);
await ctx.api.object('forge_purchase_order').update({ id, line_count: lines.length, total_quantity: totalQuantity, total_amount: totalAmount, status: 'pending_approval', submitted_at:now, submitted_by:actor, order_on:order.order_on||today });
await ctx.api.object('forge_purchase_order_approval_log').insert({name:order.code+' 提交审核',order_id:id,action:'submitted',from_status:'draft',to_status:'pending_approval',comment:'提交审核',occurred_at:now,operator_id:actor});
return { id, status: 'pending_approval', line_count: lines.length, total_quantity: totalQuantity, total_amount: totalAmount };
` },
});

export const PurchaseOrderApprove = defineAction({
  name: 'purchase_order_approve', label: '同意', objectName: 'forge_purchase_order', icon: 'circle-check',
  locations: [...locations], order: 10, visible: `record.status == 'pending_approval'`, refreshAfter: true,
  params: [{ name: 'approval_note', label: '审批意见', type: 'textarea', required: true }],
  description: '审批通过后生成一张订单级到货通知。', successMessage: '采购订单已审核并生成到货通知',
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const order = ctx.record;
if (ctx.recordLoadDenied === true || !id || !order) throw new Error('当前采购订单不存在或不可访问');
if (order.status !== 'pending_approval') throw new Error('采购订单状态已变化，请刷新后重试');
const lines = await ctx.api.object('forge_purchase_order_line').find({ where: { order_id: id } });
if (!lines.length) throw new Error('采购订单至少需要一条物料明细');
const actor=ctx.session&&ctx.session.userId, note=String(ctx.input.approval_note||'').trim(); if(!actor) throw new Error('无法识别当前操作人'); if(!note) throw new Error('审批意见不能为空');
let notice=await ctx.api.object('forge_purchase_arrival_notice').findOne({where:{order_id:id}}), noticeId=notice&&notice.id;
if(!notice||notice.status==='cancelled'){
  const total=lines.reduce((sum,line)=>sum+Number(line.quantity||0),0);
  const created=await ctx.api.object('forge_purchase_arrival_notice').insert({name:order.code+' 到货通知',code:order.code+'-AN-001',order_id:id,order_line_id:lines[0].id,sku_id:lines[0].sku_id,item_code:lines[0].item_code||null,supplier_id:order.supplier_id,warehouse_id:order.warehouse_id||null,expected_arrival_on:order.expected_arrival_on,line_count:lines.length,planned_quantity:total,arrived_quantity:0,status:'pending_arrival',responsible_id:order.responsible_id,remarks:'由采购订单 '+order.code+' 审核生成'});
  noticeId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id)); if(!noticeId) throw new Error('到货通知创建后未返回记录ID');
  for(const line of lines) await ctx.api.object('forge_purchase_arrival_notice_line').insert({name:line.name,notice_id:noticeId,order_id:id,order_line_id:line.id,sku_id:line.sku_id,item_code:line.item_code,model:line.model,specification:line.specification,unit_name:line.unit_name,planned_quantity:line.quantity,arrived_quantity:0,status:'pending_arrival'});
}
const now=new Date().toISOString();
await ctx.api.object('forge_purchase_order').update({ id, status: 'approved', approved_at:now, approved_by:actor });
await ctx.api.object('forge_purchase_order_approval_log').insert({name:order.code+' 审核同意',order_id:id,action:'approved',from_status:'pending_approval',to_status:'approved',comment:note,occurred_at:now,operator_id:actor});
return { id, status: 'approved', arrival_notice_count: 1, arrival_notice_id: noticeId };
` },
});

export const PurchaseArrivalRegister = defineAction({
  name: 'purchase_arrival_register', label: '登记到货', objectName: 'forge_purchase_arrival_notice', icon: 'package-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending_arrival' || record.status == 'partially_arrived'`, refreshAfter: true,
  description: '按到货通知的多条物料明细保存草稿或提交待检。', successMessage: '到货登记已保存',
  params: [
    { field: 'arrived_on', objectOverride: 'forge_purchase_receipt', required: true },
    { name: 'mode', label: '办理方式', type: 'select', required: true, options: [{ value: 'draft', label: '保存草稿' }, { value: 'submit', label: '提交待检' }] },
    { field: 'contact_name', objectOverride: 'forge_purchase_receipt' },
    { field: 'contact_phone', objectOverride: 'forge_purchase_receipt' },
    { field: 'carrier', objectOverride: 'forge_purchase_receipt' },
    { field: 'logistics_number', objectOverride: 'forge_purchase_receipt' },
    { field: 'customer_id', objectOverride: 'forge_purchase_receipt' },
    { name: 'lines_json', label: '到货物料明细', type: 'textarea', required: true },
    { field: 'remarks', objectOverride: 'forge_purchase_receipt' },
  ],
  onSuccess: { navigate: '/_console/apps/forge/page/page_purchase_arrival_workspace?id=${result.id}' },
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const notice = ctx.record;
if (ctx.recordLoadDenied === true || !id || !notice) throw new Error('当前到货通知不存在或不可访问');
if (!['pending_arrival', 'partially_arrived'].includes(notice.status)) throw new Error('到货通知状态已变化，请刷新后重试');
const order = await ctx.api.object('forge_purchase_order').findOne({ where: { id: notice.order_id } });
if (!order || order.supplier_id !== notice.supplier_id) throw new Error('到货通知关联的采购订单不存在或供应商不一致');
const actor=ctx.session&&ctx.session.userId; if(!actor) throw new Error('无法识别当前操作人');
const mode=ctx.input.mode; if(!['draft','submit'].includes(mode)) throw new Error('办理方式必须为保存草稿或提交待检');
let inputs; try{inputs=typeof ctx.input.lines_json==='string'?JSON.parse(ctx.input.lines_json):ctx.input.lines_json;}catch{throw new Error('到货物料明细格式错误');}
if(!Array.isArray(inputs)||!inputs.length) throw new Error('至少需要一条到货物料明细');
const noticeLines=await ctx.api.object('forge_purchase_arrival_notice_line').find({where:{notice_id:id}}), byId=Object.fromEntries(noticeLines.map(line=>[line.id,line]));
const seen=new Set(), prepared=[]; const round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000;
let totalQuantity=0,untaxedAmount=0,taxedAmount=0;
for(const input of inputs){
  const noticeLine=byId[input.notice_line_id]; if(!noticeLine||seen.has(noticeLine.id)) throw new Error('到货明细包含无效或重复的通知物料'); seen.add(noticeLine.id);
  const quantity=Number(input.quantity||0), remaining=round4(Number(noticeLine.planned_quantity||0)-Number(noticeLine.arrived_quantity||0));
  if(!Number.isFinite(quantity)||quantity<0) throw new Error('到货数量不能为负数'); if(quantity===0) continue;
  if(quantity>remaining) throw new Error((noticeLine.item_code||noticeLine.name)+' 到货数量超过剩余可到数量');
  if(!input.warehouse_id) throw new Error((noticeLine.item_code||noticeLine.name)+' 必须选择到货仓库');
  const warehouse=await ctx.api.object('forge_warehouse').findOne({where:{id:input.warehouse_id}}); if(!warehouse) throw new Error('到货仓库不存在或不可用');
  const orderLine=await ctx.api.object('forge_purchase_order_line').findOne({where:{id:noticeLine.order_line_id}}); if(!orderLine||orderLine.order_id!==order.id) throw new Error('通知物料关联的采购订单明细不存在');
  const round2=value=>Math.round((Number(value)+Number.EPSILON)*100)/100,taxedUnit=Number(orderLine.taxed_unit_price||0),untaxedUnit=Number(orderLine.untaxed_unit_price||0),lineTaxed=round2(quantity*taxedUnit),lineUntaxed=round2(quantity*untaxedUnit);
  totalQuantity=round4(totalQuantity+quantity);taxedAmount=round4(taxedAmount+lineTaxed);untaxedAmount=round4(untaxedAmount+lineUntaxed);
  prepared.push({input,noticeLine,orderLine,quantity,warehouseId:warehouse.id,taxedUnit,untaxedUnit,lineTaxed,lineUntaxed});
}
if(!prepared.length) throw new Error('至少一条物料的到货数量必须大于0');
const year=String(ctx.input.arrived_on||'').slice(0,4)||new Date(Date.now()+8*60*60*1000).toISOString().slice(0,4), existing=await ctx.api.object('forge_purchase_receipt').find({where:{}}), code='ARR-'+year+'-'+String(existing.length+1).padStart(4,'0');
const warehouseIds=[...new Set(prepared.map(item=>item.warehouseId))], now=new Date().toISOString(), status=mode==='submit'?'pending_inspection':'draft';
const created=await ctx.api.object('forge_purchase_receipt').insert({name:code+' 采购到货登记',code,notice_id:id,order_id:order.id,order_line_id:prepared[0].orderLine.id,sku_id:prepared[0].noticeLine.sku_id,item_code:prepared[0].noticeLine.item_code||null,quantity:prepared[0].quantity,batch_number:prepared[0].input.batch_number||null,taxed_unit_price:prepared[0].taxedUnit,supplier_id:notice.supplier_id,customer_id:ctx.input.customer_id||null,warehouse_id:warehouseIds.length===1?warehouseIds[0]:null,arrival_type:'purchase',arrived_on:ctx.input.arrived_on,contact_name:ctx.input.contact_name||null,contact_phone:ctx.input.contact_phone||null,carrier:ctx.input.carrier||null,logistics_number:ctx.input.logistics_number||null,line_count:prepared.length,total_quantity:totalQuantity,untaxed_amount:untaxedAmount,taxed_amount:taxedAmount,status,submitted_at:mode==='submit'?now:null,submitted_by:mode==='submit'?actor:null,responsible_id:actor,remarks:ctx.input.remarks||('由到货通知 '+notice.code+' 登记')});
const receiptId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id)); if(!receiptId) throw new Error('到货登记创建后未返回记录ID');
const savedLines=[];for(const item of prepared){const saved=await ctx.api.object('forge_purchase_receipt_line').insert({name:item.noticeLine.name,receipt_id:receiptId,notice_id:id,notice_line_id:item.noticeLine.id,order_id:order.id,order_line_id:item.orderLine.id,sku_id:item.noticeLine.sku_id,item_code:item.noticeLine.item_code,model:item.noticeLine.model,specification:item.noticeLine.specification,unit_name:item.noticeLine.unit_name,quantity:item.quantity,warehouse_id:item.warehouseId,warehouse_location:item.input.warehouse_location||null,external_sn:item.input.external_sn||null,batch_number:item.input.batch_number||null,taxed_unit_price:item.taxedUnit,untaxed_unit_price:item.untaxedUnit,tax_rate:item.orderLine.tax_rate||13,untaxed_amount:item.lineUntaxed,taxed_amount:item.lineTaxed,status,remarks:item.input.remarks||null});const savedId=typeof saved==='string'?saved:saved&&(saved.id||(saved.record&&saved.record.id));if(!savedId)throw new Error('到货明细创建后未返回记录ID');savedLines.push({...item,receiptLineId:savedId});}
if(mode==='submit'){
  const pendingExisting=await ctx.api.object('forge_pending_inspection').find({where:{}}),pendingBase=pendingExisting.length;
  for(let index=0;index<savedLines.length;index++){const item=savedLines[index],pendingCode='PIN-'+year+'-'+String(pendingBase+index+1).padStart(4,'0');await ctx.api.object('forge_pending_inspection').insert({name:pendingCode+' '+item.noticeLine.name,code:pendingCode,receipt_id:receiptId,receipt_line_id:item.receiptLineId,order_id:order.id,order_line_id:item.orderLine.id,supplier_id:notice.supplier_id,customer_id:ctx.input.customer_id||null,warehouse_id:item.warehouseId,sku_id:item.noticeLine.sku_id,item_code:item.noticeLine.item_code,model:item.noticeLine.model,specification:item.noticeLine.specification,unit_name:item.noticeLine.unit_name,arrival_quantity:item.quantity,batch_number:item.input.batch_number||null,external_sn:item.input.external_sn||null,arrived_on:ctx.input.arrived_on,status:'pending',responsible_id:actor,remarks:'由到货登记 '+code+' 提交待检'});}
  for(const item of prepared){const next=round4(Number(item.noticeLine.arrived_quantity||0)+item.quantity), lineStatus=next>=Number(item.noticeLine.planned_quantity||0)?'arrived':'partially_arrived';await ctx.api.object('forge_purchase_arrival_notice_line').update({id:item.noticeLine.id,arrived_quantity:next,status:lineStatus});await ctx.api.object('forge_purchase_order_line').update({id:item.orderLine.id,arrived_quantity:round4(Number(item.orderLine.arrived_quantity||0)+item.quantity)});}
  const noticeNext=round4(Number(notice.arrived_quantity||0)+totalQuantity),noticeStatus=noticeNext>=Number(notice.planned_quantity||0)?'arrived':'partially_arrived',orderNext=round4(Number(order.arrived_quantity||0)+totalQuantity),orderStatus=orderNext>=Number(order.total_quantity||0)?'arrived':'partially_arrived';
  await ctx.api.object('forge_purchase_arrival_notice').update({id,arrived_quantity:noticeNext,status:noticeStatus});await ctx.api.object('forge_purchase_order').update({id:order.id,arrived_quantity:orderNext,status:orderStatus});
}
return {id:receiptId,code,status,line_count:prepared.length,total_quantity:totalQuantity,untaxed_amount:untaxedAmount,taxed_amount:taxedAmount,notice_status:mode==='submit'?(Number(notice.arrived_quantity||0)+totalQuantity>=Number(notice.planned_quantity||0)?'arrived':'partially_arrived'):notice.status};
` },
});

export const PurchaseReceiptSubmit = defineAction({
  name:'purchase_receipt_submit',label:'提交待检',objectName:'forge_purchase_receipt',icon:'send',locations:[...locations],order:20,visible:`record.status == 'draft'`,refreshAfter:true,
  description:'把草稿到货登记提交到待检库存，并回写通知与采购订单到货进度。',successMessage:'到货登记已提交待检',
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),receipt=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!receipt)throw new Error('当前到货登记不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(receipt.status!=='draft')throw new Error('到货登记状态已变化，请刷新后重试');
const notice=await ctx.api.object('forge_purchase_arrival_notice').findOne({where:{id:receipt.notice_id}}),order=await ctx.api.object('forge_purchase_order').findOne({where:{id:receipt.order_id}}),lines=await ctx.api.object('forge_purchase_receipt_line').find({where:{receipt_id:id}});if(!notice||!order||!lines.length)throw new Error('到货登记关联的通知、订单或明细不存在');
const round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000;let total=0;const prepared=[];
for(const line of lines){const noticeLine=await ctx.api.object('forge_purchase_arrival_notice_line').findOne({where:{id:line.notice_line_id}}),orderLine=await ctx.api.object('forge_purchase_order_line').findOne({where:{id:line.order_line_id}});if(!noticeLine||!orderLine||!line.warehouse_id)throw new Error('到货明细的通知、订单或仓库引用不完整');const quantity=Number(line.quantity||0),remaining=round4(Number(noticeLine.planned_quantity||0)-Number(noticeLine.arrived_quantity||0));if(!(quantity>0)||quantity>remaining)throw new Error((line.item_code||line.name)+' 到货数量超过当前剩余可到数量');total=round4(total+quantity);prepared.push({line,noticeLine,orderLine,quantity});}
const existingPending=await ctx.api.object('forge_pending_inspection').find({where:{receipt_id:id}});if(existingPending.length)throw new Error('该到货登记已经生成待检记录');const year=String(receipt.arrived_on||'').slice(0,4)||new Date(Date.now()+8*60*60*1000).toISOString().slice(0,4),allPending=await ctx.api.object('forge_pending_inspection').find({where:{}}),pendingBase=allPending.length;
for(let index=0;index<prepared.length;index++){const item=prepared[index],pendingCode='PIN-'+year+'-'+String(pendingBase+index+1).padStart(4,'0');await ctx.api.object('forge_pending_inspection').insert({name:pendingCode+' '+item.line.name,code:pendingCode,receipt_id:id,receipt_line_id:item.line.id,order_id:order.id,order_line_id:item.orderLine.id,supplier_id:receipt.supplier_id,customer_id:receipt.customer_id||null,warehouse_id:item.line.warehouse_id,sku_id:item.line.sku_id,item_code:item.line.item_code,model:item.line.model,specification:item.line.specification,unit_name:item.line.unit_name,arrival_quantity:item.quantity,batch_number:item.line.batch_number||null,external_sn:item.line.external_sn||null,arrived_on:receipt.arrived_on,status:'pending',responsible_id:actor,remarks:'由到货登记 '+receipt.code+' 提交待检'});}
for(const item of prepared){const next=round4(Number(item.noticeLine.arrived_quantity||0)+item.quantity),lineStatus=next>=Number(item.noticeLine.planned_quantity||0)?'arrived':'partially_arrived';await ctx.api.object('forge_purchase_arrival_notice_line').update({id:item.noticeLine.id,arrived_quantity:next,status:lineStatus});await ctx.api.object('forge_purchase_order_line').update({id:item.orderLine.id,arrived_quantity:round4(Number(item.orderLine.arrived_quantity||0)+item.quantity)});await ctx.api.object('forge_purchase_receipt_line').update({id:item.line.id,status:'pending_inspection'});}
const noticeNext=round4(Number(notice.arrived_quantity||0)+total),noticeStatus=noticeNext>=Number(notice.planned_quantity||0)?'arrived':'partially_arrived',orderNext=round4(Number(order.arrived_quantity||0)+total),orderStatus=orderNext>=Number(order.total_quantity||0)?'arrived':'partially_arrived',now=new Date().toISOString();await ctx.api.object('forge_purchase_arrival_notice').update({id:notice.id,arrived_quantity:noticeNext,status:noticeStatus});await ctx.api.object('forge_purchase_order').update({id:order.id,arrived_quantity:orderNext,status:orderStatus});await ctx.api.object('forge_purchase_receipt').update({id,status:'pending_inspection',submitted_at:now,submitted_by:actor});return{id,status:'pending_inspection',total_quantity:total,notice_status:noticeStatus};
`},
});

export const PendingInspectionCreateOrder = defineAction({
  name:'pending_inspection_create_order',label:'生成检验单',objectName:'forge_pending_inspection',icon:'clipboard-plus',locations:[...locations],order:20,visible:`record.status == 'pending'`,refreshAfter:true,
  description:'按一条待检物料生成一张采购检验单。',successMessage:'采购检验单已生成',
  params:[{field:'inspection_method',objectOverride:'forge_purchase_inspection',required:true}],
  onSuccess:{navigate:'/_console/apps/forge/page/page_purchase_inspection_workspace?id=${result.id}'},
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),pending=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!pending)throw new Error('当前待检记录不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(pending.status!=='pending')throw new Error('待检记录状态已变化，请刷新后重试');if(!['full','sampling'].includes(ctx.input.inspection_method))throw new Error('检验方式必须为全检或抽检');
const receipt=await ctx.api.object('forge_purchase_receipt').findOne({where:{id:pending.receipt_id}}),receiptLine=await ctx.api.object('forge_purchase_receipt_line').findOne({where:{id:pending.receipt_line_id}});if(!receipt||!receiptLine||receiptLine.status!=='pending_inspection')throw new Error('待检记录关联的到货登记或物料明细状态不正确');const existing=await ctx.api.object('forge_purchase_inspection').find({where:{pending_inspection_id:id}});if(existing.length)throw new Error('该待检物料已经生成检验单');
const year=String(pending.arrived_on||'').slice(0,4)||new Date(Date.now()+8*60*60*1000).toISOString().slice(0,4),all=await ctx.api.object('forge_purchase_inspection').find({where:{}}),code='IQC-'+year+'-'+String(all.length+1).padStart(4,'0');const created=await ctx.api.object('forge_purchase_inspection').insert({name:code+' '+pending.name,code,receipt_id:pending.receipt_id,receipt_line_id:pending.receipt_line_id,pending_inspection_id:id,order_id:pending.order_id,order_line_id:pending.order_line_id,supplier_id:pending.supplier_id,warehouse_id:pending.warehouse_id,sku_id:pending.sku_id,item_code:pending.item_code,model:pending.model,specification:pending.specification,unit_name:pending.unit_name,batch_number:pending.batch_number||null,inspection_method:ctx.input.inspection_method,total_quantity:pending.arrival_quantity,accepted_quantity:0,rejected_quantity:0,result:'pending',status:'pending',inspector_id:actor,remarks:'由待检记录 '+pending.code+' 生成'});const inspectionId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id));if(!inspectionId)throw new Error('检验单创建后未返回记录ID');await ctx.api.object('forge_pending_inspection').update({id,status:'inspection_created',inspection_id:inspectionId});await ctx.api.object('forge_purchase_receipt_line').update({id:pending.receipt_line_id,status:'inspection_created'});await ctx.api.object('forge_purchase_receipt').update({id:receipt.id,status:'inspection_in_progress'});return{id:inspectionId,code,status:'pending',total_quantity:pending.arrival_quantity,pending_inspection_id:id};
`},
});

export const PurchaseInspectionComplete = defineAction({
  name: 'purchase_inspection_complete', label: '完成检验', objectName: 'forge_purchase_inspection', icon: 'clipboard-check',
  locations: [...locations], order: 20, visible: `record.status == 'pending'`, refreshAfter: true,
  description: '登记合格数量，不合格数量由到货总数自动计算。', successMessage: '检验已完成',
  params: [
    { field: 'inspected_on', objectOverride: 'forge_purchase_inspection', required: true },
    { field: 'accepted_quantity', objectOverride: 'forge_purchase_inspection', required: true },
    { field: 'inspection_note', objectOverride: 'forge_purchase_inspection', required: true },
  ],
  body: { language: 'js', capabilities: ['api.read', 'api.write'], source: `
const id = ctx.recordId || (ctx.record && ctx.record.id); const inspection = ctx.record;
if (ctx.recordLoadDenied === true || !id || !inspection) throw new Error('当前检验单不存在或不可访问');
if (inspection.status !== 'pending') throw new Error('检验单状态已变化，请刷新后重试');
const total = Number(inspection.total_quantity || 0), accepted = Number(ctx.input.accepted_quantity);
if (!Number.isFinite(accepted) || accepted < 0 || accepted > total) throw new Error('合格数量必须在0和到货总数之间');
const note=String(ctx.input.inspection_note||'').trim();if(!note)throw new Error('检验结论不能为空');
const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const rejected = round4(total - accepted), result = accepted === total ? 'passed' : accepted > 0 ? 'partial' : 'rejected';
const line = await ctx.api.object('forge_purchase_order_line').findOne({ where: { id: inspection.order_line_id } });
if (!line) throw new Error('检验单关联的采购订单明细不存在');
await ctx.api.object('forge_purchase_inspection').update({ id, accepted_quantity: accepted, rejected_quantity: rejected, inspected_on: ctx.input.inspected_on, result, status: 'completed', inspection_note: note });
if(inspection.pending_inspection_id)await ctx.api.object('forge_pending_inspection').update({id:inspection.pending_inspection_id,status:'inspected'});if(inspection.receipt_line_id)await ctx.api.object('forge_purchase_receipt_line').update({id:inspection.receipt_line_id,status:'inspected'});const receiptLines=await ctx.api.object('forge_purchase_receipt_line').find({where:{receipt_id:inspection.receipt_id}}),allDone=receiptLines.every(item=>item.id===inspection.receipt_line_id||['inspected','stocked','cancelled'].includes(item.status));await ctx.api.object('forge_purchase_receipt').update({ id: inspection.receipt_id, status:allDone?'inspected':'inspection_in_progress' });
await ctx.api.object('forge_purchase_order_line').update({ id: line.id, inspected_quantity: round4(Number(line.inspected_quantity || 0) + total), accepted_quantity: round4(Number(line.accepted_quantity || 0) + accepted) });
return { id, status: 'completed', result, accepted_quantity: accepted, rejected_quantity: rejected, receipt_status:allDone?'inspected':'inspection_in_progress' };
` },
});

export const PurchaseOrderCreateInbound = defineAction({
  name:'purchase_order_create_inbound',label:'新建采购入库',objectName:'forge_purchase_order',icon:'package-plus',locations:[...locations],order:40,visible:`record.status == 'arrived' || record.status == 'partially_arrived'`,refreshAfter:true,
  description:'从已完成检验的合格物料生成一张多明细采购入库单。',successMessage:'采购入库单已创建',
  params:[{name:'mode',label:'办理方式',type:'select',required:true,options:[{value:'draft',label:'保存草稿'},{value:'submit',label:'提交审批'}]},{field:'inbound_on',objectOverride:'forge_purchase_inbound',required:true},{name:'lines_json',label:'入库物料明细',type:'textarea',required:true},{field:'remarks',objectOverride:'forge_purchase_inbound'}],
  onSuccess:{navigate:'/_console/apps/forge/page/page_purchase_inbound_workspace?id=${result.id}'},
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),order=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!order)throw new Error('当前采购订单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(!['arrived','partially_arrived'].includes(order.status))throw new Error('采购订单状态不允许新建入库单');const mode=ctx.input.mode;if(!['draft','submit'].includes(mode))throw new Error('办理方式必须为保存草稿或提交审批');if(!ctx.input.inbound_on)throw new Error('入库日期不能为空');const year=String(ctx.input.inbound_on).slice(0,4)||new Date(Date.now()+8*60*60*1000).toISOString().slice(0,4),allInbounds=await ctx.api.object('forge_purchase_inbound').find({where:{}}),code='PIN-'+year+'-'+String(allInbounds.length+1).padStart(4,'0');let inputs;try{inputs=typeof ctx.input.lines_json==='string'?JSON.parse(ctx.input.lines_json):ctx.input.lines_json;}catch{throw new Error('入库物料明细格式错误');}if(!Array.isArray(inputs)||!inputs.length)throw new Error('至少需要一条入库物料明细');
const seen=new Set(),prepared=[],round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000,round2=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;let totalQuantity=0,untaxedAmount=0,taxedAmount=0;
for(const input of inputs){if(seen.has(input.inspection_id))throw new Error('入库明细包含重复检验单');seen.add(input.inspection_id);const inspection=await ctx.api.object('forge_purchase_inspection').findOne({where:{id:input.inspection_id}});if(!inspection||inspection.order_id!==id||inspection.status!=='completed'||!(Number(inspection.accepted_quantity||0)>0))throw new Error('入库明细只能选择本订单已完成且有合格数量的检验单');const existing=await ctx.api.object('forge_purchase_inbound_line').find({where:{inspection_id:inspection.id}}),used=round4(existing.filter(line=>line.status!=='cancelled').reduce((sum,line)=>sum+Number(line.quantity||0),0)),remaining=round4(Number(inspection.accepted_quantity||0)-used),quantity=Number(input.quantity||0);if(!(quantity>0)||quantity>remaining)throw new Error((inspection.item_code||inspection.name)+' 入库数量超过检验合格剩余数量');const orderLine=await ctx.api.object('forge_purchase_order_line').findOne({where:{id:inspection.order_line_id}}),receiptLine=await ctx.api.object('forge_purchase_receipt_line').findOne({where:{id:inspection.receipt_line_id}});if(!orderLine||!receiptLine)throw new Error('检验单关联的采购或到货明细不存在');const warehouseId=input.warehouse_id||inspection.warehouse_id;if(!warehouseId)throw new Error((inspection.item_code||inspection.name)+' 必须选择入库仓库');const warehouse=await ctx.api.object('forge_warehouse').findOne({where:{id:warehouseId}});if(!warehouse)throw new Error('入库仓库不存在');const taxedUnit=Number(orderLine.taxed_unit_price||0),untaxedUnit=Number(orderLine.untaxed_unit_price||0),lineTaxed=round2(quantity*taxedUnit),lineUntaxed=round2(quantity*untaxedUnit);totalQuantity=round4(totalQuantity+quantity);taxedAmount=round4(taxedAmount+lineTaxed);untaxedAmount=round4(untaxedAmount+lineUntaxed);prepared.push({input,inspection,orderLine,receiptLine,quantity,warehouseId,taxedUnit,untaxedUnit,lineTaxed,lineUntaxed});}
const status=mode==='submit'?'pending_approval':'draft',now=new Date().toISOString(),warehouseIds=[...new Set(prepared.map(item=>item.warehouseId))],receiptIds=[...new Set(prepared.map(item=>item.inspection.receipt_id))],primary=prepared[0],created=await ctx.api.object('forge_purchase_inbound').insert({name:code+' 采购入库',code,inbound_type:'purchase',source_type:'purchase_order',order_id:id,inspection_id:primary.inspection.id,order_line_id:primary.orderLine.id,sku_id:primary.inspection.sku_id,item_code:primary.inspection.item_code,batch_number:primary.inspection.batch_number||primary.receiptLine.batch_number||null,quantity:primary.quantity,unit_cost:primary.taxedUnit,inventory_amount:primary.lineTaxed,before_on_hand:0,after_on_hand:0,receipt_id:receiptIds.length===1?receiptIds[0]:null,supplier_id:order.supplier_id,warehouse_id:warehouseIds.length===1?warehouseIds[0]:null,inbound_on:ctx.input.inbound_on,line_count:prepared.length,total_quantity:totalQuantity,untaxed_amount:untaxedAmount,taxed_amount:taxedAmount,status,submitted_at:mode==='submit'?now:null,submitted_by:mode==='submit'?actor:null,responsible_id:actor,remarks:ctx.input.remarks||('由采购订单 '+order.code+' 创建')});const inboundId=typeof created==='string'?created:created&&(created.id||(created.record&&created.record.id));if(!inboundId)throw new Error('采购入库单创建后未返回记录ID');for(const item of prepared)await ctx.api.object('forge_purchase_inbound_line').insert({name:item.inspection.name,inbound_id:inboundId,inspection_id:item.inspection.id,receipt_id:item.inspection.receipt_id,receipt_line_id:item.inspection.receipt_line_id,order_id:id,order_line_id:item.orderLine.id,supplier_id:order.supplier_id,warehouse_id:item.warehouseId,warehouse_location:item.input.warehouse_location||item.receiptLine.warehouse_location||null,sku_id:item.inspection.sku_id,item_code:item.inspection.item_code,model:item.inspection.model,specification:item.inspection.specification,unit_name:item.inspection.unit_name,batch_number:item.inspection.batch_number||item.receiptLine.batch_number||null,external_sn:item.receiptLine.external_sn||null,quantity:item.quantity,taxed_unit_price:item.taxedUnit,untaxed_unit_price:item.untaxedUnit,tax_rate:item.orderLine.tax_rate||13,untaxed_amount:item.lineUntaxed,taxed_amount:item.lineTaxed,before_on_hand:0,after_on_hand:0,status,remarks:item.input.remarks||null});if(mode==='submit')await ctx.api.object('forge_purchase_inbound_approval_log').insert({name:code+' 提交审批',inbound_id:inboundId,action:'submitted',from_status:'draft',to_status:'pending_approval',comment:ctx.input.remarks||'提交审批',occurred_at:now,operator_id:actor});return{id:inboundId,code,status,line_count:prepared.length,total_quantity:totalQuantity,untaxed_amount:untaxedAmount,taxed_amount:taxedAmount};
`},
});

export const PurchaseInboundSubmit = defineAction({
  name:'purchase_inbound_submit',label:'提交审批',objectName:'forge_purchase_inbound',icon:'send',locations:[...locations],order:20,visible:`record.status == 'draft'`,refreshAfter:true,description:'把采购入库草稿提交审批。',successMessage:'采购入库单已提交审批',
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),inbound=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!inbound)throw new Error('当前采购入库单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(inbound.status!=='draft')throw new Error('入库单状态已变化，请刷新后重试');const lines=await ctx.api.object('forge_purchase_inbound_line').find({where:{inbound_id:id}});if(!lines.length||lines.some(line=>line.status!=='draft'||!(Number(line.quantity||0)>0)))throw new Error('入库单至少需要一条有效草稿物料');const now=new Date().toISOString();for(const line of lines)await ctx.api.object('forge_purchase_inbound_line').update({id:line.id,status:'pending_approval'});await ctx.api.object('forge_purchase_inbound').update({id,status:'pending_approval',submitted_at:now,submitted_by:actor});await ctx.api.object('forge_purchase_inbound_approval_log').insert({name:inbound.code+' 提交审批',inbound_id:id,action:'submitted',from_status:'draft',to_status:'pending_approval',comment:inbound.remarks||'提交审批',occurred_at:now,operator_id:actor});return{id,status:'pending_approval'};
`},
});

export const PurchaseInboundApprove = defineAction({
  name:'purchase_inbound_approve',label:'审批通过',objectName:'forge_purchase_inbound',icon:'badge-check',locations:[...locations],order:30,visible:`record.status == 'pending_approval'`,refreshAfter:true,description:'审批采购入库单；审批本身不增加库存。',successMessage:'采购入库单已审批',params:[{field:'approval_note',objectOverride:'forge_purchase_inbound',required:true}],
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),inbound=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!inbound)throw new Error('当前采购入库单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(inbound.status!=='pending_approval')throw new Error('入库单状态已变化，请刷新后重试');const note=String(ctx.input.approval_note||'').trim();if(!note)throw new Error('审批意见不能为空');const lines=await ctx.api.object('forge_purchase_inbound_line').find({where:{inbound_id:id}}),now=new Date().toISOString();if(!lines.length||lines.some(line=>line.status!=='pending_approval'))throw new Error('入库明细状态不允许审批');for(const line of lines)await ctx.api.object('forge_purchase_inbound_line').update({id:line.id,status:'approved'});await ctx.api.object('forge_purchase_inbound').update({id,status:'approved',approved_at:now,approved_by:actor,approval_note:note});await ctx.api.object('forge_purchase_inbound_approval_log').insert({name:inbound.code+' 审批通过',inbound_id:id,action:'approved',from_status:'pending_approval',to_status:'approved',comment:note,occurred_at:now,operator_id:actor});return{id,status:'approved'};
`},
});

export const PurchaseInboundStock = defineAction({
  name:'purchase_inbound_stock',label:'执行入库',objectName:'forge_purchase_inbound',icon:'boxes',locations:[...locations],order:40,visible:`record.status == 'approved'`,refreshAfter:true,description:'把已审批明细增加到库存余额并写入库存流水。',successMessage:'采购入库完成，库存已更新',
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const id=ctx.recordId||(ctx.record&&ctx.record.id),inbound=ctx.record,actor=ctx.session&&ctx.session.userId;if(ctx.recordLoadDenied===true||!id||!inbound)throw new Error('当前采购入库单不存在或不可访问');if(!actor)throw new Error('无法识别当前操作人');if(inbound.status!=='approved')throw new Error('仅已审批采购入库单可以执行入库');const lines=await ctx.api.object('forge_purchase_inbound_line').find({where:{inbound_id:id}}),order=await ctx.api.object('forge_purchase_order').findOne({where:{id:inbound.order_id}});if(!order||!lines.length||lines.some(line=>line.status!=='approved'))throw new Error('采购订单或入库明细状态不正确');const round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000,now=new Date().toISOString(),receiptIds=[...new Set(lines.map(line=>line.receipt_id))];let total=0;
for(let index=0;index<lines.length;index++){const line=lines[index],inspection=await ctx.api.object('forge_purchase_inspection').findOne({where:{id:line.inspection_id}});if(!inspection||inspection.status!=='completed')throw new Error('入库明细关联的检验单尚未完成');const allForInspection=await ctx.api.object('forge_purchase_inbound_line').find({where:{inspection_id:inspection.id}}),otherUsed=round4(allForInspection.filter(item=>item.id!==line.id&&item.status!=='cancelled').reduce((sum,item)=>sum+Number(item.quantity||0),0));if(Number(line.quantity||0)>round4(Number(inspection.accepted_quantity||0)-otherUsed))throw new Error((line.item_code||line.name)+' 入库数量超过检验合格剩余数量');const balanceKey=line.warehouse_id+':'+line.sku_id,balances=await ctx.api.object('forge_inventory_balance').find({where:{balance_key:balanceKey}});if(balances.length>1)throw new Error('同一仓库和物料存在重复库存余额');const balance=balances[0]||null,beforeOnHand=Number(balance&&balance.on_hand_quantity||0),reserved=Number(balance&&balance.reserved_quantity||0),beforeAvailable=Number(balance&&balance.available_quantity||0),beforeValue=Number(balance&&balance.inventory_value||0),quantity=Number(line.quantity||0),amount=Number(line.taxed_amount||0),afterOnHand=round4(beforeOnHand+quantity),afterAvailable=round4(afterOnHand-reserved),afterValue=round4(beforeValue+amount),averageCost=afterOnHand>0?round4(afterValue/afterOnHand):0;if(balance)await ctx.api.object('forge_inventory_balance').update({id:balance.id,on_hand_quantity:afterOnHand,reserved_quantity:reserved,available_quantity:afterAvailable,average_cost:averageCost,inventory_value:afterValue,last_movement_at:now});else await ctx.api.object('forge_inventory_balance').insert({name:inbound.code+' '+line.name,balance_key:balanceKey,warehouse_id:line.warehouse_id,sku_id:line.sku_id,on_hand_quantity:afterOnHand,reserved_quantity:0,available_quantity:afterAvailable,average_cost:averageCost,inventory_value:afterValue,last_movement_at:now,remarks:'由采购入库建立'});await ctx.api.object('forge_inventory_ledger').insert({name:inbound.code+' '+line.name+' 入库',code:inbound.code+'-'+String(index+1).padStart(3,'0'),warehouse_id:line.warehouse_id,sku_id:line.sku_id,direction:'inbound',movement_type:'purchase_inbound',quantity,before_on_hand:beforeOnHand,after_on_hand:afterOnHand,before_available:beforeAvailable,after_available:afterAvailable,unit_cost:Number(line.taxed_unit_price||0),amount,occurred_at:now,source_object:'forge_purchase_inbound',source_id:id,source_line_id:line.id,responsible_id:actor,remarks:inbound.remarks||('由采购入库单 '+inbound.code+' 执行')});await ctx.api.object('forge_purchase_inbound_line').update({id:line.id,before_on_hand:beforeOnHand,after_on_hand:afterOnHand,status:'stocked'});const orderLine=await ctx.api.object('forge_purchase_order_line').findOne({where:{id:line.order_line_id}});await ctx.api.object('forge_purchase_order_line').update({id:line.order_line_id,inbound_quantity:round4(Number(orderLine.inbound_quantity||0)+quantity)});const refreshedInboundLines=await ctx.api.object('forge_purchase_inbound_line').find({where:{inspection_id:inspection.id}}),stockedForInspection=round4(refreshedInboundLines.filter(item=>item.status==='stocked').reduce((sum,item)=>sum+Number(item.quantity||0),0));await ctx.api.object('forge_purchase_receipt_line').update({id:line.receipt_line_id,status:stockedForInspection>=Number(inspection.accepted_quantity||0)?'stocked':'inspected'});total=round4(total+quantity);}
for(const receiptId of receiptIds){const receiptLines=await ctx.api.object('forge_purchase_receipt_line').find({where:{receipt_id:receiptId}});let settled=true;for(const receiptLine of receiptLines){if(receiptLine.status==='stocked'||receiptLine.status==='cancelled')continue;const inspection=await ctx.api.object('forge_purchase_inspection').findOne({where:{receipt_line_id:receiptLine.id}});if(!inspection||inspection.status!=='completed'||Number(inspection.accepted_quantity||0)>0){settled=false;break;}}if(settled)await ctx.api.object('forge_purchase_receipt').update({id:receiptId,status:'stocked'});}
const orderInbound=round4(Number(order.inbound_quantity||0)+total),orderStatus=orderInbound>=Number(order.total_quantity||0)?'completed':'partially_arrived';await ctx.api.object('forge_purchase_order').update({id:order.id,inbound_quantity:orderInbound,status:orderStatus});
if(order.payable_trigger==='inbound'){
  const existingPayables=await ctx.api.object('forge_accounts_payable').find({where:{inbound_id:id}}),activePayables=existingPayables.filter(item=>item.status!=='cancelled');
  if(activePayables.length>1)throw new Error('当前采购入库单存在多笔有效应付，请先处理重复数据');
  if(!activePayables.length){await ctx.api.object('forge_accounts_payable').insert({name:order.code+' 应付 '+inbound.code,code:'AP-'+inbound.code,source_type:'purchase_inbound',inbound_id:id,invoice_id:null,order_id:order.id,supplier_id:order.supplier_id,recognized_on:inbound.inbound_on,due_on:order.settlement_on||inbound.inbound_on,original_amount:Number(inbound.inventory_amount||0),paid_amount:0,offset_amount:0,red_reversed_amount:0,outstanding_amount:Number(inbound.inventory_amount||0),status:'unpaid',responsible_id:order.responsible_id,remarks:'由采购入库 '+inbound.code+' 自动生成，待登记进项发票'});}
}
await ctx.api.object('forge_purchase_inbound').update({id,status:'stocked',stocked_at:now,stocked_by:actor});await ctx.api.object('forge_purchase_inbound_approval_log').insert({name:inbound.code+' 执行入库',inbound_id:id,action:'stocked',from_status:'approved',to_status:'stocked',comment:'采购入库完成',occurred_at:now,operator_id:actor});return{id,status:'stocked',line_count:lines.length,total_quantity:total,order_status:orderStatus};
`},
});
