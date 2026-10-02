import { ContactViews } from '../views/customer.view.js';
import { modelDialogRuntime } from './model-dialog.page.js';
const sections=ContactViews.form?.sections ?? [];
const fields=sections.flatMap(section=>(section.fields ?? []).map(field=>typeof field==='string'?field:field.field));

export const contactProfileRuntime = `${modelDialogRuntime}
const CONTACT_PROFILE_FIELDS=${JSON.stringify(fields)},CONTACT_PROFILE_SECTIONS=${JSON.stringify(sections)};
function ContactProfileEditor({row,channels,currentUserId,onClose,onSaved}){
 const adapter=useAdapter(),controller=React.useRef(null),channelController=React.useRef(null),active=React.useRef(true);
 const [values,setValues]=React.useState(()=>row?Object.fromEntries(CONTACT_PROFILE_FIELDS.map(field=>[field,row[field]??''])):{responsible_id:currentUserId,employment_status:'active',is_primary:false}),[channelDrafts,setChannelDrafts]=React.useState(()=>channels.map(channel=>({draftKey:channel.id,values:Object.fromEntries(['channel_type','name','value','is_primary'].map(field=>[field,channel[field]??'']))}))),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const baseline=React.useRef(JSON.stringify({values,channelDrafts}));
 React.useEffect(()=>()=>{active.current=false},[]);
 const onReady=React.useCallback(value=>{controller.current=value},[]),onChannelsReady=React.useCallback(value=>{channelController.current=value},[]);
 async function save(){if(!controller.current||!channelController.current)return;const [headerResult,channelsResult]=await Promise.all([controller.current.validate(),channelController.current.validate()]);if(!active.current||!headerResult.valid||!channelsResult.valid)return;setBusy(true);setError('');try{const header={...headerResult.values,expected_updated_at:row?.updated_at},savedChannels=channelsResult.draft.rows.map(channel=>({...channel.values,...(channels.some(existing=>existing.id===channel.draftKey)?{id:channel.draftKey}:{})}));await ForgeApiRequest(adapter,'/actions/forge_contact/sales_contact_save'+(row?'/'+encodeURIComponent(row.id):''),{method:'POST',body:JSON.stringify({params:{header_json:JSON.stringify(header),channels_json:JSON.stringify(savedChannels)}})});if(active.current)await onSaved()}catch(e){if(active.current)setError(String(e.message||e))}finally{if(active.current)setBusy(false)}}
 return <CompositeDialog open title={row?'编辑联系人':'新增联系人'} busy={busy} confirmOnDiscard={JSON.stringify({values,channelDrafts})!==baseline.current} onOpenChange={open=>{if(!open)onClose()}} footer={({requestClose})=><ForgeModelDialogFooter busy={busy} requestClose={requestClose} onSave={save}/>}>
 {error&&<ForgeNotice tone="error">{error}</ForgeNotice>}
 <ObjectForm objectName="forge_contact" dataSource={adapter} mode={row?'edit':'create'} recordId={row?.id} formType="simple" columns={4} sections={CONTACT_PROFILE_SECTIONS} fields={CONTACT_PROFILE_FIELDS} values={values} onValuesChange={setValues} onControllerReady={onReady} showSubmit={false} showCancel={false} showReset={false} submitHandler={data=>data}/>
 <RelationshipCollectionEditor parentObjectName="forge_contact" childObjectName="forge_contact_channel" relationshipField="contact_id" dataSource={adapter} value={channelDrafts} onChange={setChannelDrafts} fields={['channel_type','name','value','is_primary']} columns={4} presentation="rows" parentRecord={values} title="联系方式" itemLabel="联系方式" addLabel="添加联系方式" removeLabel="移除" minRows={0} includeRow={channel=>String(channel.values.value||'').trim()!==''} createDraftValues={()=>({channel_type:'mobile',name:'工作手机',is_primary:false})} onControllerReady={onChannelsReady}/>
 </CompositeDialog>
}
`;
