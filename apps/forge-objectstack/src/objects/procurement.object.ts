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
  order_id: reference('forge_purchase_order', '采购订单', true), order_line_id: reference('forge_purchase_order_line', '采购订单明细', true),
  supplier_id: reference('forge_supplier', '供应商', true), warehouse_id: reference('forge_warehouse', '到货仓库', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), arrived_on: Field.date({ label: '到货日期', ...required }),
  quantity: positiveQuantity('到货数量'), batch_number: text('批次号'), taxed_unit_price: nonNegativeMoney('含税单价'),
  taxed_amount: nonNegativeMoney('含税金额'), status: { ...select('到货登记状态', [
    ['pending_inspection', '待检验'], ['inspected', '已检验'], ['stocked', '已入库'], ['cancelled', '已取消'],
  ], 'pending_inspection'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'arrived_on', 'supplier_id', 'order_id', 'warehouse_id', 'item_code', 'quantity', 'taxed_amount', 'status']);

export const PurchaseInspection = master('forge_purchase_inspection', '采购检验单', 'clipboard-check', {
  name: text('检验单名称', true), code: code('检验单号'), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  order_id: reference('forge_purchase_order', '采购订单', true), order_line_id: reference('forge_purchase_order_line', '采购订单明细', true),
  supplier_id: reference('forge_supplier', '供应商', true), warehouse_id: reference('forge_warehouse', '到货仓库', true),
  sku_id: reference('forge_material_sku', '物料规格', true), inspection_method: select('检验方式', [['full', '全检']], 'full'),
  total_quantity: positiveQuantity('总数量'), accepted_quantity: nonNegativeQuantity('合格数量', true),
  rejected_quantity: nonNegativeQuantity('不合格数量', true), inspected_on: Field.date({ label: '检验日期' }),
  result: { ...select('检验结果', [['pending', '待判定'], ['passed', '合格'], ['partial', '部分合格'], ['rejected', '不合格']], 'pending'), readonly: true },
  status: { ...select('检验状态', [['pending', '待检验'], ['completed', '已完成']], 'pending'), readonly: true },
  inspector_id: owner(true), inspection_note: Field.textarea({ label: '检验结论', readonly: true }), remarks: remarks(),
}, ['code', 'receipt_id', 'supplier_id', 'total_quantity', 'accepted_quantity', 'rejected_quantity', 'result', 'status', 'inspector_id']);

export const PurchaseInbound = master('forge_purchase_inbound', '采购入库单', 'package-plus', {
  name: text('入库单名称', true), code: code('采购入库单号'), receipt_id: reference('forge_purchase_receipt', '到货登记', true),
  inspection_id: reference('forge_purchase_inspection', '采购检验单', true), order_id: reference('forge_purchase_order', '采购订单', true),
  order_line_id: reference('forge_purchase_order_line', '采购订单明细', true), supplier_id: reference('forge_supplier', '供应商', true),
  warehouse_id: reference('forge_warehouse', '入库仓库', true), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编码'), batch_number: text('批次号'), inbound_on: Field.date({ label: '入库日期', ...required }),
  quantity: positiveQuantity('入库数量'), unit_cost: { ...nonNegativeMoney('含税单位成本'), readonly: true },
  inventory_amount: { ...nonNegativeMoney('库存含税金额'), readonly: true },
  before_on_hand: { ...nonNegativeQuantity('入库前库存'), readonly: true }, after_on_hand: { ...nonNegativeQuantity('入库后库存'), readonly: true },
  status: { ...select('入库状态', [['stocked', '已入库'], ['cancelled', '已取消']], 'stocked'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'inbound_on', 'supplier_id', 'order_id', 'warehouse_id', 'item_code', 'quantity', 'unit_cost', 'inventory_amount', 'before_on_hand', 'after_on_hand', 'status']);
