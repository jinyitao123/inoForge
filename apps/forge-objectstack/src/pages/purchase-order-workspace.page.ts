import { forgeProductUiCss, forgeProductUiRuntime } from './product-ui.js';
import { PurchaseOrderViews } from '../views/purchase-order.view.js';
import { PurchaseOrder } from '../objects/procurement.object.js';

const purchaseOrderDefaultSource = PurchaseOrder.fields.source_type.defaultValue;
if (typeof purchaseOrderDefaultSource !== 'string') {
  throw new Error('采购订单来源默认值必须由采购订单对象声明。');
}

const purchaseOrderFormView = PurchaseOrderViews.form;
const purchaseOrderFormSections = purchaseOrderFormView?.sections ?? [];
const purchaseOrderFormSectionFields = (section: (typeof purchaseOrderFormSections)[number] | undefined) =>
  (section?.fields ?? [])
    .map((field) => typeof field === 'string' ? field : field.field)
    .filter((field): field is string => typeof field === 'string');
const purchaseOrderSourceSection = purchaseOrderFormSections.find((section) => section.name === 'source');
const purchaseOrderInformationSection = purchaseOrderFormSections.find((section) => section.name === 'purchase_information');
const purchaseOrderArrivalSection = purchaseOrderFormSections.find((section) => section.name === 'arrival');
const purchaseOrderSourceFields = purchaseOrderFormSectionFields(purchaseOrderSourceSection);
const customPurchaseOrderPickers = new Set(['supplier_id', 'warehouse_id']);
const purchaseOrderInformationFields = purchaseOrderFormSectionFields(purchaseOrderInformationSection)
  .filter((field) => !customPurchaseOrderPickers.has(field));
const purchaseOrderInformationFormSection = purchaseOrderInformationSection
  ? {
      ...purchaseOrderInformationSection,
      fields: (purchaseOrderInformationSection.fields ?? []).filter((field) => {
        const name = typeof field === 'string' ? field : field.field;
        return !customPurchaseOrderPickers.has(name);
      }),
    }
  : undefined;

if (
  !purchaseOrderFormView
  || !purchaseOrderSourceSection
  || !purchaseOrderInformationSection
  || !purchaseOrderArrivalSection
  || purchaseOrderSourceFields.length === 0
  || purchaseOrderInformationFields.length === 0
) {
  throw new Error('采购订单工作区需要已声明的来源和主单信息表单视图。');
}

const purchaseOrderFormPresentation = {
  columns: purchaseOrderFormView.columns ?? 2,
  sourceFields: purchaseOrderSourceFields,
  sourceOptions: PurchaseOrder.fields.source_type.options,
  paymentMethodDefault: PurchaseOrder.fields.payment_method.defaultValue,
  currencyDefault: PurchaseOrder.fields.currency.defaultValue,
  sourceSection: purchaseOrderSourceSection,
  informationFields: purchaseOrderInformationFields,
  informationSection: purchaseOrderInformationFormSection,
  arrivalFields: purchaseOrderFormSectionFields(purchaseOrderArrivalSection),
  arrivalSection: purchaseOrderArrivalSection,
};

const purchaseOrderCss = `
.forge-po .fp-source-form [data-field="source_type"]{--ui-field-margin-gap:0px}.forge-po .fp-source-form [data-field="source_type"]>label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.forge-po .fp-next-card{display:flex;align-items:center;justify-content:space-between;gap:14px;border-left:3px solid var(--fp-primary);padding:15px 17px;margin-bottom:14px}.forge-po .fp-next-title{font-size:14px;font-weight:680}.forge-po .fp-next-desc{color:var(--fp-muted);font-size:12px;margin-top:3px}.forge-po .fp-order-progress{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-bottom:14px}.forge-po .fp-source-summary{display:grid;grid-template-columns:minmax(220px,1fr) repeat(3,minmax(120px,.45fr));gap:10px;margin:13px 0}.forge-po .fp-source-cell{border:1px solid var(--fp-line);border-radius:9px;background:#fbfcfe;padding:12px}.forge-po .fp-source-cell span{display:block;color:var(--fp-muted);font-size:11px;margin-bottom:4px}.forge-po .fp-source-cell strong{font-size:15px}.forge-po .fp-form-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:15px 18px}.forge-po .fp-card-section{padding:18px}.forge-po .fp-card-section+.fp-card-section{border-top:1px solid var(--fp-line)}.forge-po .fp-card-section h2{font-size:14px;margin:0 0 14px}.forge-po .fp-log-row{display:grid;grid-template-columns:150px 160px 1fr;gap:14px;padding:11px 0;border-bottom:1px solid var(--fp-line)}.forge-po .fp-log-row:last-child{border-bottom:0}.forge-po .fp-list-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.forge-po .fp-filter-plan{display:flex;align-items:center;gap:8px;color:var(--fp-muted);font-size:12px}.forge-po .fp-filter-plan strong{color:var(--fp-text)}.forge-po .fp-wide-table{min-width:2180px}.fp-wide-table th:first-child,.fp-wide-table td:first-child{position:sticky;left:0;z-index:2;background:#fff}.fp-wide-table th:first-child{z-index:4;background:#f8f9fc}.fp-wide-table th:last-child,.fp-wide-table td:last-child{position:sticky;right:0;z-index:2;background:#fff;box-shadow:-6px 0 10px rgba(16,24,40,.04)}.fp-wide-table th:last-child{z-index:4;background:#f8f9fc}.forge-po .fp-line-table{min-width:1600px}.forge-po .fp-inline-muted{display:inline-block;color:var(--fp-muted);font-size:12px;margin-left:6px}.forge-po .fp-filterbar.purchase{grid-template-columns:minmax(250px,1.2fr) repeat(5,minmax(120px,.42fr)) auto}.forge-po .fp-report-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--fp-line)}.forge-po .fp-report-title{font-weight:680}.forge-po .fp-button-group{display:inline-flex;align-items:center;gap:0;border:1px solid var(--fp-line-strong);border-radius:8px;overflow:hidden}.forge-po .fp-button-group button{height:32px;border:0;border-right:1px solid var(--fp-line-strong);background:#fff;color:#475467;padding:0 12px}.forge-po .fp-button-group button:last-child{border-right:0}.forge-po .fp-button-group button.active{background:var(--fp-primary);color:#fff}.forge-po .fp-disabled-action{height:34px;border:1px solid var(--fp-line);border-radius:8px;background:#f8f9fc;color:var(--fp-muted);padding:0 12px;display:inline-flex;align-items:center}.forge-po .fp-scroll-hint{padding:9px 16px;color:var(--fp-muted);font-size:12px;border-top:1px solid var(--fp-line);background:#fbfcfe}@media(max-width:1100px){.forge-po .fp-filterbar.purchase{grid-template-columns:1fr 1fr}.forge-po .fp-next-card{align-items:flex-start;flex-direction:column}.forge-po .fp-order-progress{grid-template-columns:1fr 1fr}.forge-po .fp-source-summary{grid-template-columns:1fr 1fr}.forge-po .fp-form-grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){.forge-po .fp-filterbar.purchase,.forge-po .fp-order-progress,.forge-po .fp-source-summary,.forge-po .fp-form-grid{grid-template-columns:1fr}.forge-po .fp-log-row{grid-template-columns:1fr}}
`;

