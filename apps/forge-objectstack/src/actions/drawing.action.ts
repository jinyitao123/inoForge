import { defineAction } from '@objectstack/spec';

const locations = ['record_header', 'record_more'] as const;

export const DrawingVersionSubmitReview = defineAction({
  name:'drawing_version_submit_review',label:'提交评审',objectName:'forge_drawing_version',icon:'send',locations:[...locations],visible:`record.status == 'draft'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const version=ctx.record,id=ctx.recordId||(version&&version.id);if(ctx.recordLoadDenied===true||!id||!version||version.status!=='draft')throw new Error('仅草稿版本可以提交评审');
if(!version.drawing_id||!version.version||!version.file_name)throw new Error('提交前必须完整填写图号、版本号和主文件');
const duplicate=(await ctx.api.object('forge_drawing_version').find({where:{drawing_id:version.drawing_id,version:version.version}})).filter(x=>x.id!==id);if(duplicate.length)throw new Error('同一图号下版本号不能重复');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();const drawing=await ctx.api.object('forge_drawing').findOne({where:{id:version.drawing_id}});
const reviews=await ctx.api.object('forge_drawing_review').find({where:{version_id:id}});if(reviews.some(x=>['pending','approved'].includes(x.status)))throw new Error('该版本已经存在待处理或已通过评审');
const review=await ctx.api.object('forge_drawing_review').insert({name:version.version+' 图纸评审',code:'DR-'+Date.now(),drawing_id:version.drawing_id,version_id:id,status:'pending',submitted_at:now});
await ctx.api.object('forge_drawing_version').update({id,status:'pending_review'});if(!drawing||!drawing.current_version_id)await ctx.api.object('forge_drawing').update({id:version.drawing_id,status:'reviewing'});
await ctx.api.object('forge_drawing_operation_log').insert({name:'提交版本评审',event_key:id+':submit:'+Date.now(),drawing_id:version.drawing_id,related_object:'forge_drawing_version',related_id:id,action:'version_submit_review',actor_id:actor,occurred_at:now,from_status:'draft',to_status:'pending_review',comment:version.change_summary||'提交版本评审'});
return {id,review_id:typeof review==='string'?review:review&&review.id,status:'pending_review'};`}
});

