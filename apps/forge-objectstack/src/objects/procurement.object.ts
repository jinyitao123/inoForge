import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const select = (label: string, options: Array<[string, string]>, defaultValue?: string) => Field.select(
  options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  { label, ...(defaultValue ? { defaultValue } : {}) },
);
const positiveQuantity = (label = '数量') => Field.number({ label, min: 0.0001, scale: 4, ...required });
const nonNegativeQuantity = (label: string, readonly = false) => Field.number({ label, min: 0, scale: 4, defaultValue: 0, ...(readonly ? { readonly: true } : {}) });
const nonNegativeMoney = (label: string, scale = 4) => Field.currency({ label, precision: 18, scale, min: 0 });
const percentage = (label: string, defaultValue = 13) => Field.number({ label, min: 0, max: 100, scale: 4, defaultValue });

// RM-021 / DR-0048 to DR-0050. The order is the commercial source for later arrival, inspection and inbound work.
export const PurchaseOrder = master('forge_purchase_order', '采购订单', 'shopping-cart', {
  name: text('订单名称', true), code: code('采购订单号'), supplier_id: reference('forge_supplier', '供应商', true),
  supplier_order_number: text('供应商单号'), source_type: select('采购来源', [
    ['inventory_replenishment', '库存补充'], ['project', '项目采购'], ['sales_driven', '以销定采'],
    ['bom_shortage', 'BOM缺料'], ['purchase_request', '采购申请'],
  ], 'inventory_replenishment'),
  bom_id: reference('forge_bom', '关联BOM'), shortage_analysis_id: reference('forge_bom_shortage_analysis', '缺料分析快照'),
  project_id: reference('forge_project', '关联项目'), warehouse_id: reference('forge_warehouse', '目标仓库'),
  expected_arrival_on: Field.date({ label: '期望到货日期', ...required }), order_on: Field.date({ label: '下单日期' }),
  payment_term: text('付款条件', true), payment_method: select('付款方式', [
    ['bank_transfer', '银行转账'], ['wire_transfer', '电汇'], ['bank_acceptance', '承兑汇票'],
    ['online_payment', '在线支付'], ['cash', '现金'], ['other', '其他'],
  ], 'bank_transfer'),
  currency: select('币种', [['cny', '人民币'], ['usd', '美元'], ['eur', '欧元']], 'cny'),
  exchange_rate: Field.number({ label: '汇率', min: 0.000001, scale: 6, defaultValue: 1 }),
  payable_trigger: select('应付产生方式', [['inbound', '按入库'], ['invoice', '按发票']], 'inbound'),
  settlement_on: Field.date({ label: '结算日期' }), arrival_address: text('到货地址'),
  responsible_id: owner(true), line_count: Field.number({ label: '物料数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  total_quantity: nonNegativeQuantity('采购总数量', true), total_amount: nonNegativeMoney('含税总额'),
  arrived_quantity: nonNegativeQuantity('已到货数量', true), inbound_quantity: nonNegativeQuantity('已入库数量', true),
  status: { ...select('订单状态', [
    ['draft', '草稿'], ['pending_approval', '待审核'], ['approved', '已审核'], ['partially_arrived', '部分到货'], ['arrived', '已到货'],
    ['completed', '已完成'], ['rejected', '已驳回'], ['cancelled', '已取消'],
  ], 'draft'), readonly: true },
  submitted_at: Field.datetime({ label: '提交时间', readonly: true }), submitted_by: Field.user({ label: '提交人', readonly: true }),
  approved_at: Field.datetime({ label: '审核时间', readonly: true }), approved_by: Field.user({ label: '审核人', readonly: true }), remarks: remarks(),
}, ['code', 'name', 'supplier_id', 'bom_id', 'expected_arrival_on', 'warehouse_id', 'total_amount', 'arrived_quantity', 'inbound_quantity', 'status', 'responsible_id']);

export const PurchaseOrderLine = master('forge_purchase_order_line', '采购订单明细', 'list', {
  name: text('物料名称', true), order_id: reference('forge_purchase_order', '采购订单', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), quantity: positiveQuantity(),
  arrived_quantity: nonNegativeQuantity('已到货数量', true), inspected_quantity: nonNegativeQuantity('已检验数量', true),
  accepted_quantity: nonNegativeQuantity('合格数量', true), inbound_quantity: nonNegativeQuantity('已入库数量', true),
  taxed_unit_price: nonNegativeMoney('含税单价'), untaxed_unit_price: nonNegativeMoney('不含税单价'),
  tax_rate: percentage('税率'), taxed_subtotal: nonNegativeMoney('含税小计'),
  source_bom_id: reference('forge_bom', '来源BOM'), source_analysis_line_id: reference('forge_bom_shortage_line', '来源缺料明细'),
  expected_arrival_on: Field.date({ label: '期望到货日期' }), remarks: remarks(),
}, ['order_id', 'item_code', 'name', 'model', 'quantity', 'arrived_quantity', 'inspected_quantity', 'inbound_quantity', 'taxed_unit_price', 'taxed_subtotal']);

// Live RISEMAP evidence: approval produces one order-level notice with multiple material lines; it does not record physical receipt.
export const PurchaseArrivalNotice = master('forge_purchase_arrival_notice', '采购到货通知', 'package-search', {
  name: text('到货通知名称', true), code: code('到货通知号'), order_id: reference('forge_purchase_order', '采购订单', true),
  supplier_id: reference('forge_supplier', '供应商', true), warehouse_id: reference('forge_warehouse', '目标仓库'),
  expected_arrival_on: Field.date({ label: '预计到货日期', ...required }), line_count: Field.number({ label: '物料种类', min: 0, scale: 0, readonly: true }),
  planned_quantity: positiveQuantity('待到货总数量'), arrived_quantity: nonNegativeQuantity('已到货总数量', true),
  status: { ...select('到货状态', [
    ['pending_arrival', '待到货'], ['partially_arrived', '部分到货'], ['arrived', '已到货'], ['cancelled', '已取消'],
  ], 'pending_arrival'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'order_id', 'supplier_id', 'warehouse_id', 'expected_arrival_on', 'line_count', 'planned_quantity', 'arrived_quantity', 'status']);

export const PurchaseArrivalNoticeLine = master('forge_purchase_arrival_notice_line', '到货通知明细', 'list', {
  name: text('物料名称', true), notice_id: reference('forge_purchase_arrival_notice', '到货通知', true),
  order_id: reference('forge_purchase_order', '采购订单', true), order_line_id: reference('forge_purchase_order_line', '采购订单明细', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), planned_quantity: positiveQuantity('待到货数量'),
  arrived_quantity: nonNegativeQuantity('已到货数量', true), status: { ...select('到货状态', [
    ['pending_arrival', '待到货'], ['partially_arrived', '部分到货'], ['arrived', '已到货'], ['cancelled', '已取消'],
  ], 'pending_arrival'), readonly: true },
}, ['notice_id', 'item_code', 'name', 'model', 'unit_name', 'planned_quantity', 'arrived_quantity', 'status']);

export const PurchaseOrderApprovalLog = master('forge_purchase_order_approval_log', '采购订单审批记录', 'history', {
  name: text('记录名称', true), order_id: reference('forge_purchase_order', '采购订单', true),
  action: select('审批动作', [['submitted', '提交审核'], ['approved', '同意'], ['rejected', '驳回']]),
  from_status: text('原状态'), to_status: text('新状态'), comment: Field.textarea({ label: '审批意见' }),
  occurred_at: Field.datetime({ label: '操作时间', ...required, readonly: true }), operator_id: Field.user({ label: '操作人', ...required, readonly: true }),
}, ['order_id', 'action', 'from_status', 'to_status', 'comment', 'operator_id', 'occurred_at']);

// RM-006 to RM-008 and RM-025 expose the observable sequence arrival registration -> inspection -> purchase inbound.
// RISEMAP has not yet completed this sequence with the shared fixture, so these records preserve a reviewable Forge slice.
export const PurchaseReceipt = master('forge_purchase_receipt', '采购到货登记', 'package-check', {
  name: text('到货登记名称', true), code: code('到货单号'), notice_id: reference('forge_purchase_arrival_notice', '到货通知', true),
  order_id: reference('forge_purchase_order', '采购订单', true), supplier_id: reference('forge_supplier', '供应商', true),
  customer_id: reference('forge_customer', '关联客户'), warehouse_id: reference('forge_warehouse', '默认到货仓库'),
  arrival_type: select('到货类型', [['purchase', '采购到货'], ['other', '其他到货'], ['return', '退货到货']], 'purchase'),
  arrived_on: Field.date({ label: '到货日期', ...required }), contact_name: text('送货联系人'), contact_phone: text('联系电话'),
  carrier: text('承运方'), logistics_number: text('物流单号'), line_count: Field.number({ label: '物料行数', min: 0, scale: 0, readonly: true }),
  total_quantity: nonNegativeQuantity('到货总数量', true), untaxed_amount: nonNegativeMoney('不含税金额'), taxed_amount: nonNegativeMoney('含税金额'),
  status: { ...select('到货登记状态', [
    ['draft', '草稿'], ['pending_inspection', '待检验'], ['inspection_in_progress', '检验中'], ['inspected', '已检验'],
    ['stocked', '已入库'], ['cancelled', '已取消'],
  ], 'draft'), readonly: true }, submitted_at: Field.datetime({ label: '提交待检时间', readonly: true }), submitted_by: Field.user({ label: '提交人', readonly: true }),
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'arrived_on', 'supplier_id', 'order_id', 'warehouse_id', 'line_count', 'total_quantity', 'taxed_amount', 'status']);

export const PurchaseReceiptLine = master('forge_purchase_receipt_line', '到货登记明细', 'list', {
  name: text('物料名称', true), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  notice_id: reference('forge_purchase_arrival_notice', '到货通知', true), notice_line_id: reference('forge_purchase_arrival_notice_line', '到货通知明细', true),
  order_id: reference('forge_purchase_order', '采购订单', true), order_line_id: reference('forge_purchase_order_line', '采购订单明细', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  quantity: positiveQuantity('到货数量'), warehouse_id: reference('forge_warehouse', '到货仓库', true), warehouse_location: text('库位'),
  external_sn: text('外部 SN'), batch_number: text('批次号'), taxed_unit_price: nonNegativeMoney('含税单价'),
  untaxed_unit_price: nonNegativeMoney('不含税单价'), tax_rate: percentage('税率'), untaxed_amount: nonNegativeMoney('不含税金额'), taxed_amount: nonNegativeMoney('含税金额'),
  status: { ...select('明细状态', [['draft', '草稿'], ['pending_inspection', '待检验'], ['inspection_created', '已建检验单'], ['inspected', '已检验'], ['stocked', '已入库'], ['cancelled', '已取消']], 'draft'), readonly: true },
  remarks: remarks(),
}, ['receipt_id', 'item_code', 'name', 'model', 'unit_name', 'quantity', 'warehouse_id', 'taxed_amount', 'status']);

export const PendingInspection = master('forge_pending_inspection', '待检验库存', 'clipboard-clock', {
  name: text('待检记录名称', true), code: code('待检单号'), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  receipt_line_id: reference('forge_purchase_receipt_line', '到货登记明细', true), order_id: reference('forge_purchase_order', '采购订单', true),
  order_line_id: reference('forge_purchase_order_line', '采购订单明细', true), supplier_id: reference('forge_supplier', '供应商'),
  customer_id: reference('forge_customer', '客户'), warehouse_id: reference('forge_warehouse', '到货仓库', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), arrival_quantity: positiveQuantity('到货数量'),
  batch_number: text('批次号'), external_sn: text('外部 SN'), arrived_on: Field.date({ label: '到货日期', ...required }),
  inspection_id: reference('forge_purchase_inspection', '关联检验单'),
  status: { ...select('待检状态', [['pending', '待检验'], ['inspection_created', '检验中'], ['inspected', '已检验'], ['exempt', '免检']], 'pending'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'item_code', 'name', 'model', 'arrival_quantity', 'unit_name', 'batch_number', 'supplier_id', 'order_id', 'status']);

export const PurchaseInspection = master('forge_purchase_inspection', '采购检验单', 'clipboard-check', {
  name: text('检验单名称', true), code: code('检验单号'), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  receipt_line_id: reference('forge_purchase_receipt_line', '到货登记明细'), pending_inspection_id: reference('forge_pending_inspection', '待检记录'),
  order_id: reference('forge_purchase_order', '采购订单', true), order_line_id: reference('forge_purchase_order_line', '采购订单明细', true),
  supplier_id: reference('forge_supplier', '供应商', true), warehouse_id: reference('forge_warehouse', '到货仓库', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  batch_number: text('批次号'), inspection_method: select('检验方式', [['full', '全检'], ['sampling', '抽检']], 'full'),
  total_quantity: positiveQuantity('总数量'), accepted_quantity: nonNegativeQuantity('合格数量', true),
  rejected_quantity: nonNegativeQuantity('不合格数量', true), inspected_on: Field.date({ label: '检验日期' }),
  result: { ...select('检验结果', [['pending', '待判定'], ['passed', '合格'], ['partial', '部分合格'], ['rejected', '不合格']], 'pending'), readonly: true },
  status: { ...select('检验状态', [['pending', '待检验'], ['completed', '已完成']], 'pending'), readonly: true },
  inspector_id: owner(true), inspection_note: Field.textarea({ label: '检验结论', readonly: true }), remarks: remarks(),
}, ['code', 'receipt_id', 'supplier_id', 'total_quantity', 'accepted_quantity', 'rejected_quantity', 'result', 'status', 'inspector_id']);

export const PurchaseInbound = master('forge_purchase_inbound', '采购入库单', 'package-plus', {
  name: text('入库单名称', true), code: code('入库单号'), inbound_type: select('入库类型', [['purchase', '采购入库']], 'purchase'),
  source_type: select('来源类型', [['purchase_order', '采购订单']], 'purchase_order'), order_id: reference('forge_purchase_order', '采购订单', true),
  receipt_id: reference('forge_purchase_receipt', '到货登记'), supplier_id: reference('forge_supplier', '供应商', true), warehouse_id: reference('forge_warehouse', '默认入库仓库'),
  inbound_on: Field.date({ label: '入库日期', ...required }), line_count: Field.number({ label: '物料行数', min: 0, scale: 0, readonly: true }),
  total_quantity: nonNegativeQuantity('入库总数量', true), untaxed_amount: nonNegativeMoney('不含税金额'), taxed_amount: nonNegativeMoney('含税金额'),
  status: { ...select('入库状态', [['draft', '草稿'], ['pending_approval', '待审批'], ['approved', '已审批'], ['stocked', '已入库'], ['cancelled', '已取消']], 'draft'), readonly: true },
  submitted_at: Field.datetime({ label: '提交时间', readonly: true }), submitted_by: Field.user({ label: '提交人', readonly: true }),
  approved_at: Field.datetime({ label: '审批时间', readonly: true }), approved_by: Field.user({ label: '审批人', readonly: true }),
  stocked_at: Field.datetime({ label: '入库时间', readonly: true }), stocked_by: Field.user({ label: '入库人', readonly: true }),
  approval_note: Field.textarea({ label: '审批意见', readonly: true }), responsible_id: owner(true), remarks: remarks(),
}, ['code', 'inbound_type', 'source_type', 'inbound_on', 'supplier_id', 'order_id', 'receipt_id', 'warehouse_id', 'line_count', 'total_quantity', 'taxed_amount', 'status']);

export const PurchaseInboundLine = master('forge_purchase_inbound_line', '采购入库明细', 'list', {
  name: text('物料名称', true), inbound_id: reference('forge_purchase_inbound', '采购入库单', true),
  inspection_id: reference('forge_purchase_inspection', '采购检验单', true), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  receipt_line_id: reference('forge_purchase_receipt_line', '到货登记明细', true), order_id: reference('forge_purchase_order', '采购订单', true),
  order_line_id: reference('forge_purchase_order_line', '采购订单明细', true), supplier_id: reference('forge_supplier', '供应商', true),
  warehouse_id: reference('forge_warehouse', '入库仓库', true), warehouse_location: text('库位'), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'), batch_number: text('批次号'), external_sn: text('外部 SN'),
  quantity: positiveQuantity('入库数量'), taxed_unit_price: nonNegativeMoney('含税单价'), untaxed_unit_price: nonNegativeMoney('不含税单价'),
  tax_rate: percentage('税率'), untaxed_amount: nonNegativeMoney('不含税金额'), taxed_amount: nonNegativeMoney('含税金额'),
  before_on_hand: { ...nonNegativeQuantity('入库前库存'), readonly: true }, after_on_hand: { ...nonNegativeQuantity('入库后库存'), readonly: true },
  status: { ...select('明细状态', [['draft', '草稿'], ['pending_approval', '待审批'], ['approved', '已审批'], ['stocked', '已入库'], ['cancelled', '已取消']], 'draft'), readonly: true },
  remarks: remarks(),
}, ['inbound_id', 'item_code', 'name', 'model', 'unit_name', 'quantity', 'taxed_unit_price', 'taxed_amount', 'warehouse_id', 'batch_number', 'status']);

export const PurchaseInboundApprovalLog = master('forge_purchase_inbound_approval_log', '采购入库审批记录', 'history', {
  name: text('记录名称', true), inbound_id: reference('forge_purchase_inbound', '采购入库单', true),
  action: select('动作', [['submitted', '提交审批'], ['approved', '审批通过'], ['stocked', '执行入库']]), from_status: text('原状态'), to_status: text('新状态'),
  comment: Field.textarea({ label: '意见' }), occurred_at: Field.datetime({ label: '操作时间', ...required, readonly: true }), operator_id: Field.user({ label: '操作人', ...required, readonly: true }),
}, ['inbound_id', 'action', 'from_status', 'to_status', 'comment', 'operator_id', 'occurred_at']);
