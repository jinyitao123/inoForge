import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const quantity = (label: string, defaultValue = 0) => Field.number({ label, min: 0, scale: 4, defaultValue });
const amount = (label: string) => Field.currency({ label, precision: 18, scale: 4, min: 0, defaultValue: 0 });
const select = (label: string, options: Array<[string, string]>, defaultValue?: string, readonly = false) => Field.select(
  options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  { label, ...(defaultValue ? { defaultValue } : {}), ...(readonly ? { readonly: true } : {}) },
);

// RM-065: an assembly order expands one active BOM into auditable material
// requirements. Quantity, cost and stock progress are maintained by actions.
export const AssemblyOrder = master('forge_assembly_order', '组装单', 'factory', {
  name: text('组装单名称', true), code: code('组装单号'), product_id: reference('forge_material', '成品', true),
  product_sku_id: reference('forge_material_sku', '成品规格', true), bom_id: reference('forge_bom', 'BOM', true),
  bom_version: text('BOM版本', true), warehouse_id: reference('forge_warehouse', '出入库仓库'),
  sales_order_id: reference('forge_sales_order', '来源销售订单'), planned_quantity: { ...quantity('计划数量', 1), ...required },
  qualified_quantity: { ...quantity('合格数量'), readonly: true }, rejected_quantity: { ...quantity('不合格数量'), readonly: true },
  inbound_quantity: { ...quantity('已入库数量'), readonly: true }, material_line_count: { ...quantity('物料种数'), readonly: true },
  readiness_rate: { ...Field.number({ label: '齐套率', min: 0, max: 100, scale: 2, defaultValue: 0 }), readonly: true },
  shortage_line_count: { ...quantity('缺料项数'), readonly: true }, issued_quantity: { ...quantity('累计领用数量'), readonly: true },
  returned_quantity: { ...quantity('累计退回数量'), readonly: true }, material_cost: { ...amount('物料投入成本'), readonly: true },
  status: select('组装状态', [
    ['draft', '草稿'], ['waiting_pick', '待领料'], ['assembling', '组装中'], ['completed', '已完工'],
    ['rejected', '已驳回'], ['cancelled', '已取消'],
  ], 'draft', true),
  planned_completion_on: Field.date({ label: '计划完工日期' }), released_at: Field.datetime({ label: '下达时间', readonly: true }),
  picked_at: Field.datetime({ label: '开始组装时间', readonly: true }), completed_at: Field.datetime({ label: '完工时间', readonly: true }),
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'product_id', 'bom_id', 'planned_quantity', 'qualified_quantity', 'rejected_quantity', 'material_line_count', 'material_cost', 'status', 'planned_completion_on']);

export const AssemblyMaterialLine = master('forge_assembly_material_line', '组装物料需求', 'list', {
  name: text('物料名称', true), assembly_id: reference('forge_assembly_order', '组装单', true),
  bom_node_id: reference('forge_bom_node', 'BOM节点', true), sku_id: reference('forge_material_sku', '物料规格', true),
  material_id: reference('forge_material', '物料', true), item_code: text('物料编码', true), model: text('型号'), specification: text('规格'),
  unit_name: text('单位'), unit_quantity: quantity('单台用量'), loss_rate: quantity('损耗率'), required_quantity: quantity('需求数量'),
  available_snapshot: quantity('可用库存快照'), allocated_quantity: quantity('分配数量'), shortage_quantity: quantity('缺料数量'),
  issued_quantity: { ...quantity('BOM领用数量'), readonly: true }, supplied_quantity: { ...quantity('补料数量'), readonly: true },
  returned_quantity: { ...quantity('退料数量'), readonly: true }, net_issued_quantity: { ...quantity('净领用数量'), readonly: true },
  unit_cost: { ...amount('成本单价'), readonly: true }, material_amount: { ...amount('净投入金额'), readonly: true },
  status: select('物料状态', [['shortage', '缺料'], ['ready', '可领料'], ['issued', '已领料'], ['completed', '已结清']], 'shortage', true),
}, ['assembly_id', 'item_code', 'name', 'required_quantity', 'available_snapshot', 'shortage_quantity', 'net_issued_quantity', 'material_amount', 'status']);

