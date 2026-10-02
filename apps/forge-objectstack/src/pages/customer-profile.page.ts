import { modelDialogRuntime } from './model-dialog.page.js';
import { CustomerViews } from '../views/customer.view.js';

const fields = ['name', 'customer_type', 'category_id', 'level_id', 'credit_code', 'legal_representative', 'registered_capital', 'established_on', 'enterprise_scale', 'website', 'business_scope', 'industry', 'description', 'province', 'city', 'address', 'remarks'];
const sections = (CustomerViews.form?.sections ?? []).flatMap(section => {
  const entries = (section.fields ?? []).filter(entry => fields.includes(typeof entry === 'string' ? entry : entry.field));
  return entries.length ? [{ ...section, fields: entries }] : [];
});

/** Profile edits share the model form; contacts have a separate atomic editor. */
export const customerProfileRuntime = `${modelDialogRuntime}

const CUSTOMER_EDIT_FIELDS=${JSON.stringify(fields)},CUSTOMER_EDIT_SECTIONS=${JSON.stringify(sections)};
function CustomerProfileEditor({row,onClose,onSaved}){
 const adapter=useAdapter(),controller=React.useRef(null);
 const [values,setValues]=React.useState(()=>Object.fromEntries(CUSTOMER_EDIT_FIELDS.map(field=>[field,row[field]??'']))),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const baseline=React.useRef(values),active=React.useRef(true);
 React.useEffect(()=>()=>{active.current=false},[]);
 const onReady=React.useCallback(value=>{controller.current=value},[]);
 async function save(){if(!controller.current)return;const result=await controller.current.validate();if(!active.current||!result.valid)return;setBusy(true);setError('');try{await ForgeApiRequest(adapter,'/actions/forge_customer/sales_customer_profile_update/'+encodeURIComponent(row.id),{method:'POST',body:JSON.stringify({params:{values_json:JSON.stringify(Object.fromEntries(CUSTOMER_EDIT_FIELDS.map(field=>[field,result.values[field]??null]))),expected_updated_at:String(row.updated_at||'')}})});if(active.current)await onSaved()}catch(e){if(active.current)setError(String(e.message||e))}finally{if(active.current)setBusy(false)}}
 return <CompositeDialog open title="编辑客户资料" busy={busy} confirmOnDiscard={JSON.stringify(values)!==JSON.stringify(baseline.current)} onOpenChange={open=>{if(!open)onClose()}} footer={({requestClose})=><ForgeModelDialogFooter busy={busy} requestClose={requestClose} onSave={save}/>}>{error&&<ForgeNotice tone="error">{error}</ForgeNotice>}<ObjectForm objectName="forge_customer" dataSource={adapter} mode="edit" recordId={row.id} formType="simple" columns={4} sections={CUSTOMER_EDIT_SECTIONS} fields={CUSTOMER_EDIT_FIELDS} values={values} onValuesChange={setValues} onControllerReady={onReady} showSubmit={false} showCancel={false} showReset={false} submitHandler={data=>data}/></CompositeDialog>
}
`;
