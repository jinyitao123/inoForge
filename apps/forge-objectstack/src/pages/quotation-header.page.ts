import { modelDialogRuntime } from './model-dialog.page.js';
/** One model form for editable quotation header fields; business write stays in the Action. */
export const quotationHeaderRuntime = `${modelDialogRuntime}

const QUOTATION_HEADER_FIELDS=['name','valid_until','payment_term','remarks'];
function QuotationHeaderEditor({row,onClose,onSaved}){
 const adapter=useAdapter(),controller=React.useRef(null),active=React.useRef(true);
 const [values,setValues]=React.useState(()=>Object.fromEntries(QUOTATION_HEADER_FIELDS.map(field=>[field,row[field]??'']))),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const baseline=React.useRef(values);
 React.useEffect(()=>()=>{active.current=false},[]);
 const onReady=React.useCallback(value=>{controller.current=value},[]);
 async function save(){const validated=await controller.current?.validate();if(!active.current||!validated?.valid)return;setBusy(true);setError('');try{await ForgeApiRequest(adapter,'/actions/forge_quotation/sales_quotation_draft_update_header/'+encodeURIComponent(row.id),{method:'POST',body:JSON.stringify({params:{...Object.fromEntries(QUOTATION_HEADER_FIELDS.map(field=>[field,validated.values[field]??null])),expected_updated_at:String(row.updated_at||'')}})});if(active.current)await onSaved()}catch(e){if(active.current)setError(String(e.message||e))}finally{if(active.current)setBusy(false)}}
 return <CompositeDialog open title="编辑报价草稿" busy={busy} confirmOnDiscard={JSON.stringify(values)!==JSON.stringify(baseline.current)} onOpenChange={open=>{if(!open)onClose()}} footer={({requestClose})=><ForgeModelDialogFooter busy={busy} requestClose={requestClose} onSave={save}/>}>{error&&<ForgeNotice tone="error">{error}</ForgeNotice>}<ObjectForm objectName="forge_quotation" dataSource={adapter} mode="edit" recordId={row.id} formType="simple" columns={2} sections={[{columns:2,fields:[{field:'name',span:'full'},'valid_until','payment_term',{field:'remarks',span:'full'}]}]} fields={QUOTATION_HEADER_FIELDS} values={values} onValuesChange={setValues} onControllerReady={onReady} showSubmit={false} showCancel={false} showReset={false} submitHandler={data=>data}/></CompositeDialog>
}
`;
