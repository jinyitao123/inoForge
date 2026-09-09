import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const endpoint=process.env.FORGE_URL||'http://localhost:4357',database=process.env.FORGE_DB||'.objectstack/otc-production-transform.sqlite',api=await connect(endpoint),cases=[],ids={operator:api.userId};
const round4=value=>Math.round((Number(value)+Number.EPSILON)*10000)/10000;
async function test(name,run){try{await run();cases.push({name,status:'passed'});console.log('PASS '+name);}catch(error){cases.push({name,status:'failed',error:error.message});console.error('FAIL '+name+': '+error.message);}}
async function find(object,where={}){const q=new URLSearchParams({$filter:JSON.stringify(where),$top:'200'}),r=await api.request(`/data/${object}?${q}`);assert.equal(r.status,200,object+': '+JSON.stringify(r.value));return (r.value.records||[]).filter(x=>Object.entries(where).every(([k,v])=>x[k]===v));}
async function read(object,id){const r=await api.request(`/data/${object}/${id}`);assert.equal(r.status,200,object+'/'+id+': '+JSON.stringify(r.value));return r.value.record;}
async function invoke(object,action,id,params={},authenticated=true){return api.request(`/actions/${object}/${action}/${id}`,'POST',{params},authenticated);}
const resultOf=r=>r.value?.result??r.value?.data?.result??r.value?.data??r.value;

const boms=await find('forge_bom',{status:'active'}),bom=boms.find(x=>x.bom_type==='project')||boms[0];assert.ok(bom,'active BOM required');ids.bom=bom.id;
const warehouse=(await find('forge_warehouse'))[0];assert.ok(warehouse);ids.warehouse=warehouse.id;
const nodes=(await find('forge_bom_node',{bom_id:bom.id})).filter(x=>x.parent_id&&x.sku_id);assert.equal(nodes.length,4);
const skuById=Object.fromEntries(await Promise.all(nodes.map(async x=>[x.sku_id,await read('forge_material_sku',x.sku_id)])));
const materialBySku=Object.fromEntries(await Promise.all(nodes.map(async x=>{const sku=skuById[x.sku_id];return[x.sku_id,await read('forge_material',sku.material_id)];})));
const nodeByCode=Object.fromEntries(nodes.map(x=>[materialBySku[x.sku_id].code,x]));
const productSku=(await find('forge_material_sku',{material_id:bom.material_id})).find(x=>x.enabled!==false);assert.ok(productSku);ids.productSku=productSku.id;
const productBalance=(await find('forge_inventory_balance',{balance_key:warehouse.id+':'+productSku.id}))[0];assert.ok(productBalance);assert.ok(Number(productBalance.available_quantity)>=2);ids.productBalance=productBalance.id;
const baseline={product:{onHand:Number(productBalance.on_hand_quantity),available:Number(productBalance.available_quantity),average:Number(productBalance.average_cost),value:Number(productBalance.inventory_value)},components:{}};
for(const node of nodes){const balance=(await find('forge_inventory_balance',{balance_key:warehouse.id+':'+node.sku_id}))[0];baseline.components[node.sku_id]={id:balance?.id||null,onHand:Number(balance?.on_hand_quantity||0),available:Number(balance?.available_quantity||0),average:Number(balance?.average_cost||0),value:Number(balance?.inventory_value||0)};}
const disassemblyLines=nodes.map(node=>({bom_node_id:node.id,recovered_quantity:round4(Number(node.quantity||0)*(1+Number(node.loss_rate||0)/100)),scrapped_quantity:0}));
const disassemblyParams={quantity:1,warehouse_id:warehouse.id,handled_on:'2026-09-10',reason:'成品返拆并回收可用物料',lines_json:JSON.stringify(disassemblyLines),remarks:'OEM-RM-20260909-A RM-070验收'};

await test('rejects anonymous and incomplete disassembly while preserving stock',async()=>{
  assert.equal((await invoke('forge_bom','bom_create_disassembly',bom.id,disassemblyParams,false)).status,401);
  const invalid={...disassemblyParams,lines_json:JSON.stringify(disassemblyLines.map((x,i)=>i?x:{...x,recovered_quantity:0,scrapped_quantity:0}))};const response=await invoke('forge_bom','bom_create_disassembly',bom.id,invalid);assert.equal(response.status,400);assert.match(JSON.stringify(response.value),/必须等于理论拆出数量/);
  assert.equal(Number((await read('forge_inventory_balance',productBalance.id)).on_hand_quantity),baseline.product.onHand);
});

