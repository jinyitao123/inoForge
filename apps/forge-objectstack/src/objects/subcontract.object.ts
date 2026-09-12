import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const select = (label: string, options: Array<[string, string]>, defaultValue?: string) => Field.select(
  options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  { label, ...(defaultValue ? { defaultValue } : {}) },
);
const quantity = (label: string, readonly = false) => Field.number({ label, min: 0, scale: 4, defaultValue: 0, ...(readonly ? { readonly: true } : {}) });
const money = (label: string, readonly = false) => Field.currency({ label, precision: 18, scale: 4, min: 0, defaultValue: 0, ...(readonly ? { readonly: true } : {}) });

// Live RISEMAP /subcontract/suppliers: the profile extends an approved supplier master; delivery and yield rates are derived.
export const SubcontractSupplierProfile = master('forge_subcontract_supplier_profile', '委外供应商档案', 'factory', {
  name: text('档案名称', true), supplier_id: reference('forge_supplier', '供应商', true),
  process_capabilities: Field.textarea({ label: '工艺能力', ...required }),
  credit_rating: select('信用等级', [['one','1 星'],['two','2 星'],['three','3 星'],['four','4 星'],['five','5 星']], 'three'),
  default_issue_warehouse_id: reference('forge_warehouse', '默认发料来源仓'),
  default_receipt_warehouse_id: reference('forge_warehouse', '默认回厂入库仓'),
  loss_rate_limit: Field.number({ label: '损耗率上限（%）', min: 0, max: 100, scale: 4, defaultValue: 0 }),
  warranty_terms: Field.textarea({ label: '质保条款' }),
  on_time_rate: Field.number({ label: '交期准时率（%）', min: 0, max: 100, scale: 4, readonly: true }),
  yield_rate: Field.number({ label: '历史良率（%）', min: 0, max: 100, scale: 4, readonly: true }),
  status: { ...select('委外状态', [['active','已开通'],['inactive','已停用']], 'active'), readonly: true },
  activated_by: Field.user({ label: '开通人', readonly: true }), activated_at: Field.datetime({ label: '开通时间', readonly: true }),
  responsible_id: owner(), remarks: remarks(),
}, ['supplier_id','process_capabilities','credit_rating','default_issue_warehouse_id','default_receipt_warehouse_id','on_time_rate','yield_rate','status']);

// RM-083 live page and /subcontract/orders/new. Physical issue, receipt and reconciliation are later documents.
export const SubcontractOrder = master('forge_subcontract_order', '委外订单', 'factory', {
  name: text('订单名称', true), code: code('委外订单号'), supplier_profile_id: reference('forge_subcontract_supplier_profile', '委外供应商档案', true),
  supplier_id: reference('forge_supplier', '委外供应商', true), supply_mode: select('料权方式', [['customer_supplied','甲供料'],['turnkey','包工包料']], 'customer_supplied'),
  expected_delivery_on: Field.date({ label: '期望交期', ...required }), project_id: reference('forge_project', '项目'),
  source_type: select('业务来源', [['manual','手工新建'],['bom','BOM 展开'],['project','项目委外']], 'manual'),
  inspection_method: select('验收方式', [['full','全检'],['sampling','抽检'],['exempt','免检']], 'full'),
  payment_term: text('付款条件', true), line_count: Field.number({ label: '加工件行数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  total_quantity: quantity('加工件总数量', true), processing_amount: money('加工费总额', true),
  issue_planned_quantity: quantity('计划发料数量', true), issued_quantity: quantity('已发料数量', true),
  received_quantity: quantity('已回厂数量', true), reconciled_amount: money('已对账金额', true),
  status: { ...select('订单状态', [['draft','草稿'],['pending_approval','待审核'],['approved','已审核'],['rejected','已驳回'],['in_progress','进行中'],['completed','已完工'],['reconciled','已对账'],['cancelled','已取消']], 'draft'), readonly: true },
  submitted_at: Field.datetime({ label: '提交时间', readonly: true }), submitted_by: Field.user({ label: '提交人', readonly: true }),
  approved_at: Field.datetime({ label: '审核时间', readonly: true }), approved_by: Field.user({ label: '审核人', readonly: true }),
  approval_note: Field.textarea({ label: '审核意见', readonly: true }), responsible_id: owner(true), remarks: remarks(),
}, ['code','supplier_id','supply_mode','project_id','payment_term','processing_amount','issued_quantity','received_quantity','reconciled_amount','expected_delivery_on','status']);

export const SubcontractOrderLine = master('forge_subcontract_order_line', '委外订单加工件', 'list', {
  name: text('物料名称', true), order_id: reference('forge_subcontract_order', '委外订单', true), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编号', true), specification: text('规格'), process_type: text('加工类型', true),
  quantity: Field.number({ label: '数量', min: 0.0001, scale: 4, ...required }), unit_name: text('单位', true),
  unit_price: money('加工单价'), subtotal: money('加工小计', true), expected_delivery_on: Field.date({ label: '期望交期' }),
  drawing_number: text('图纸号'), received_good_quantity: quantity('已回良品', true), received_bad_quantity: quantity('已回不良品', true), remarks: remarks(),
}, ['order_id','item_code','name','specification','process_type','quantity','unit_name','unit_price','subtotal','expected_delivery_on','drawing_number']);

export const SubcontractMaterialPlan = master('forge_subcontract_material_plan', '委外发料计划', 'boxes', {
  name: text('物料名称', true), order_id: reference('forge_subcontract_order', '委外订单', true),
  order_line_id: reference('forge_subcontract_order_line', '用于加工件', true), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编号', true), specification: text('规格'), planned_quantity: Field.number({ label: '计划发料', min: 0.0001, scale: 4, ...required }),
  standard_quantity: Field.number({ label: '标准应耗', min: 0.0001, scale: 4, ...required }), unit_name: text('单位', true),
  issued_quantity: quantity('已发料', true), returned_quantity: quantity('已退料', true), remarks: remarks(),
}, ['order_id','order_line_id','item_code','name','specification','planned_quantity','standard_quantity','unit_name','issued_quantity','returned_quantity']);

export const SubcontractOrderApprovalLog = master('forge_subcontract_order_approval_log', '委外订单审核记录', 'history', {
  name: text('记录名称', true), order_id: reference('forge_subcontract_order', '委外订单', true),
  action: select('审核动作', [['submitted','提交审核'],['approved','同意'],['rejected','驳回']]),
  from_status: text('原状态'), to_status: text('新状态'), comment: Field.textarea({ label: '审核意见' }),
  occurred_at: Field.datetime({ label: '操作时间', ...required, readonly: true }), operator_id: Field.user({ label: '操作人', ...required, readonly: true }),
}, ['order_id','action','from_status','to_status','comment','operator_id','occurred_at']);