// RM-067 to RM-069 share the same approval and stock-posting document model.
export const ProductionMaterialDocument = master('forge_production_material_document', '生产领退补料单', 'clipboard-list', {
  name: text('单据名称', true), code: code('单据编号'), document_type: select('单据类型', [
    ['issue', '领料单'], ['supply', '补料单'], ['return', '退料单'],
  ]), assembly_id: reference('forge_assembly_order', '来源组装单', true), product_sku_id: reference('forge_material_sku', '成品规格', true),
  warehouse_id: reference('forge_warehouse', '仓库', true), line_count: { ...quantity('物料种数'), readonly: true },
  total_quantity: { ...quantity('物料数量'), readonly: true }, total_amount: { ...amount('物料金额'), readonly: true },
  status: select('单据状态', [['pending_approval', '审批中'], ['confirmed', '已确认'], ['rejected', '已驳回'], ['voided', '已作废']], 'pending_approval', true),
  handled_on: Field.date({ label: '业务日期', ...required }), handler_id: owner(true), approval_note: Field.textarea({ label: '审批意见', readonly: true }),
  confirmed_at: Field.datetime({ label: '确认时间', readonly: true }), confirmed_by: Field.user({ label: '确认人', readonly: true }), remarks: remarks(),
}, ['code', 'document_type', 'assembly_id', 'line_count', 'total_quantity', 'total_amount', 'handler_id', 'handled_on', 'status']);

export const ProductionMaterialDocumentLine = master('forge_production_material_document_line', '生产领退补料明细', 'list', {
  name: text('物料名称', true), document_id: reference('forge_production_material_document', '领退补料单', true),
  assembly_id: reference('forge_assembly_order', '组装单', true), assembly_line_id: reference('forge_assembly_material_line', '组装物料需求', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码', true), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  quantity: quantity('数量'), unit_cost: { ...amount('含税单位成本'), readonly: true }, amount: { ...amount('含税金额'), readonly: true },
  before_on_hand: { ...quantity('变动前库存'), readonly: true }, after_on_hand: { ...quantity('变动后库存'), readonly: true },
  direction: select('变动方向', [['outbound', '出库'], ['inbound', '入库']], undefined, true),
  status: select('明细状态', [['pending_approval', '审批中'], ['confirmed', '已确认'], ['rejected', '已驳回'], ['voided', '已作废']], 'pending_approval', true),
  remarks: remarks(),
}, ['document_id', 'item_code', 'name', 'quantity', 'unit_cost', 'amount', 'direction', 'status']);

// RM-065 explicitly separates batch inbound quantity from order completion.
export const ProductionInbound = master('forge_production_inbound', '生产入库单', 'package-plus', {
  name: text('入库单名称', true), code: code('入库单号'), assembly_id: reference('forge_assembly_order', '来源组装单', true),
  product_sku_id: reference('forge_material_sku', '成品规格', true), warehouse_id: reference('forge_warehouse', '入库仓库', true),
  qualified_quantity: quantity('合格入库数量'), rejected_quantity: quantity('不合格数量'), unit_cost: amount('成品单位成本'),
  inventory_amount: amount('入库金额'), before_on_hand: quantity('入库前库存'), after_on_hand: quantity('入库后库存'),
  batch_number: text('批次'), inbound_on: Field.date({ label: '入库日期', ...required }),
  status: select('入库状态', [['stocked', '已入库']], 'stocked', true), responsible_id: owner(true), remarks: remarks(),
}, ['code', 'assembly_id', 'product_sku_id', 'warehouse_id', 'qualified_quantity', 'rejected_quantity', 'unit_cost', 'inventory_amount', 'inbound_on', 'status']);

export const ProductionApprovalLog = master('forge_production_approval_log', '生产审批与执行记录', 'history', {
  name: text('记录名称', true), event_key: code('事件编号'), source_object: text('来源对象', true), source_id: text('来源记录ID', true),
  action: select('动作', [['released', '下达'], ['submitted', '提交审批'], ['confirmed', '确认'], ['stocked', '入库'], ['completed', '完工']]),
  from_status: text('原状态'), to_status: text('新状态'), comment: Field.textarea({ label: '说明' }),
  occurred_at: Field.datetime({ label: '发生时间', ...required }), operator_id: Field.user({ label: '操作人', ...required }),
}, ['occurred_at', 'source_object', 'source_id', 'action', 'from_status', 'to_status', 'operator_id']);