export const DrawingReviewDecision = defineAction({
  name:'drawing_review_decision',label:'评审处理',objectName:'forge_drawing_review',icon:'badge-check',locations:[...locations],visible:`record.status == 'pending'`,refreshAfter:true,
  params:[{name:'decision',label:'评审结论',type:'select',required:true,options:[{label:'通过',value:'approve'},{label:'退回',value:'reject'}]},{name:'comment',label:'评审意见',type:'textarea',required:true}],
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const review=ctx.record,id=ctx.recordId||(review&&review.id);if(ctx.recordLoadDenied===true||!id||!review||review.status!=='pending')throw new Error('仅待评审记录可以处理');
if(!['approve','reject'].includes(ctx.input.decision)||!String(ctx.input.comment||'').trim())throw new Error('请选择结论并填写评审意见');
const version=await ctx.api.object('forge_drawing_version').findOne({where:{id:review.version_id}});if(!version||version.status!=='pending_review')throw new Error('评审版本状态已变化');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString(),approved=ctx.input.decision==='approve',next=approved?'reviewed':'draft';
await ctx.api.object('forge_drawing_review').update({id,status:approved?'approved':'rejected',decision_note:String(ctx.input.comment).trim(),completed_at:now});
await ctx.api.object('forge_drawing_version').update({id:version.id,status:next,reviewed_at:approved?now:null});const drawing=await ctx.api.object('forge_drawing').findOne({where:{id:review.drawing_id}});if(!drawing||!drawing.current_version_id)await ctx.api.object('forge_drawing').update({id:review.drawing_id,status:'draft'});
await ctx.api.object('forge_drawing_operation_log').insert({name:approved?'评审通过':'评审退回',event_key:id+':decision:'+Date.now(),drawing_id:review.drawing_id,related_object:'forge_drawing_review',related_id:id,action:approved?'review_approved':'review_rejected',actor_id:actor,occurred_at:now,from_status:'pending',to_status:approved?'approved':'rejected',comment:String(ctx.input.comment).trim()});return {id,status:approved?'approved':'rejected',version_status:next};`}
});

export const DrawingReleaseSubmit = defineAction({
  name:'drawing_release_submit',label:'提交发布审核',objectName:'forge_drawing_release',icon:'send',locations:[...locations],visible:`record.status == 'draft'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const release=ctx.record,id=ctx.recordId||(release&&release.id);if(ctx.recordLoadDenied===true||!id||!release||release.status!=='draft')throw new Error('仅草稿发布单可以提交');
const version=await ctx.api.object('forge_drawing_version').findOne({where:{id:release.version_id}});if(!version||version.drawing_id!==release.drawing_id)throw new Error('发布版本与图号不匹配');if(version.status!=='reviewed')throw new Error('版本必须先评审通过才能提交发布');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();await ctx.api.object('forge_drawing_release').update({id,status:'pending',submitted_at:now});await ctx.api.object('forge_drawing_version').update({id:version.id,status:'pending_release'});
await ctx.api.object('forge_drawing_operation_log').insert({name:'提交发布审核',event_key:id+':submit:'+Date.now(),drawing_id:release.drawing_id,related_object:'forge_drawing_release',related_id:id,action:'release_submit',actor_id:actor,occurred_at:now,from_status:'draft',to_status:'pending',comment:release.impact_summary||'提交发布审核'});return {id,status:'pending'};`}
});

export const DrawingReleaseApprove = defineAction({
  name:'drawing_release_approve',label:'审核发布',objectName:'forge_drawing_release',icon:'shield-check',locations:[...locations],visible:`record.status == 'pending'`,refreshAfter:true,
  params:[{name:'comment',label:'审核意见',type:'textarea',required:true}],body:{language:'js',capabilities:['api.read','api.write'],source:`
const release=ctx.record,id=ctx.recordId||(release&&release.id);if(ctx.recordLoadDenied===true||!id||!release||release.status!=='pending')throw new Error('仅待审核发布单可以审核');if(!String(ctx.input.comment||'').trim())throw new Error('审核意见为必填');const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();
await ctx.api.object('forge_drawing_release').update({id,status:'approved',approved_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'发布审核通过',event_key:id+':approve:'+Date.now(),drawing_id:release.drawing_id,related_object:'forge_drawing_release',related_id:id,action:'release_approved',actor_id:actor,occurred_at:now,from_status:'pending',to_status:'approved',comment:String(ctx.input.comment).trim()});return {id,status:'approved'};`}
});

export const DrawingReleasePublish = defineAction({
  name:'drawing_release_publish',label:'正式发布',objectName:'forge_drawing_release',icon:'rocket',locations:[...locations],visible:`record.status == 'approved'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const release=ctx.record,id=ctx.recordId||(release&&release.id);if(ctx.recordLoadDenied===true||!id||!release||release.status!=='approved')throw new Error('仅已审核发布单可以正式发布');const version=await ctx.api.object('forge_drawing_version').findOne({where:{id:release.version_id}});if(!version||version.status!=='pending_release')throw new Error('待发布版本状态已变化');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();const old=(await ctx.api.object('forge_drawing_version').find({where:{drawing_id:release.drawing_id,status:'released'}})).filter(x=>x.id!==version.id);for(const item of old)await ctx.api.object('forge_drawing_version').update({id:item.id,status:'superseded'});
await ctx.api.object('forge_drawing_release').update({id,status:'released',released_at:now});await ctx.api.object('forge_drawing_version').update({id:version.id,status:'released',released_at:now});await ctx.api.object('forge_drawing').update({id:release.drawing_id,status:'released',current_version_id:version.id,current_version:version.version});
await ctx.api.object('forge_drawing_operation_log').insert({name:'图纸正式发布',event_key:id+':publish:'+Date.now(),drawing_id:release.drawing_id,related_object:'forge_drawing_release',related_id:id,action:'released',actor_id:actor,occurred_at:now,from_status:'approved',to_status:'released',comment:'发布版本 '+version.version});return {id,status:'released',drawing_id:release.drawing_id,version_id:version.id};`}
});

export const DrawingChangeSubmit = defineAction({
  name:'drawing_change_submit',label:'提交变更审批',objectName:'forge_drawing_change',icon:'send',locations:[...locations],visible:`record.status == 'draft'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const change=ctx.record,id=ctx.recordId||(change&&change.id);if(ctx.recordLoadDenied===true||!id||!change||change.status!=='draft')throw new Error('仅草稿变更单可以提交');if(!String(change.reason||'').trim())throw new Error('变更原因为必填');const source=await ctx.api.object('forge_drawing_version').findOne({where:{id:change.source_version_id}});if(!source||source.drawing_id!==change.drawing_id||source.status!=='released')throw new Error('提交变更必须选择该图号当前已发布版本');const drawing=await ctx.api.object('forge_drawing').findOne({where:{id:change.drawing_id}});if(!drawing||drawing.current_version_id!==source.id)throw new Error('原版本不是当前生效版本');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();await ctx.api.object('forge_drawing_change').update({id,status:'pending',submitted_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'提交图纸变更',event_key:id+':submit:'+Date.now(),drawing_id:change.drawing_id,related_object:'forge_drawing_change',related_id:id,action:'change_submit',actor_id:actor,occurred_at:now,from_status:'draft',to_status:'pending',comment:change.reason});return {id,status:'pending'};`}
});

export const DrawingChangeApprove = defineAction({
  name:'drawing_change_approve',label:'批准变更',objectName:'forge_drawing_change',icon:'badge-check',locations:[...locations],visible:`record.status == 'pending'`,refreshAfter:true,
  params:[{name:'comment',label:'审批意见',type:'textarea',required:true}],body:{language:'js',capabilities:['api.read','api.write'],source:`
const change=ctx.record,id=ctx.recordId||(change&&change.id);if(ctx.recordLoadDenied===true||!id||!change||change.status!=='pending')throw new Error('仅待审批变更单可以批准');if(!String(ctx.input.comment||'').trim())throw new Error('审批意见为必填');const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();await ctx.api.object('forge_drawing_change').update({id,status:'implementing',approved_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'批准图纸变更',event_key:id+':approve:'+Date.now(),drawing_id:change.drawing_id,related_object:'forge_drawing_change',related_id:id,action:'change_approved',actor_id:actor,occurred_at:now,from_status:'pending',to_status:'implementing',comment:String(ctx.input.comment).trim()});return {id,status:'implementing'};`}
});

export const DrawingChangeComplete = defineAction({
  name:'drawing_change_complete',label:'完成变更',objectName:'forge_drawing_change',icon:'circle-check',locations:[...locations],visible:`record.status == 'implementing'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const change=ctx.record,id=ctx.recordId||(change&&change.id);if(ctx.recordLoadDenied===true||!id||!change||change.status!=='implementing')throw new Error('仅实施中的变更可以完成');if(!change.target_version_id)throw new Error('完成变更前必须关联变更后版本');const target=await ctx.api.object('forge_drawing_version').findOne({where:{id:change.target_version_id}});if(!target||target.drawing_id!==change.drawing_id)throw new Error('变更后版本与图号不匹配');if(!['reviewed','pending_release','released'].includes(target.status))throw new Error('变更后版本至少应已评审通过');const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString();await ctx.api.object('forge_drawing_change').update({id,status:'completed',completed_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'完成图纸变更',event_key:id+':complete:'+Date.now(),drawing_id:change.drawing_id,related_object:'forge_drawing_change',related_id:id,action:'change_completed',actor_id:actor,occurred_at:now,from_status:'implementing',to_status:'completed',comment:'变更后版本 '+target.version});return {id,status:'completed'};`}
});

export const DrawingDistributionExecute = defineAction({
  name:'drawing_distribution_execute',label:'执行发放',objectName:'forge_drawing_distribution',icon:'send',locations:[...locations],visible:`record.status == 'draft' || record.status == 'pending'`,refreshAfter:true,
  body:{language:'js',capabilities:['api.read','api.write'],source:`
const dist=ctx.record,id=ctx.recordId||(dist&&dist.id);if(ctx.recordLoadDenied===true||!id||!dist||!['draft','pending'].includes(dist.status))throw new Error('仅草稿或待发放记录可以执行');if(!dist.drawing_id)throw new Error('请选择图号');const drawing=await ctx.api.object('forge_drawing').findOne({where:{id:dist.drawing_id}});if(!drawing||drawing.status!=='released'||!drawing.current_version_id)throw new Error('仅已发布图号可以发放');const versionId=dist.version_id||drawing.current_version_id,version=await ctx.api.object('forge_drawing_version').findOne({where:{id:versionId}});if(!version||version.drawing_id!==drawing.id||version.status!=='released')throw new Error('发放版本必须是当前已发布版本');if(version.id!==drawing.current_version_id)throw new Error('不能发放已替代版本');if(!dist.purpose||!dist.recipient_type||!dist.recipient_name||!dist.method)throw new Error('执行发放前必须填写用途、接收类型、接收对象和发放方式');if(dist.recipient_type==='supplier'&&!drawing.external_share_allowed)throw new Error('该图号未允许外发供应商');if(dist.recipient_type==='customer'&&!drawing.external_share_allowed)throw new Error('该图号未允许外发客户');if(dist.require_receipt&&!String(dist.receipt_requirement||'').trim())throw new Error('要求回执时必须填写回执要求说明');
const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString(),confirm=dist.require_confirmation?'pending':'confirmed',receipt=dist.require_receipt?'pending':'not_required';await ctx.api.object('forge_drawing_distribution').update({id,version_id:version.id,status:'sent',confirmation_status:confirm,receipt_status:receipt,sent_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'执行图纸发放',event_key:id+':sent:'+Date.now(),drawing_id:drawing.id,related_object:'forge_drawing_distribution',related_id:id,action:'distribution_sent',actor_id:actor,occurred_at:now,from_status:dist.status,to_status:'sent',comment:'发放 '+version.version+' 给 '+dist.recipient_name});return {id,status:'sent',version_id:version.id,confirmation_status:confirm,receipt_status:receipt};`}
});

export const DrawingDistributionConfirm = defineAction({
  name:'drawing_distribution_confirm',label:'确认接收',objectName:'forge_drawing_distribution',icon:'check-check',locations:[...locations],visible:`record.status == 'sent' && record.confirmation_status == 'pending'`,refreshAfter:true,
  params:[{name:'receipt_received',label:'同时收到回执',type:'boolean'}],body:{language:'js',capabilities:['api.read','api.write'],source:`
const dist=ctx.record,id=ctx.recordId||(dist&&dist.id);if(ctx.recordLoadDenied===true||!id||!dist||dist.status!=='sent'||dist.confirmation_status!=='pending')throw new Error('当前发放记录无需确认或状态已变化');const actor=ctx.session&&ctx.session.userId;if(!actor)throw new Error('无法识别当前操作人');const now=new Date().toISOString(),receipt=dist.require_receipt&&ctx.input.receipt_received===true?'received':dist.receipt_status;await ctx.api.object('forge_drawing_distribution').update({id,confirmation_status:'confirmed',receipt_status:receipt,confirmed_at:now});await ctx.api.object('forge_drawing_operation_log').insert({name:'确认图纸接收',event_key:id+':confirm:'+Date.now(),drawing_id:dist.drawing_id,related_object:'forge_drawing_distribution',related_id:id,action:'distribution_confirmed',actor_id:actor,occurred_at:now,from_status:'pending',to_status:'confirmed',comment:receipt==='received'?'已确认并收到回执':'已确认接收'});return {id,confirmation_status:'confirmed',receipt_status:receipt};`}
});