let expectedRecovery=0;
await test('creates a pending full-BOM disassembly without moving inventory',async()=>{
  const response=await invoke('forge_bom','bom_create_disassembly',bom.id,disassemblyParams);assert.equal(response.status,200,JSON.stringify(response.value));const result=resultOf(response);ids.disassembly=result.id;assert.deepEqual({code:result.code,status:result.status,lines:result.line_count},{code:'DIS-2026-0001',status:'pending_approval',lines:4});
  const lines=await find('forge_disassembly_line',{disassembly_id:ids.disassembly});assert.equal(lines.length,4);assert.ok(lines.every(x=>round4(Number(x.recovered_quantity)+Number(x.scrapped_quantity))===Number(x.theoretical_quantity)&&x.status==='pending_approval'));expectedRecovery=round4(lines.reduce((s,x)=>s+Number(x.recovered_amount),0));assert.equal(expectedRecovery,16320);assert.equal((await find('forge_inventory_ledger',{source_id:ids.disassembly})).length,0);assert.equal(Number((await read('forge_inventory_balance',productBalance.id)).on_hand_quantity),baseline.product.onHand);
});

let releasedCost,scrapLoss;
await test('confirms disassembly with one finished outbound and four recovered component ledgers',async()=>{
  assert.equal((await invoke('forge_disassembly_order','disassembly_confirm',ids.disassembly,{approval_note:' '})).status,400);
  const response=await invoke('forge_disassembly_order','disassembly_confirm',ids.disassembly,{approval_note:'成品库存、拆解分配和回收价值已核对'});assert.equal(response.status,200,JSON.stringify(response.value));const result=resultOf(response);releasedCost=round4(baseline.product.average);scrapLoss=round4(releasedCost-expectedRecovery);assert.deepEqual({status:result.status,before:result.product_before_on_hand,after:result.product_after_on_hand,released:result.released_cost,recovered:result.recovered_value,loss:result.scrap_loss},{status:'stocked',before:baseline.product.onHand,after:baseline.product.onHand-1,released:releasedCost,recovered:expectedRecovery,loss:scrapLoss});
  const order=await read('forge_disassembly_order',ids.disassembly);assert.deepEqual({status:order.status,released:order.released_cost,recovered:order.recovered_value,loss:order.scrap_loss},{status:'stocked',released:releasedCost,recovered:expectedRecovery,loss:scrapLoss});const product=await read('forge_inventory_balance',productBalance.id);assert.equal(Number(product.on_hand_quantity),baseline.product.onHand-1);const ledgers=await find('forge_inventory_ledger',{source_id:ids.disassembly});assert.equal(ledgers.length,5);assert.equal(ledgers.filter(x=>x.movement_type==='disassembly_outbound').length,1);assert.equal(ledgers.filter(x=>x.movement_type==='disassembly_recovery').length,4);
  for(const node of nodes){const base=baseline.components[node.sku_id],balance=(await find('forge_inventory_balance',{balance_key:warehouse.id+':'+node.sku_id}))[0];assert.equal(Number(balance.on_hand_quantity),round4(base.onHand+Number(node.quantity||0)*(1+Number(node.loss_rate||0)/100)));}
  assert.equal((await invoke('forge_disassembly_order','disassembly_confirm',ids.disassembly,{approval_note:'重复确认'})).status,400);
});

const replacementLines=[
  {old_bom_node_id:nodeByCode['RM-HMI-700'].id,old_quantity:1,old_destination:'recover',new_sku_id:nodeByCode['RM-PLC-1215C'].sku_id,new_quantity:1},
  {old_bom_node_id:nodeByCode['RM-PSU-24V10A'].id,old_quantity:1,old_destination:'scrap',new_sku_id:nodeByCode['RM-CAB-800'].sku_id,new_quantity:1},
];
const replacementParams={quantity:1,warehouse_id:warehouse.id,handled_on:'2026-09-10',reason:'在库控制柜部件升级替换',lines_json:JSON.stringify(replacementLines),remarks:'OEM-RM-20260909-A RM-071验收'};

await test('creates a pending replacement with recover and scrap destinations but no stock movement',async()=>{
  const over={...replacementParams,lines_json:JSON.stringify([{...replacementLines[0],old_quantity:2}])};const rejected=await invoke('forge_bom','bom_create_replacement',bom.id,over);assert.equal(rejected.status,400);assert.match(JSON.stringify(rejected.value),/不能超过当前BOM理论数量/);
  const beforeProduct=await read('forge_inventory_balance',productBalance.id),beforeLedgers=(await find('forge_inventory_ledger')).length;const response=await invoke('forge_bom','bom_create_replacement',bom.id,replacementParams);assert.equal(response.status,200,JSON.stringify(response.value));const result=resultOf(response);ids.replacement=result.id;assert.deepEqual({code:result.code,status:result.status,lines:result.line_count},{code:'REP-2026-0001',status:'pending_approval',lines:2});assert.equal((await find('forge_replacement_line',{replacement_id:ids.replacement})).length,2);assert.equal(Number((await read('forge_inventory_balance',productBalance.id)).on_hand_quantity),Number(beforeProduct.on_hand_quantity));assert.equal((await find('forge_inventory_ledger')).length,beforeLedgers);
});