const purchaseOrderPageSource = `
const css=${JSON.stringify(forgeProductUiCss + purchaseOrderCss)};
const PURCHASE_ORDER_FORM=${JSON.stringify(purchaseOrderFormPresentation)};
function prepareLineBulkPatch(rows,edit){
  const value=Number(edit.value),round4=value=>Math.round((value+Number.EPSILON)*10000)/10000;
  if(!['quantity','taxed_unit_price','untaxed_unit_price','tax_rate'].includes(edit.field))return {error:'批量字段无效'};
  if(!String(edit.value).trim()||!Number.isFinite(value)||value<0||(edit.field==='quantity'&&value<=0)||(edit.field==='tax_rate'&&value>100))return {error:edit.field==='quantity'?'数量必须大于0':edit.field==='tax_rate'?'税率必须在0至100之间':'请输入有效的非负调整值'};
  const isPrice=edit.field==='taxed_unit_price'||edit.field==='untaxed_unit_price';
  if(isPrice&&!['add','subtract','increase','decrease'].includes(edit.mode))return {error:'单价调整方式无效'};
  const patches=rows.map(row=>{
    const rate=edit.field==='tax_rate'?value:Number(row.tax_rate??13),old=Number(row[edit.field]||0);
    const next=isPrice?(edit.mode==='subtract'?old-value:edit.mode==='increase'?old*(1+value/100):edit.mode==='decrease'?old*(1-value/100):old+value):value;
    if(!Number.isFinite(next)||next<0)return null;
    if(edit.field==='quantity')return {quantity:next};
    if(edit.field==='untaxed_unit_price')return {untaxed_unit_price:round4(next),taxed_unit_price:round4(next*(1+rate/100))};
    const taxed=edit.field==='taxed_unit_price'?next:Number(row.taxed_unit_price||0);
    return {tax_rate:rate,taxed_unit_price:round4(taxed),untaxed_unit_price:round4(taxed/(1+rate/100))};
  });
  return patches.some(row=>row===null)?{error:'调整后的单价不能小于0'}:{patches};
}
function LineBulkToolbar({context}){
  const [edit,setEdit]=React.useState(null),[error,setError]=React.useState('');
  const labels={quantity:'数量',taxed_unit_price:'含税单价',untaxed_unit_price:'不含税单价',tax_rate:'税率'};
  const open=field=>{setEdit({field,value:field==='quantity'?'1':field==='tax_rate'?'13':'0.0000',mode:'add'});setError('')};
  const confirm=()=>{
    if(!edit||!context.canPatchSelected)return;
    const result=prepareLineBulkPatch(context.selectedRows,edit);
    if(result.error){setError(result.error);return}
    const prepared=result.patches;
    let index=0;context.patchSelected(()=>prepared[index++]);setEdit(null);setError('');
  };
  const isPrice=edit&&(edit.field==='taxed_unit_price'||edit.field==='untaxed_unit_price');
  return <div style={{display:'grid',gap:'10px',width:'100%'}}><div className="fp-toolbar" style={{justifyContent:'flex-start',flexWrap:'wrap'}}><span className="fp-secondary">已选 {context.selectedRows.length} / {context.totalRows} 项</span>{[['quantity','# 批量数量'],['taxed_unit_price','¥ 批量含税单价'],['untaxed_unit_price','¥ 批量不含税单价'],['tax_rate','% 批量税率']].map(([field,label])=><button key={field} type="button" className="fp-button small" disabled={!context.canPatchSelected} onClick={()=>open(field)}>{label}</button>)}<button type="button" className="fp-button small" disabled={!context.canRemoveSelected} onClick={()=>{context.removeSelected();setEdit(null);setError('')}}>批量删除</button></div>{edit&&<div style={{display:'grid',gap:'8px',padding:'12px',border:'1px solid var(--fp-line)',borderRadius:'var(--ui-control-radius,6px)'}}><div className="fp-toolbar" style={{justifyContent:'flex-start',flexWrap:'wrap'}}><strong>{isPrice?'批量调整':'统一修改'}{labels[edit.field]}</strong><span className="fp-secondary">影响 {context.selectedRows.length} 项</span>{isPrice&&[['add','+ 加固定金额'],['subtract','- 减固定金额'],['increase','↗ 上涨百分比'],['decrease','↘ 下调百分比']].map(([mode,label])=><button key={mode} type="button" aria-pressed={edit.mode===mode} className={'fp-button small '+(edit.mode===mode?'primary':'')} disabled={context.disabled} onClick={()=>setEdit(current=>({...current,mode}))}>{label}</button>)}<label htmlFor="fp-bulk-line-value">{isPrice?'调整值':'设为'}</label><input id="fp-bulk-line-value" className="fp-input" style={{width:'128px'}} inputMode="decimal" aria-label={'批量'+labels[edit.field]} value={edit.value} disabled={context.disabled} onChange={event=>{setEdit(current=>({...current,value:event.target.value}));setError('')}}/><button type="button" className="fp-button small primary" disabled={!context.canPatchSelected} onClick={confirm}>确认</button><button type="button" className="fp-button small" disabled={context.disabled} onClick={()=>{setEdit(null);setError('')}}>取消</button></div>{error&&<ForgeNotice tone="error">{error}</ForgeNotice>}</div>}</div>
}
function LineEditor({form,setForm,state,money,busy,currency}){
  const keys=React.useRef(new WeakMap()),nextKey=React.useRef(0);
  const lines=(form.lines||[]).map(row=>{if(row._draft_key)return row;let key=keys.current.get(row);if(!key){key='line-'+(++nextKey.current);keys.current.set(row,key)}return {...row,_draft_key:key}});
  const currencyPrefix=new Intl.NumberFormat('zh-CN',{style:'currency',currency:String(currency).toUpperCase()}).formatToParts(0).find(part=>part.type==='currency').value;
  const total=lines.reduce((sum,x)=>sum+Number(x.quantity||0)*Number(x.taxed_unit_price||0),0);
  const options=(state.skus||[]).map(sku=>{const material=state.materialsById[sku.material_id];return {value:String(sku.id),label:((material&&material.code)||sku.code||'')+' · '+((material&&material.name)||sku.name||'')}});
  const columns=[
    {name:'sku_id',label:'物料',type:'select',width:300,options},
    {name:'quantity',label:'数量',type:'number',width:120,required:true},
    {name:'taxed_unit_price',label:'含税单价',type:'number',width:150},
    {name:'untaxed_unit_price',label:'不含税单价',type:'number',width:150},
    {name:'tax_rate',label:'税率 %',type:'number',width:105},
    ...(form.unified_delivery_date===false?[
      {name:'expected_arrival_on',label:'期望到货日期',type:'date',width:170,required:true},
      {name:'supplier_confirmed_arrival_on',label:'反馈交货日期',type:'date',width:170},
    ]:[]),
    {name:'taxed_subtotal',label:'含税小计',type:'currency',prefix:currencyPrefix,width:150,computed:true,expr:'record.quantity * record.taxed_unit_price',scale:2},
  ];
  const onLinesChange=next=>setForm(current=>({...current,lines:next.map((row,index)=>{
    const line={...row},previous=(current.lines||[]).find(item=>item._draft_key===row._draft_key)||(current.lines||[])[index];
    const round4=value=>Math.round((value+Number.EPSILON)*10000)/10000,rate=Number(line.tax_rate??13);
    if(previous&&line.untaxed_unit_price!==previous.untaxed_unit_price&&line.taxed_unit_price===previous.taxed_unit_price)line.taxed_unit_price=round4(Number(line.untaxed_unit_price||0)*(1+rate/100));
    else if(line.taxed_unit_price!=null&&line.taxed_unit_price!=='')line.untaxed_unit_price=round4(Number(line.taxed_unit_price)/(1+rate/100));
    if(index>=(current.lines||[]).length){
      if(line.sku_id==null)line.sku_id='';
      if(line.quantity==null||line.quantity==='')line.quantity='1';
      if(line.taxed_unit_price==null||line.taxed_unit_price==='')line.taxed_unit_price='0';
      if(line.tax_rate==null||line.tax_rate==='')line.tax_rate='13';
    }
    if(line.expected_arrival_on==null)line.expected_arrival_on=current.expected_arrival_on||'';
    if(line.supplier_confirmed_arrival_on==null)line.supplier_confirmed_arrival_on=current.supplier_confirmed_arrival_on||'';
    line.taxed_subtotal=line.quantity==null||line.quantity===''||line.taxed_unit_price==null||line.taxed_unit_price===''?null:Number((Number(line.quantity)*Number(line.taxed_unit_price)).toFixed(2));
    return line;
  })}));
  return <><div className="fp-table-toolbar"><strong id="fp-purchase-lines-label">采购明细</strong><span className="fp-secondary">共 {lines.length} 项</span><span className="fp-grow"/><button type="button" className="fp-button small" onClick={()=>setForm(current=>({...current,lines:[...(current.lines||[]),{sku_id:'',quantity:'1',taxed_unit_price:'0',untaxed_unit_price:'0',taxed_subtotal:0,tax_rate:'13',expected_arrival_on:current.expected_arrival_on||'',supplier_confirmed_arrival_on:current.supplier_confirmed_arrival_on||''}]}))}>添加物料</button></div><GridField columns={columns} getRowKey={row=>row._draft_key} renderSelectionToolbar={context=><LineBulkToolbar context={context}/>} disabled={busy} aria-labelledby="fp-purchase-lines-label" field={{name:'lines',label:'采购明细',type:'grid',min_rows:0,allow_add:false,allow_delete:true}} value={lines} onChange={onLinesChange}/><div className="fp-source-summary"><div className="fp-source-cell"><span>明细项数</span><strong>{lines.length}</strong></div><div className="fp-source-cell"><span>采购总数量</span><strong>{lines.reduce((sum,x)=>sum+Number(x.quantity||0),0)}</strong></div><div className="fp-source-cell"><span>含税金额</span><strong>{money(total)}</strong></div></div></>}
function BomDeliveryEditor({form,setForm,state}){
  const overrides=new Map((form.bom_delivery_dates||[]).map(row=>[row.source_analysis_line_id,row]));
  const rows=(state.analysisLines||[]).map(line=>({source_analysis_line_id:line.id,name:line.name,quantity:line.shortage_quantity,expected_arrival_on:overrides.get(line.id)?.expected_arrival_on??form.expected_arrival_on??'',supplier_confirmed_arrival_on:overrides.get(line.id)?.supplier_confirmed_arrival_on??form.supplier_confirmed_arrival_on??''}));
  const columns=[{name:'name',label:'物料名称',type:'text',width:240,readonlyWhen:'true'},{name:'quantity',label:'采购数量',type:'number',width:120,readonlyWhen:'true'},{name:'expected_arrival_on',label:'期望到货日期',type:'date',width:170,required:true},{name:'supplier_confirmed_arrival_on',label:'反馈交货日期',type:'date',width:170}];
  return <GridField columns={columns} getRowKey={row=>row.source_analysis_line_id} aria-label="BOM物料交期" field={{name:'bom_delivery_dates',label:'BOM物料交期',type:'grid',allow_add:false,allow_delete:false}} value={rows} onChange={next=>setForm(current=>({...current,bom_delivery_dates:next.map(row=>({source_analysis_line_id:row.source_analysis_line_id,expected_arrival_on:row.expected_arrival_on,supplier_confirmed_arrival_on:row.supplier_confirmed_arrival_on}))}))}/>;
}
function App(){const adapter=useAdapter();
  const [actor,setActor]=React.useState({name:'',error:''});
  React.useEffect(()=>{let active=true;async function readActor(){try{const session=await request('/auth/get-session');if(active)setActor({name:session?.user?.name||'',error:session?.user?.name?'':'无法读取创建人'})}catch{if(active)setActor({name:'',error:'无法读取创建人'})}}if(adapter)readActor();return()=>{active=false}},[adapter]);
  const sourceController=React.useRef(null),informationController=React.useRef(null),arrivalController=React.useRef(null);
  const [sourceFormReady,setSourceFormReady]=React.useState(false),[informationFormReady,setInformationFormReady]=React.useState(false),[arrivalFormReady,setArrivalFormReady]=React.useState(false);
  const pageSize=12,params=new URLSearchParams(window.location.search),initialId=params.get('id'),newMode=params.get('new')==='1'||!!params.get('analysis');
  const [view,setView]=React.useState(initialId?'detail':newMode?'new':'list');
  const [state,setState]=React.useState({loading:true,orders:[],orderLines:[],invoices:[],payables:[],paymentTasks:[],notices:[],inbounds:[],ordersById:{},order:null,lines:[],logs:[],analyses:[],analysis:null,analysisLines:[],boms:{},suppliers:[],warehouses:[],error:''});
  const [filters,setFilters]=React.useState({search:'',status:'',supplier:'',invoice:'',inbound:'',payment:''}),[page,setPage]=React.useState(1),[tab,setTab]=React.useState('基本信息'),[listMode,setListMode]=React.useState('orders');
  const [form,setForm]=React.useState({analysis_id:params.get('analysis')||'',source_type:${JSON.stringify(purchaseOrderDefaultSource)},code:'',supplier_id:'',warehouse_id:'',unified_delivery_date:true,expected_arrival_on:'',supplier_confirmed_arrival_on:'',payment_term:'',project_id:'',purchase_request_id:'',remarks:'',lines:[]});
  function onSourceControllerReady(controller){sourceController.current=controller;setSourceFormReady(current=>current===Boolean(controller)?current:Boolean(controller))}
  function onInformationControllerReady(controller){informationController.current=controller;setInformationFormReady(current=>current===Boolean(controller)?current:Boolean(controller))}
  function onArrivalControllerReady(controller){arrivalController.current=controller;setArrivalFormReady(current=>current===Boolean(controller)?current:Boolean(controller))}
  function onSourceValuesChange(nextValues){const sourceChanged=typeof nextValues.source_type==='string'&&nextValues.source_type!==form.source_type;setForm(current=>({...current,...nextValues}));if(sourceChanged)selectSource(nextValues.source_type)}
  function onInformationValuesChange(nextValues){setForm(current=>({...current,...nextValues}))}
  const [dialog,setDialog]=React.useState(null),[busy,setBusy]=React.useState(false),[toast,setToast]=React.useState('');
  async function request(path,options){const response=await ForgeApiResponse(adapter,path,{credentials:'include',headers:{'Content-Type':'application/json'},...options}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error((typeof payload.error==='string'?payload.error:payload.error?.message)||(Array.isArray(payload.fields)&&payload.fields.length?payload.fields.map(f=>f.message||f.label).filter(Boolean).join('；'):'')||payload.message||'请求失败');return payload}
  async function fetchAll(object,where){const rows=[];let skip=0;for(let guard=0;guard<100;guard++){const query=new URLSearchParams({$top:'100',$skip:String(skip)});if(where)query.set('$filter',JSON.stringify(where));const batch=(await request('/data/'+object+'?'+query)).records||[];rows.push(...batch);if(batch.length<100)break;skip+=batch.length}return rows}
  const resultId=payload=>payload?.id||payload?.result?.id||payload?.data?.result?.id||payload?.data?.id||null;
  async function safeAll(object){try{return await fetchAll(object)}catch{return []}}
  async function loadList(){setState(s=>({...s,loading:true,error:'',order:null}));try{const [orders,orderLines,suppliers,warehouses,boms,notices,inbounds,invoices,payables,paymentTasks]=await Promise.all([fetchAll('forge_purchase_order'),fetchAll('forge_purchase_order_line'),fetchAll('forge_supplier'),fetchAll('forge_warehouse'),safeAll('forge_bom'),safeAll('forge_purchase_arrival_notice'),safeAll('forge_purchase_inbound'),safeAll('forge_purchase_invoice'),safeAll('forge_accounts_payable'),safeAll('forge_payment_task')]);setState(s=>({...s,loading:false,orders,orderLines,suppliers,warehouses,boms:Object.fromEntries(boms.map(item=>[item.id,item])),notices,inbounds,invoices,payables,paymentTasks,ordersById:Object.fromEntries(orders.map(item=>[item.id,item])),error:''}))}catch(error){setState(s=>({...s,loading:false,error:String(error.message||error)}))}}
  async function loadNew(){
    setState(s=>({...s,loading:true,error:'',order:null}));
    try{
      const [orders,analyses,boms,suppliers,warehouses,materials,skus,requests,requestLines]=await Promise.all([
        fetchAll('forge_purchase_order'),
        fetchAll('forge_bom_shortage_analysis'),
        fetchAll('forge_bom'),
        fetchAll('forge_supplier'),
        fetchAll('forge_warehouse'),
        fetchAll('forge_material'),
        fetchAll('forge_material_sku'),
        fetchAll('forge_purchase_request'),
        fetchAll('forge_purchase_request_line'),
      ]);
      const orderCodeCandidate=forgeDocCode('PO',orders.map(item=>item.code),new Date().toISOString().slice(0,10));
      const orderDateDefault=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);
      setForm(current=>({...current,code:String(current.code||'').trim()?current.code:orderCodeCandidate,order_on:current.order_on||orderDateDefault}));
      analyses.sort((a,b)=>String(b.analyzed_at||'').localeCompare(String(a.analyzed_at||'')));
      const eligible=analyses.filter(item=>Number(item.shortage_count)>0),requested=form.analysis_id||params.get('analysis'),analysis=eligible.find(item=>item.id===requested)||null;
      const analysisLines=analysis?(await fetchAll('forge_bom_shortage_line',{analysis_id:analysis.id})).filter(item=>Number(item.shortage_quantity)>0&&item.source_type==='purchased'):[];
      setState({loading:false,orders,orderLines:[],invoices:[],payables:[],paymentTasks:[],notices:[],inbounds:[],ordersById:Object.fromEntries(orders.map(item=>[item.id,item])),order:null,lines:[],logs:[],analyses:eligible,analysis,analysisLines,boms:Object.fromEntries(boms.map(item=>[item.id,item])),suppliers,warehouses,materials,materialsById:Object.fromEntries(materials.map(item=>[item.id,item])),skus,requests:requests.filter(item=>item.status==='approved'),requestLines,error:''});
    }catch(error){setState(s=>({...s,loading:false,error:String(error.message||error)}))}
  }
  async function loadDetail(id){setState(s=>({...s,loading:true,error:''}));try{const detail=await request('/data/forge_purchase_order/'+id),order=detail.record;if(!order)throw new Error('未找到指定采购订单');const [orders,lines,logs,notices,boms,suppliers,warehouses,invoices,payables,paymentTasks,inbounds]=await Promise.all([fetchAll('forge_purchase_order'),fetchAll('forge_purchase_order_line',{order_id:id}),fetchAll('forge_purchase_order_approval_log',{order_id:id}),fetchAll('forge_purchase_arrival_notice',{order_id:id}),safeAll('forge_bom'),fetchAll('forge_supplier'),fetchAll('forge_warehouse'),safeAll('forge_purchase_invoice',{order_id:id}),safeAll('forge_accounts_payable',{order_id:id}),safeAll('forge_payment_task',{order_id:id}),safeAll('forge_purchase_inbound',{order_id:id})]);setState({loading:false,orders,orderLines:lines,invoices,payables,paymentTasks,notices,inbounds,ordersById:Object.fromEntries(orders.map(item=>[item.id,item])),order,lines,logs,analyses:[],analysis:null,analysisLines:[],boms:Object.fromEntries(boms.map(item=>[item.id,item])),suppliers,warehouses,error:''})}catch(error){setState(s=>({...s,loading:false,order:null,error:String(error.message||error)}))}}
  function route(next,id){const url=next==='detail'?window.location.pathname+'?id='+encodeURIComponent(id):next==='new'?window.location.pathname+'?new=1':window.location.pathname;history.pushState({},'',url);setView(next);setTab('基本信息');if(next==='detail')loadDetail(id);else if(next==='new')loadNew();else loadList()}
  React.useEffect(()=>{if(initialId)loadDetail(initialId);else if(newMode)loadNew();else loadList();const pop=()=>{const query=new URLSearchParams(location.search),id=query.get('id'),next=id?'detail':query.get('new')==='1'||query.get('analysis')?'new':'list';setView(next);if(id)loadDetail(id);else if(next==='new')loadNew();else loadList()};addEventListener('popstate',pop);return()=>removeEventListener('popstate',pop)},[]);
  React.useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(timer)},[toast]);
  async function selectAnalysis(id){setForm(value=>({...value,analysis_id:id}));const analysis=state.analyses.find(item=>item.id===id)||null,analysisLines=analysis?(await fetchAll('forge_bom_shortage_line',{analysis_id:id})).filter(item=>Number(item.shortage_quantity)>0&&item.source_type==='purchased'):[];setState(s=>({...s,analysis,analysisLines}))}
  function selectSource(type){setForm(f=>({...f,source_type:type,analysis_id:type==='bom_shortage'?f.analysis_id:'',purchase_request_id:type==='purchase_request'?f.purchase_request_id:'',lines:type==='bom_shortage'?[]:(f.lines||[])}));if(type!=='bom_shortage')setState(s=>({...s,analysis:null,analysisLines:[]}))}
function selectRequest(id){setForm(f=>({...f,purchase_request_id:id,lines:id?(state.requestLines||[]).filter(x=>x.request_id===id).map(x=>{const quantity=String(x.quantity||1),taxed_unit_price=String(x.taxed_unit_price||0);return {sku_id:x.sku_id||'',quantity,taxed_unit_price,tax_rate:String(x.tax_rate==null?13:x.tax_rate),taxed_subtotal:Number((Number(quantity||0)*Number(taxed_unit_price||0)).toFixed(2))}}):[]}))}
async function createOrder(mode){
  setBusy(true);
  setState(s=>({...s,error:''}));
  try{
    if(!sourceController.current||!informationController.current||!arrivalController.current)throw new Error('采购订单主单字段尚未加载，请稍后重试');
    const sourceResult=await sourceController.current.validate();
    if(!sourceResult.valid){if(sourceResult.formError)setState(s=>({...s,error:sourceResult.formError}));return}
    const informationResult=await informationController.current.validate();
    if(!informationResult.valid){if(informationResult.formError)setState(s=>({...s,error:informationResult.formError}));return}
    const arrivalResult=await arrivalController.current.validate();
    if(!arrivalResult.valid){if(arrivalResult.formError)setState(s=>({...s,error:arrivalResult.formError}));return}
    const values={...form,...sourceResult.values,...informationResult.values,...arrivalResult.values};
    const source=values.source_type,lines=(values.lines||[]).filter(x=>x.sku_id),today=new Date().toISOString().slice(0,10);
    const bad=(source==='bom_shortage'?(!state.analysis?'请选择缺料分析':''):source==='purchase_request'?(!values.purchase_request_id?'请选择采购申请':''):(!lines.length?'请至少添加一条采购明细':''))||(!values.supplier_id?'请选择供应商':'')||(source!=='bom_shortage'&&lines.some(x=>!(Number(x.quantity)>0))?'采购明细数量必须大于0':'');
    if(bad){setState(s=>({...s,error:bad}));return}
    const code=String(values.code||'').trim()||forgeDocCode('PO',state.orders.map(item=>item.code),today);
    const deliveryExtras=Object.fromEntries(['unified_delivery_date','supplier_confirmed_arrival_on'].filter(field=>arrivalResult.values[field]!==undefined&&(field==='unified_delivery_date'||values.unified_delivery_date!==false)).map(field=>[field,arrivalResult.values[field]]));
    const headerExtras=Object.fromEntries(['supplier_order_number','currency','exchange_rate','payable_trigger','settlement_on','arrival_address','order_on'].filter(field=>informationResult.values[field]!==undefined).map(field=>[field,informationResult.values[field]]));
    let payload;
    if(source==='bom_shortage'){
      payload=await request('/actions/forge_bom_shortage_analysis/bom_shortage_create_purchase_order/'+state.analysis.id,{method:'POST',body:JSON.stringify({params:{...headerExtras,...deliveryExtras,...(values.unified_delivery_date===false?{delivery_dates_json:JSON.stringify((state.analysisLines||[]).map(line=>{const date=(values.bom_delivery_dates||[]).find(row=>row.source_analysis_line_id===line.id);return {source_analysis_line_id:line.id,expected_arrival_on:date?.expected_arrival_on??values.expected_arrival_on,supplier_confirmed_arrival_on:date?.supplier_confirmed_arrival_on??values.supplier_confirmed_arrival_on??null}}))}:{}),code,supplier_id:values.supplier_id,warehouse_id:values.warehouse_id||null,...(values.unified_delivery_date===false?{}:{expected_arrival_on:values.expected_arrival_on}),payment_term:String(values.payment_term||'').trim(),payment_method:values.payment_method,remarks:String(values.remarks||'').trim()||null}})});
    }else{
      payload=await request('/actions/forge_purchase_order/purchase_order_create',{method:'POST',body:JSON.stringify({params:{...headerExtras,...deliveryExtras,mode,source_type:source,code,supplier_id:values.supplier_id,warehouse_id:values.warehouse_id||null,...(values.unified_delivery_date===false?{}:{expected_arrival_on:values.expected_arrival_on}),payment_term:String(values.payment_term||'').trim(),payment_method:values.payment_method,project_id:values.project_id||null,purchase_request_id:values.purchase_request_id||null,remarks:String(values.remarks||'').trim()||null,lines_json:JSON.stringify(lines.map(x=>({sku_id:x.sku_id,quantity:Number(x.quantity||0),taxed_unit_price:Number(x.taxed_unit_price||0),tax_rate:Number(x.tax_rate==null?13:x.tax_rate),...(x.expected_arrival_on!==undefined?{expected_arrival_on:x.expected_arrival_on}:{}),...(x.supplier_confirmed_arrival_on!==undefined?{supplier_confirmed_arrival_on:x.supplier_confirmed_arrival_on}:{})})))}})});
    }
    const id=resultId(payload);
    if(!id)throw new Error('采购订单创建后未返回记录 ID');
    setToast(mode==='draft'?'采购订单草稿已保存':'采购订单已提交审核');
    route('detail',id);
  }catch(error){setState(s=>({...s,error:String(error.message||error)}))}
  finally{setBusy(false)}
}
  async function approve(){const note=String(dialog.note||'').trim();if(!note){setDialog({...dialog,error:'请填写审批意见'});return}setBusy(true);try{await request('/actions/forge_purchase_order/purchase_order_approve/'+state.order.id,{method:'POST',body:JSON.stringify({params:{approval_note:note}})});setDialog(null);setToast('采购订单已审核');await loadDetail(state.order.id)}catch(error){setDialog(value=>({...value,error:String(error.message||error)}))}finally{setBusy(false)}}
  async function submitOrder(){const orderId=(dialog&&dialog.order_id)||(state.order&&state.order.id);if(!orderId)return;setBusy(true);try{await request('/actions/forge_purchase_order/purchase_order_submit/'+orderId,{method:'POST',body:JSON.stringify({})});setDialog(null);setToast('采购订单已提交审核，等待审核后生成到货通知');if(state.order&&state.order.id===orderId)await loadDetail(orderId);else await loadList()}catch(error){if(dialog)setDialog(value=>({...(value||{}),error:String(error.message||error)}));else setState(s=>({...s,error:String(error.message||error)}))}finally{setBusy(false)}}
  const statusText={draft:'草稿',pending_approval:'待审核',approved:'已审核',partially_arrived:'部分到货',arrived:'已到货',completed:'已完成',rejected:'已驳回',cancelled:'已取消'},logText={created:'创建',submitted:'提交审核',approved:'审核通过',rejected:'审核退回'};
  const sourceText={inventory_replenishment:'库存补充',project:'项目采购',sales_driven:'以销定采',bom_shortage:'BOM 缺料',purchase_request:'采购申请'};
  const payMethodText={bank_transfer:'银行转账',wire_transfer:'电汇',bank_acceptance:'承兑汇票',online_payment:'在线支付',cash:'现金',other:'其他'};
  const currencyText={cny:'人民币',usd:'美元',eur:'欧元'};
  const payableText={inbound:'按入库',invoice:'按发票'};
  const invoiceStatusText={not_invoiced:'未开票',partially_invoiced:'部分开票',fully_invoiced:'已开票',normal:'已登记',voided:'已作废',partially_red_reversed:'部分红冲',red_reversed:'已红冲',red_invoice:'红字发票'};
  const paymentStatusText={pending_review:'待审批',approved:'已审批',partially_paid:'部分付款',paid:'已付清',rejected:'已驳回',cancelled:'已取消'};
  const money=(value,currency='cny')=>value===null||value===undefined||value===''?'—':Number(value||0).toLocaleString('zh-CN',{style:'currency',currency:String(currency).toUpperCase(),minimumFractionDigits:2,maximumFractionDigits:2}),date=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—',day=value=>value||'—';
  const supplier=id=>state.suppliers.find(item=>item.id===id),warehouse=id=>state.warehouses.find(item=>item.id===id),selectedBom=state.analysis&&state.boms[state.analysis.bom_id];
  const byOrder=(rows,id)=>rows.filter(item=>item.order_id===id),sum=(rows,field)=>rows.reduce((n,item)=>n+Number(item[field]||0),0),pct=(done,total)=>total?Math.min(100,Math.round(Number(done||0)/Number(total||0)*100)):0;
  const invoiceProgress=order=>{const amount=Number(order.total_amount||0),invoiced=sum(byOrder(state.invoices,order.id),'total_amount');return amount?pct(invoiced,amount):(invoiced>0?100:0)};
  const paymentProgress=order=>{const requested=sum(byOrder(state.paymentTasks,order.id),'requested_amount'),paid=sum(byOrder(state.paymentTasks,order.id),'paid_amount');return requested?pct(paid,requested):0};
  const appliedAmount=order=>sum(byOrder(state.paymentTasks,order.id),'requested_amount');
  const hasInbound=order=>Number(order.inbound_quantity||0)>0||byOrder(state.inbounds,order.id).length>0;
  const hasInvoice=order=>byOrder(state.invoices,order.id).length>0;
  const hasPayment=order=>byOrder(state.paymentTasks,order.id).length>0;
  function lineCount(order){return byOrder(state.orderLines,order.id).length||Number(order.line_count||0)}
  function searchable(order){return [order.code,order.supplier_order_number,supplier(order.supplier_id)?.name,order.remarks,order.name,state.boms[order.bom_id]?.code,sourceText[order.source_type]].join(' ').toLowerCase()}
  const filtered=state.orders.filter(item=>{const q=filters.search.trim().toLowerCase();return (!q||searchable(item).includes(q))&&(!filters.status||item.status===filters.status)&&(!filters.supplier||item.supplier_id===filters.supplier)&&(!filters.invoice||(filters.invoice==='yes'?hasInvoice(item):!hasInvoice(item)))&&(!filters.inbound||(filters.inbound==='yes'?hasInbound(item):!hasInbound(item)))&&(!filters.payment||(filters.payment==='yes'?hasPayment(item):!hasPayment(item)))})
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,totalPages),visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize),filteredLines=state.orderLines.filter(line=>filtered.some(order=>order.id===line.order_id));
  const totalAmount=filtered.reduce((n,item)=>n+Number(item.total_amount||0),0),activeFilter=Object.values(filters).some(Boolean),supplierOptions=state.suppliers.map(item=>({value:item.id,label:item.name}));
  function setFilter(next){setFilters({...filters,...next});setPage(1)}
  function clearFilters(){setFilters({search:'',status:'',supplier:'',invoice:'',inbound:'',payment:''});setPage(1);setToast('已清空采购订单筛选')}
  function exportCsv(){const headers=listMode==='orders'?['订单号','供应商','供应商单号','关联内容','期望到货日期','仓库','付款条件','币种','付款方式','结算日期','备注说明','应付产生方式','采购员','订单金额','已申请金额','开票进度','入库进度','付款进度','退货','状态','采购原因','下单日期','创建时间','更新时间']:['订单号','供应商','物料编码','物料名称','规格','型号','单位','采购数量','已到货','已入库','含税单价','税率','含税小计','期望到货','状态'];const rows=listMode==='orders'?filtered.map(order=>[order.code,supplier(order.supplier_id)?.name||'',order.supplier_order_number||'',order.bom_id?'BOM '+(state.boms[order.bom_id]?.code||''):(sourceText[order.source_type]||''),day(order.expected_arrival_on),warehouse(order.warehouse_id)?.name||'',order.payment_term||'',currencyText[order.currency]||order.currency||'',payMethodText[order.payment_method]||order.payment_method||'',day(order.settlement_on),order.remarks||'',payableText[order.payable_trigger]||order.payable_trigger||'',order.responsible_id?'Dev Admin':'—',Number(order.total_amount||0),appliedAmount(order),invoiceProgress(order)+'%',pct(order.inbound_quantity,order.total_quantity)+'%',paymentProgress(order)+'%',Number(order.returned_quantity||0),statusText[order.status]||order.status,sourceText[order.source_type]||order.source_type||'',day(order.order_on),date(order.created_at),date(order.updated_at)]):filteredLines.map(line=>{const order=state.ordersById[line.order_id]||state.orders.find(item=>item.id===line.order_id)||{};return [order.code||'',supplier(order.supplier_id)?.name||'',line.item_code||'',line.name||'',line.specification||'',line.model||'',line.unit_name||'',Number(line.quantity||0),Number(line.arrived_quantity||0),Number(line.inbound_quantity||0),Number(line.taxed_unit_price||0),Number(line.tax_rate||0)+'%',Number(line.taxed_subtotal||0),day(line.expected_arrival_on||order.expected_arrival_on),statusText[order.status]||order.status||'']});const quote=String.fromCharCode(34),newline=String.fromCharCode(10),bom=String.fromCharCode(65279);const csv=[headers,...rows].map(row=>row.map(cell=>quote+String(cell==null?'':cell).split(quote).join(quote+quote)+quote).join(',')).join(newline);const blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(listMode==='orders'?'采购订单列表-':'采购订单明细-')+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);setToast('已导出 '+rows.length+' 条采购订单数据')}
  function saveFilterPlan(){const parts=[];if(filters.search)parts.push('关键词 '+filters.search);if(filters.status)parts.push(statusText[filters.status]||filters.status);if(filters.supplier)parts.push(supplier(filters.supplier)?.name||'指定供应商');if(filters.invoice)parts.push(filters.invoice==='yes'?'已开票':'未开票');if(filters.inbound)parts.push(filters.inbound==='yes'?'已入库':'未入库');if(filters.payment)parts.push(filters.payment==='yes'?'已有付款申请':'无付款申请');setToast(parts.length?'已保存筛选方案：'+parts.join(' / '):'已保存筛选方案：全部采购订单')}
  function renderList(){return <div className="fp-shell"><ForgeHero section="供应链 / 采购管理" title="采购订单" description="正式采购订单下达、跟踪到货状态、应付与发票管理" icon="▤" tone="blue" art="blueprint"/><div className="fp-action-row"><button className="fp-button primary" onClick={()=>route('new')}>新建采购单</button><button className="fp-button" onClick={exportCsv}>导出</button><button className="fp-button" onClick={()=>navigate('/apps/com.inoforge.forge.finance/page_purchase_payment')}>付款申请</button><button className="fp-button" onClick={()=>navigate('/apps/com.inoforge.forge.supply-chain/page_purchase_invoice_entry')}>收票登记</button><ForgeListSettings/><button className="fp-icon-button" disabled={state.loading} aria-label="刷新" title="刷新" onClick={loadList}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg></button></div><section className="fp-card fp-next-card"><div><div className="fp-next-title">下一步操作：到货通知</div><div className="fp-next-desc">已审核订单生成到货通知后，可进入到货登记继续办理收货、待检和入库。</div></div><button className="fp-button primary" onClick={()=>navigate('/apps/com.inoforge.forge.supply-chain/page_purchase_arrival_notice')}>到货通知</button></section>{state.error&&<ForgeNotice tone="error" onClose={()=>setState(s=>({...s,error:''}))}>{state.error}</ForgeNotice>}<section className="fp-card"><div className="fp-report-head"><div><div className="fp-report-title">采购订单视图</div><div className="fp-secondary">合计金额 {money(totalAmount)} · 当前 {filtered.length} 单</div></div><div className="fp-button-group" aria-label="采购订单视图切换"><button className={'fp-tab '+(listMode==='orders'?'active':'')} onClick={()=>setListMode('orders')}>订单列表</button><button className={'fp-tab '+(listMode==='lines'?'active':'')} onClick={()=>setListMode('lines')}>订单明细</button></div></div><div className="fp-filterbar purchase"><input className="fp-input fp-search" aria-label="搜索采购订单" placeholder="搜索订单号、供应商、BOM 或备注" value={filters.search} onChange={e=>setFilter({search:e.target.value})}/><ForgeSelectControl className="fp-select" aria-label="采购订单状态" value={filters.status} onChange={e=>setFilter({status:e.target.value})}><option value="">全部状态</option>{Object.entries(statusText).map(([value,label])=><option key={value} value={value}>{label}</option>)}</ForgeSelectControl><ForgeSelectControl className="fp-select" aria-label="筛选供应商" value={filters.supplier} onChange={e=>setFilter({supplier:e.target.value})}><option value="">全部供应商</option>{supplierOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</ForgeSelectControl><ForgeSelectControl className="fp-select" aria-label="开票筛选" value={filters.invoice} onChange={e=>setFilter({invoice:e.target.value})}><option value="">开票</option><option value="yes">已开票</option><option value="no">未开票</option></ForgeSelectControl><ForgeSelectControl className="fp-select" aria-label="入库筛选" value={filters.inbound} onChange={e=>setFilter({inbound:e.target.value})}><option value="">入库</option><option value="yes">已入库</option><option value="no">未入库</option></ForgeSelectControl><ForgeSelectControl className="fp-select" aria-label="付款筛选" value={filters.payment} onChange={e=>setFilter({payment:e.target.value})}><option value="">付款</option><option value="yes">已有付款申请</option><option value="no">无付款申请</option></ForgeSelectControl><button className="fp-button" onClick={clearFilters} disabled={!activeFilter}>清空筛选</button></div><div className="fp-filterbar" style={{gridTemplateColumns:'1fr auto auto'}}><div className="fp-filter-plan">我的筛选方案：<strong>{activeFilter?'当前筛选':'全部采购订单'}</strong></div><button className="fp-button" onClick={saveFilterPlan}>存为方案</button><ForgeSelectControl aria-label="筛选方案" className="fp-select" value="" onChange={e=>{if(e.target.value==='reset'&&activeFilter)clearFilters()}}><option value="">方案 ▾</option><option value="reset">恢复全部</option></ForgeSelectControl></div>{state.loading?<ForgeLoading label="正在加载采购订单"/>:listMode==='orders'?renderOrderTable():renderLineTable()}<div className="fp-pagination"><span>共 {filtered.length} 单 · {filteredLines.length} 行</span><div className="fp-pagination-actions"><button className="fp-button small" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>上一页</button><span>{currentPage} / {totalPages}</span><button className="fp-button small" disabled={currentPage>=totalPages} onClick={()=>setPage(currentPage+1)}>下一页</button></div></div><div className="fp-scroll-hint">横向滚动可查看供应商单号、付款条件、应付产生方式、开票进度、入库进度、付款进度和操作。</div></section></div>}
  function renderOrderTable(){return <div className="fp-table-wrap"><table className="fp-table fp-wide-table"><thead><tr><th>订单号</th><th>供应商</th><th>供应商单号</th><th>关联内容</th><th>期望到货日期</th><th>仓库</th><th>付款条件</th><th>币种</th><th>付款方式</th><th>结算日期</th><th>备注说明</th><th>应付产生方式</th><th>采购员</th><th className="fp-number">订单金额</th><th className="fp-number">已申请金额</th><th className="fp-number">开票进度</th><th className="fp-number">入库进度</th><th className="fp-number">付款进度</th><th className="fp-number">退货</th><th>状态</th><th>采购原因</th><th>下单日期</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{visible.map(order=><tr key={order.id} className="fp-row-button"><td><button className="fp-link-button" onClick={()=>route('detail',order.id)}>{order.code}</button></td><td>{supplier(order.supplier_id)?.name||'—'}</td><td>{order.supplier_order_number||'—'}</td><td>{order.bom_id?'BOM '+(state.boms[order.bom_id]?.code||'—'):(sourceText[order.source_type]||'—')}</td><td>{day(order.expected_arrival_on)}</td><td>{warehouse(order.warehouse_id)?.name||'—'}</td><td>{order.payment_term||'—'}</td><td>{currencyText[order.currency]||order.currency||'—'}</td><td>{payMethodText[order.payment_method]||order.payment_method||'—'}</td><td>{day(order.settlement_on)}</td><td>{order.remarks||'—'}</td><td>{payableText[order.payable_trigger]||order.payable_trigger||'—'}</td><td>{order.responsible_id?'Dev Admin':'—'}</td><td className="fp-number">{money(order.total_amount)}</td><td className="fp-number">{money(appliedAmount(order))}</td><td className="fp-number">{invoiceProgress(order)}%</td><td className="fp-number">{pct(order.inbound_quantity,order.total_quantity)}%</td><td className="fp-number">{paymentProgress(order)}%</td><td className="fp-number">{order.returned_quantity||0}</td><td><ForgeStatus value={order.status} label={statusText[order.status]}/></td><td>{sourceText[order.source_type]||order.source_type||'—'}</td><td>{day(order.order_on)}</td><td>{date(order.created_at)}</td><td>{date(order.updated_at)}</td><td><div className="fp-list-actions"><button className="fp-icon-button row-action" aria-label="查看" title="查看" onClick={()=>route('detail',order.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg></button>{byOrder(state.notices,order.id).length?<button className="fp-button small" onClick={()=>navigate('/apps/com.inoforge.forge.supply-chain/page_purchase_arrival_workspace?notice='+encodeURIComponent(byOrder(state.notices,order.id)[0].id))}>到货登记</button>:order.status==='draft'?<button className="fp-button small primary" onClick={()=>setDialog({kind:'submit',code:order.code,order_id:order.id})}>提交审核</button>:<span className="fp-disabled-action">{order.status==='pending_approval'?'待审核后生成通知':'待生成到货通知'}</span>}</div></td></tr>)}{!visible.length&&<tr><td colSpan="25" className="fp-empty-cell"><ForgeEmpty title="没有符合条件的采购订单" description="调整筛选条件，或新建一张采购订单"/></td></tr>}</tbody></table></div>}
  function renderLineTable(){const lines=filteredLines.slice((currentPage-1)*pageSize,currentPage*pageSize);return <div className="fp-table-wrap"><table className="fp-table fp-line-table"><thead><tr><th>订单号</th><th>供应商</th><th>物料编码</th><th>物料名称</th><th>规格</th><th>型号</th><th>单位</th><th className="fp-number">采购数量</th><th className="fp-number">已到货</th><th className="fp-number">已入库</th><th className="fp-number">含税单价</th><th className="fp-number">税率</th><th className="fp-number">含税小计</th><th>期望到货</th><th>状态</th></tr></thead><tbody>{lines.map(line=>{const order=state.ordersById[line.order_id]||state.orders.find(item=>item.id===line.order_id)||{};return <tr key={line.id}><td><button className="fp-link-button" onClick={()=>route('detail',line.order_id)}>{order.code||'—'}</button></td><td>{supplier(order.supplier_id)?.name||'—'}</td><td>{line.item_code||'—'}</td><td>{line.name||'—'}</td><td>{line.specification||'—'}</td><td>{line.model||'—'}</td><td>{line.unit_name||'—'}</td><td className="fp-number">{line.quantity||0}</td><td className="fp-number">{line.arrived_quantity||0}</td><td className="fp-number">{line.inbound_quantity||0}</td><td className="fp-number">{money(line.taxed_unit_price)}</td><td className="fp-number">{line.tax_rate||0}%</td><td className="fp-number">{money(line.taxed_subtotal)}</td><td>{day(line.expected_arrival_on||order.expected_arrival_on)}</td><td><ForgeStatus value={order.status} label={statusText[order.status]}/></td></tr>})}{!lines.length&&<tr><td colSpan="15" className="fp-empty-cell"><ForgeEmpty title="没有符合条件的采购订单明细" description="调整筛选条件后再查看"/></td></tr>}</tbody></table></div>}
  function renderNewOrder(){
    const formsReady=sourceFormReady&&informationFormReady&&arrivalFormReady;
    const sectionsWithoutHeading=section=>[{...section,label:undefined,name:undefined}];
    const sourceOptions=PURCHASE_ORDER_FORM.sourceOptions||[];
    const sourceLabel=sourceOptions.find(option=>option.value===form.source_type)?.label||sourceText[form.source_type]||'—';
    const draftCurrency=form.currency??PURCHASE_ORDER_FORM.currencyDefault;
    const draftMoney=value=>money(value,draftCurrency);
    const draftLines=form.source_type==='bom_shortage'?state.analysisLines:(form.lines||[]);
    const amount=form.source_type==='bom_shortage'?Number(state.analysis?.estimated_purchase_amount||0):draftLines.reduce((sum,line)=>sum+Number(line.quantity||0)*Number(line.taxed_unit_price||0),0);
    return <div className="fp-shell">
      <div className="fp-phase"><button className="fp-link-button" onClick={()=>route('list')}>采购订单</button><span>/</span><strong>新建</strong></div>
      <div className="fp-page-header"><div className="fp-heading"><h1 className="fp-title">新建采购订单</h1></div><div className="fp-toolbar">
        <button className="fp-button" disabled={busy} onClick={()=>route('list')}>取消</button>
        {form.source_type!=='bom_shortage'&&<button className="fp-button" disabled={busy||state.loading||!formsReady} onClick={()=>createOrder('draft')}>保存草稿</button>}
        <button className="fp-button primary" disabled={busy||state.loading||!formsReady} onClick={()=>createOrder('submit')}>{busy?'提交中…':'提交审核'}</button>
      </div></div>
      {state.error&&<ForgeNotice tone="error" onClose={()=>setState(s=>({...s,error:''}))}>{state.error}</ForgeNotice>}
      {state.loading?<ForgeLoading label="正在准备采购订单"/>:<fieldset disabled={busy} aria-busy={busy} style={{border:0,minWidth:0,margin:0,padding:0}}>
        <DocumentWorkspace sidebarLabel="订单概要" main={<div style={{display:'grid',gap:'18px'}}>
          <DocumentSection title="采购来源" stepNumber={1}>
            <div className="fp-source-form"><ObjectForm objectName="forge_purchase_order" dataSource={adapter} mode="create" formType="simple"
              fields={PURCHASE_ORDER_FORM.sourceFields} sections={sectionsWithoutHeading(PURCHASE_ORDER_FORM.sourceSection)} columns={PURCHASE_ORDER_FORM.columns}
              showSubmit={false} showCancel={false} showReset={false} values={form} onValuesChange={onSourceValuesChange}
              onControllerReady={onSourceControllerReady} submitHandler={values=>values}/></div>
        {form.source_type==='bom_shortage'&&<div className="fp-field"><label>缺料分析 <span className="fp-required">*</span></label><ForgeSelectControl className="fp-select" aria-label="缺料分析" value={form.analysis_id} onChange={e=>selectAnalysis(e.target.value)}><option value="">请选择已完成且存在采购缺口的分析</option>{state.analyses.map(item=><option key={item.id} value={item.id}>{state.boms[item.bom_id]?.code||'未命名BOM'} · 计划 {item.planned_quantity} · 缺口 {item.shortage_count}</option>)}</ForgeSelectControl></div>}
        {form.source_type==='purchase_request'&&<div className="fp-field"><label>采购申请 <span className="fp-required">*</span></label><ForgeSelectControl className="fp-select" aria-label="采购申请" value={form.purchase_request_id} onChange={e=>selectRequest(e.target.value)}><option value="">请选择已审批的采购申请</option>{state.requests.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name} · {item.line_count} 项</option>)}</ForgeSelectControl><div className="fp-secondary">选择后自动带入申请明细，可在下方调整数量与含税单价。</div></div>}

          </DocumentSection>
          <DocumentSection title="采购基本信息" stepNumber={2}>
        <div className="fp-form-grid">
          <div className="fp-field"><label>供应商 <span className="fp-required">*</span></label><ForgeSelectControl className="fp-select" aria-label="供应商" value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})}><option value="">请选择已启用且已审批供应商</option>{state.suppliers.filter(item=>item.status==='active'&&item.approval_status==='approved').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</ForgeSelectControl></div>
          <div className="fp-field"><label>目标仓库</label><ForgeSelectControl className="fp-select" aria-label="目标仓库" value={form.warehouse_id} onChange={e=>setForm({...form,warehouse_id:e.target.value})}><option value="">到货登记时选择</option>{state.warehouses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</ForgeSelectControl></div>
        </div>

            <ObjectForm objectName="forge_purchase_order" dataSource={adapter} mode="create" formType="simple"
              fields={PURCHASE_ORDER_FORM.informationFields} sections={sectionsWithoutHeading(PURCHASE_ORDER_FORM.informationSection)} columns={PURCHASE_ORDER_FORM.columns}
              showSubmit={false} showCancel={false} showReset={false} values={form} onValuesChange={onInformationValuesChange}
              onControllerReady={onInformationControllerReady} submitHandler={values=>values}/>
          </DocumentSection>
          <DocumentSection title="交货日期设置" stepNumber={3}>
            <ObjectForm objectName="forge_purchase_order" dataSource={adapter} mode="create" formType="simple"
              fields={PURCHASE_ORDER_FORM.arrivalFields} sections={sectionsWithoutHeading(PURCHASE_ORDER_FORM.arrivalSection)} columns={PURCHASE_ORDER_FORM.columns}
              showSubmit={false} showCancel={false} showReset={false} values={form} onValuesChange={onInformationValuesChange}
              onControllerReady={onArrivalControllerReady} submitHandler={values=>values}/>
            {form.unified_delivery_date!==false&&<button type="button" className="fp-button" disabled={busy||(form.source_type==='bom_shortage'?!(state.analysisLines||[]).length:!(form.lines||[]).length)} onClick={()=>setForm(current=>({...current,lines:(current.lines||[]).map(line=>({...line,expected_arrival_on:current.expected_arrival_on||'',supplier_confirmed_arrival_on:current.supplier_confirmed_arrival_on||''})),bom_delivery_dates:(state.analysisLines||[]).map(line=>({source_analysis_line_id:line.id,expected_arrival_on:current.expected_arrival_on||'',supplier_confirmed_arrival_on:current.supplier_confirmed_arrival_on||''}))}))}>应用到所有物料</button>}
          </DocumentSection>
          <DocumentSection title="采购物料明细" stepNumber={4}>
            {form.source_type!=='bom_shortage'&&<LineEditor form={form} setForm={setForm} state={state} money={draftMoney} busy={busy} currency={draftCurrency}/>}
        {form.source_type==='bom_shortage'&&state.analysis&&<>
          <div className="fp-source-summary"><div className="fp-source-cell"><span>关联 BOM</span><strong>{selectedBom?.code||'未命名BOM'}</strong></div><div className="fp-source-cell"><span>采购件</span><strong>{state.analysis.component_count}</strong></div><div className="fp-source-cell"><span>缺口项</span><strong>{state.analysis.shortage_count}</strong></div><div className="fp-source-cell"><span>预计未税金额</span><strong>{money(state.analysis.estimated_purchase_amount)}</strong></div></div>
          <div className="fp-table-wrap"><table className="fp-table"><thead><tr><th>物料编码</th><th>名称 / 规格</th><th>单位</th><th className="fp-number">需求</th><th className="fp-number">可用</th><th className="fp-number">采购量</th><th className="fp-number">未税单价</th><th className="fp-number">未税小计</th></tr></thead><tbody>{state.analysisLines.map(line=><tr key={line.id}><td>{line.item_code}</td><td>{line.name}<div className="fp-secondary">{line.specification||line.model||'—'}</div></td><td>{line.unit_name||'—'}</td><td className="fp-number">{line.total_required}</td><td className="fp-number">{line.available_quantity}</td><td className="fp-number">{line.shortage_quantity}</td><td className="fp-number">{money(line.untaxed_unit_price)}</td><td className="fp-number">{money(line.subtotal)}</td></tr>)}</tbody></table></div>
        </>}
            {form.source_type==='bom_shortage'&&form.unified_delivery_date===false&&state.analysis&&<BomDeliveryEditor form={form} setForm={setForm} state={state}/>}
          </DocumentSection>
        </div>} sidebar={<div style={{display:'grid',gap:'18px'}}><DocumentSection title="审批信息"><dl style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr)',gap:'var(--space-3)',margin:0,fontSize:'var(--ui-control-font-size,0.875rem)'}}><dt>创建人</dt><dd style={{margin:0,textAlign:'right'}}>{actor.name||actor.error||'正在读取'}</dd><dt>创建日期</dt><dd style={{margin:0,textAlign:'right'}}>保存后生成</dd></dl></DocumentSection><DocumentSection title="订单概要">
          <dl style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr)',gap:'var(--space-3)',margin:0,fontSize:'var(--ui-control-font-size,0.875rem)'}}>
            <dt>采购来源</dt><dd style={{margin:0,textAlign:'right'}}>{sourceLabel}</dd>
            <dt>供应商</dt><dd style={{margin:0,textAlign:'right',overflowWrap:'anywhere'}}>{supplier(form.supplier_id)?.name||'未选择'}</dd>
            <dt>付款方式</dt><dd style={{margin:0,textAlign:'right'}}>{payMethodText[form.payment_method??PURCHASE_ORDER_FORM.paymentMethodDefault]||'未选择'}</dd>
            <dt>币种</dt><dd style={{margin:0,textAlign:'right'}}>{currencyText[draftCurrency]||draftCurrency}</dd>
            <dt>明细项数</dt><dd style={{margin:0,textAlign:'right'}}>{draftLines.length}</dd>
            <dt>{form.source_type==='bom_shortage'?'预计未税金额':'采购总额'}</dt><dd style={{margin:0,textAlign:'right',fontWeight:600}}>{draftMoney(amount)}</dd>
          </dl>
        </DocumentSection></div>}/>
      </fieldset>}
    </div>;
  }
  function renderDetail(){if(state.loading)return <div className="fp-shell"><ForgeLoading label="正在加载采购订单"/></div>;const order=state.order;if(!order)return <div className="fp-shell"><ForgeNotice tone="error">{state.error||'无法读取采购订单'}</ForgeNotice><button className="fp-button" onClick={()=>route('list')}>返回列表</button></div>;const notice=state.notices[0],orderSupplier=supplier(order.supplier_id);return <div className="fp-shell"><div className="fp-phase"><span className="fp-phase-index">04</span><button className="fp-link-button" onClick={()=>route('list')}>采购订单</button><span>/</span><strong>{order.code}</strong></div>{state.error&&<ForgeNotice tone="error" onClose={()=>setState(s=>({...s,error:''}))}>{state.error}</ForgeNotice>}<div className="fp-page-header"><div className="fp-heading"><div className="fp-title-row"><h1 className="fp-title">{order.code}</h1><ForgeStatus value={order.status} label={statusText[order.status]}/></div><div className="fp-record-summary"><span>{orderSupplier?.name||'未关联供应商'}</span><span>{(state.lines&&state.lines.length)||order.line_count||0} 项物料</span><span>{order.expected_arrival_on||'未填写到货日期'}</span></div></div><div className="fp-toolbar"><button className="fp-button" onClick={()=>route('list')}>返回列表</button><button className="fp-icon-button" disabled={busy} aria-label="刷新" title="刷新" onClick={()=>loadDetail(order.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg></button>{order.status==='draft'&&<button className="fp-button primary" disabled={busy} onClick={()=>setDialog({kind:'submit',code:order.code,order_id:order.id})}>提交审核</button>}{order.status==='pending_approval'&&<button className="fp-button primary" onClick={()=>setDialog({note:'同意',error:''})}>审核订单</button>}{notice&&['pending_arrival','partially_arrived'].includes(notice.status)&&<button className="fp-button primary" onClick={()=>navigate('/apps/com.inoforge.forge.supply-chain/page_purchase_arrival_workspace?notice='+encodeURIComponent(notice.id))}>到货登记</button>}</div></div><div className="fp-order-progress"><Metric label="含税金额" value={money(order.total_amount)}/><Metric label="到货进度" value={pct(order.arrived_quantity,order.total_quantity)+'%'} detail={(order.arrived_quantity||0)+' / '+(order.total_quantity||0)}/><Metric label="入库进度" value={pct(order.inbound_quantity,order.total_quantity)+'%'} detail={(order.inbound_quantity||0)+' / '+(order.total_quantity||0)}/><Metric label="到货通知" value={notice?notice.code:'未生成'} detail={notice?notice.arrived_quantity+' / '+notice.planned_quantity:'审核通过后生成'}/></div><section className="fp-card"><nav className="fp-tabs" aria-label="采购订单详情页签">{['基本信息','物料明细','审批记录','到货通知'].map(name=><button key={name} className={'fp-tab '+(tab===name?'active':'')} onClick={()=>setTab(name)}>{name}{name==='物料明细'?' '+state.lines.length:name==='审批记录'?' '+state.logs.length:name==='到货通知'?' '+state.notices.length:''}</button>)}</nav><div className="fp-detail-content">{tab==='基本信息'&&<div className="fp-detail-grid"><D label="供应商" value={orderSupplier?.name}/><D label="供应商单号" value={order.supplier_order_number}/><D label="期望到货" value={order.expected_arrival_on}/><D label="付款条件" value={order.payment_term}/><D label="币种" value={currencyText[order.currency]||order.currency}/><D label="付款方式" value={payMethodText[order.payment_method]||order.payment_method}/><D label="目标仓库" value={warehouse(order.warehouse_id)?.name}/><D label="应付产生方式" value={payableText[order.payable_trigger]||order.payable_trigger}/><D label="关联 BOM" value={state.boms[order.bom_id]?.code}/><D label="采购原因" value={sourceText[order.source_type]||order.source_type}/><D label="采购员" value={order.responsible_id?'Dev Admin':'—'}/><D label="结算日期" value={order.settlement_on}/><D label="备注" value={order.remarks} wide/></div>}{tab==='物料明细'&&<div className="fp-table-wrap"><table className="fp-table"><thead><tr><th>物料编码</th><th>名称 / 规格</th><th>单位</th><th className="fp-number">数量</th><th className="fp-number">已到货</th><th className="fp-number">已入库</th><th className="fp-number">含税单价</th><th className="fp-number">未税单价</th><th className="fp-number">税率</th><th className="fp-number">含税小计</th></tr></thead><tbody>{state.lines.map(line=><tr key={line.id}><td>{line.item_code}</td><td>{line.name}<div className="fp-secondary">{line.specification||line.model||'—'}</div></td><td>{line.unit_name||'—'}</td><td className="fp-number">{line.quantity}</td><td className="fp-number">{line.arrived_quantity||0}</td><td className="fp-number">{line.inbound_quantity||0}</td><td className="fp-number">{money(line.taxed_unit_price)}</td><td className="fp-number">{money(line.untaxed_unit_price)}</td><td className="fp-number">{line.tax_rate}%</td><td className="fp-number">{money(line.taxed_subtotal)}</td></tr>)}</tbody></table></div>}{tab==='审批记录'&&(!state.logs.length?<ForgeEmpty title="还没有审批记录"/>:<div>{state.logs.slice().sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).map(log=><div className="fp-log-row" key={log.id}><strong>{logText[log.action]||log.action}</strong><span className="fp-secondary">{date(log.occurred_at)}</span><span>{log.comment||'—'}<div className="fp-secondary">{statusText[log.from_status]||log.from_status||'—'} → {statusText[log.to_status]||log.to_status||'—'}</div></span></div>)}</div>)}{tab==='到货通知'&&(!notice?<ForgeEmpty title="尚未生成到货通知" description="订单审核通过后由业务动作生成"/>:<div className="fp-detail-grid"><D label="通知号" value={notice.code}/><D label="状态" value={notice.status==='pending_arrival'?'待到货':notice.status}/><D label="物料种类" value={notice.line_count}/><D label="到货数量" value={notice.arrived_quantity+' / '+notice.planned_quantity}/><D label="预计到货" value={notice.expected_arrival_on}/><D label="目标仓库" value={warehouse(notice.warehouse_id)?.name}/><div className="fp-span-2"><button className="fp-button primary" onClick={()=>navigate('/apps/com.inoforge.forge.supply-chain/page_purchase_arrival_workspace?notice='+encodeURIComponent(notice.id))}>办理到货登记</button></div></div>)}</div></section></div>}
  function Metric({label,value,detail}){return <div className="fp-metric"><div className="fp-metric-label">{label}</div><div className="fp-metric-value">{value}</div>{detail&&<div className="fp-secondary">{detail}</div>}</div>};function D({label,value,wide=false}){return <div className={'fp-detail-item '+(wide?'fp-span-2':'')}><div className="fp-detail-label">{label}</div><div className="fp-detail-value">{value||value===0?value:'—'}</div></div>}
  return <div className="forge-product forge-po"><style>{css}</style>{view==='list'?renderList():view==='new'?renderNewOrder():renderDetail()}{toast&&<div className="fp-toast" role="status">{toast}</div>}<ForgeDialog open={dialog?.kind!=='submit'&&!!dialog} title="审核采购订单" subtitle={state.order?.code} error={dialog?.error} busy={busy} confirmLabel="确认通过" onCancel={()=>!busy&&setDialog(null)} onConfirm={approve}><div className="fp-field"><label>审批意见 <span className="fp-required">*</span></label><textarea className="fp-textarea" aria-label="审批意见" value={dialog?.note||''} onChange={e=>setDialog({...dialog,note:e.target.value,error:''})}/></div></ForgeDialog><ForgeDialog open={dialog?.kind==='submit'} title="提交采购订单审核" subtitle={dialog?.code||state.order?.code} error={dialog?.error} busy={busy} confirmLabel="确认提交" onCancel={()=>!busy&&setDialog(null)} onConfirm={submitOrder}><div className="fp-confirm-list"><p>提交后订单进入审核流程，审核通过将自动生成到货通知。</p><p>提交时会按采购明细重新校验供应商、付款条件与物料数量。</p></div></ForgeDialog></div>
}
export default App;

${forgeProductUiRuntime}
`;

export const PurchaseOrderWorkspacePage = {
  name: 'page_purchase_order_workspace', label: '采购订单', description: '采购订单、物料明细、审核与到货进度',
  icon: 'shopping-cart', type: 'app' as const, kind: 'react' as const, source: purchaseOrderPageSource,
};