await test('confirms replacement while finished stock stays constant and only recovered old parts return',async()=>{
  const beforeProduct=await read('forge_inventory_balance',productBalance.id),beforeByCode={};for(const code of ['RM-HMI-700','RM-PSU-24V10A','RM-PLC-1215C','RM-CAB-800'])beforeByCode[code]=(await find('forge_inventory_balance',{balance_key:warehouse.id+':'+nodeByCode[code].sku_id}))[0];
  const response=await invoke('forge_replacement_order','replacement_confirm',ids.replacement,{approval_note:'整机在库、新件库存与旧件处置已核对'});assert.equal(response.status,200,JSON.stringify(response.value));const result=resultOf(response);assert.deepEqual({status:result.status,before:result.product_before_on_hand,after:result.product_after_on_hand,newCost:result.new_part_cost,oldValue:result.old_part_value,change:result.cost_change},{status:'stocked',before:Number(beforeProduct.on_hand_quantity),after:Number(beforeProduct.on_hand_quantity),newCost:11400,oldValue:3200,change:8200});const afterProduct=await read('forge_inventory_balance',productBalance.id);assert.equal(Number(afterProduct.on_hand_quantity),Number(beforeProduct.on_hand_quantity));assert.equal(Number(afterProduct.inventory_value),Number(beforeProduct.inventory_value));
  const after={};for(const code of Object.keys(beforeByCode))after[code]=(await find('forge_inventory_balance',{balance_key:warehouse.id+':'+nodeByCode[code].sku_id}))[0];assert.equal(Number(after['RM-HMI-700'].on_hand_quantity),Number(beforeByCode['RM-HMI-700'].on_hand_quantity)+1);assert.equal(Number(after['RM-PSU-24V10A'].on_hand_quantity),Number(beforeByCode['RM-PSU-24V10A'].on_hand_quantity));assert.equal(Number(after['RM-PLC-1215C'].on_hand_quantity),Number(beforeByCode['RM-PLC-1215C'].on_hand_quantity)-1);assert.equal(Number(after['RM-CAB-800'].on_hand_quantity),Number(beforeByCode['RM-CAB-800'].on_hand_quantity)-1);
  const ledgers=await find('forge_inventory_ledger',{source_id:ids.replacement});assert.equal(ledgers.length,3);assert.equal(ledgers.filter(x=>x.movement_type==='replacement_issue').length,2);assert.equal(ledgers.filter(x=>x.movement_type==='replacement_recovery').length,1);const lines=await find('forge_replacement_line',{replacement_id:ids.replacement});assert.ok(lines.every(x=>x.status==='stocked'));assert.equal(lines.find(x=>x.old_item_code==='RM-PSU-24V10A').old_recovered_amount,0);assert.equal((await invoke('forge_replacement_order','replacement_confirm',ids.replacement,{approval_note:'重复确认'})).status,400);
});

await mkdir('.objectstack/acceptance',{recursive:true});
const report={recordedAt:new Date().toISOString(),kind:'risemap-observed-production-transform-forge-closure',fixture:'OEM-RM-20260909-A-production-transform-v0.1',endpoint,database,sourceDatabaseSnapshot:{from:'otc-production-assembly.sqlite',integrityCheck:'ok',baseline},ids,cases,passed:cases.every(x=>x.status==='passed'),financials:{disassembly:{releasedCost,recoveredValue:expectedRecovery,scrapLoss},replacement:{newPartCost:11400,oldPartValue:3200,costChange:8200}},risemapObserved:{disassembly:'成品库存减少，每项理论拆出量完整分配为回收或报废',replacement:'成品库存不变，新件领用出库，旧件可回收入库或报废'},boundary:'Forge proves persisted disassembly and replacement postings on the continued OTC inventory. RISEMAP same-record save, approval and posting remain unverified because external mutation was not authorized. Writes are sequential rather than transactionally atomic; configured reason dictionaries, approval routing and lot/SN genealogy remain open.'};
await writeFile('.objectstack/acceptance/production-transform-report.json',JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
