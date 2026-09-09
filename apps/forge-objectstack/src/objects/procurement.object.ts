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
  warehouse_id: reference('forge_warehouse', '目标仓库', true), expected_arrival_on: Field.date({ label: '期望到货日期', ...required }),
  payment_term: text('付款条件', true), payment_method: select('付款方式', [
    ['bank_transfer', '银行转账'], ['wire_transfer', '电汇'], ['bank_acceptance', '承兑汇票'],
    ['online_payment', '在线支付'], ['cash', '现金'], ['other', '其他'],
  ], 'bank_transfer'),
  currency: select('币种', [['cny', '人民币'], ['usd', '美元'], ['eur', '欧元']], 'cny'),
  exchange_rate: Field.number({ label: '汇率', min: 0.000001, scale: 6, defaultValue: 1 }),
  payable_trigger: select('应付产生方式', [['inbound', '按入库'], ['invoice', '按发票']], 'inbound'),
  responsible_id: owner(true), line_count: Field.number({ label: '物料数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  total_quantity: nonNegativeQuantity('采购总数量', true), total_amount: nonNegativeMoney('含税总额'),
  arrived_quantity: nonNegativeQuantity('已到货数量', true), inbound_quantity: nonNegativeQuantity('已入库数量', true),
  status: { ...select('订单状态', [
    ['draft', '草稿'], ['pending_approval', '待审批'], ['approved', '已审批'], ['partially_arrived', '部分到货'],
    ['completed', '已完成'], ['rejected', '已驳回'], ['cancelled', '已取消'],
  ], 'draft'), readonly: true },
  remarks: remarks(),
}, ['code', 'name', 'supplier_id', 'expected_arrival_on', 'warehouse_id', 'total_amount', 'arrived_quantity', 'inbound_quantity', 'status', 'responsible_id']);

export const PurchaseOrderLine = master('forge_purchase_order_line', '采购订单明细', 'list', {
  name: text('物料名称', true), order_id: reference('forge_purchase_order', '采购订单', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), quantity: positiveQuantity(),
  arrived_quantity: nonNegativeQuantity('已到货数量', true), inspected_quantity: nonNegativeQuantity('已检验数量', true),
  accepted_quantity: nonNegativeQuantity('合格数量', true), inbound_quantity: nonNegativeQuantity('已入库数量', true),
  taxed_unit_price: nonNegativeMoney('含税单价'), untaxed_unit_price: nonNegativeMoney('不含税单价'),
  tax_rate: percentage('税率'), taxed_subtotal: nonNegativeMoney('含税小计'),
  expected_arrival_on: Field.date({ label: '期望到货日期' }), remarks: remarks(),
}, ['order_id', 'item_code', 'name', 'model', 'quantity', 'arrived_quantity', 'inspected_quantity', 'inbound_quantity', 'taxed_unit_price', 'taxed_subtotal']);

// RM-005 / DR-0062. Approval produces one pending-arrival notice per order line; it does not record physical receipt.
export const PurchaseArrivalNotice = master('forge_purchase_arrival_notice', '采购到货通知', 'package-search', {
  name: text('到货通知名称', true), code: code('到货通知号'), order_id: reference('forge_purchase_order', '采购订单', true),
  order_line_id: reference('forge_purchase_order_line', '采购订单明细', true), supplier_id: reference('forge_supplier', '供应商', true),
  warehouse_id: reference('forge_warehouse', '目标仓库', true), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编码'), expected_arrival_on: Field.date({ label: '预计到货日期', ...required }),
  planned_quantity: positiveQuantity('待到货数量'), arrived_quantity: nonNegativeQuantity('已到货数量', true),
  status: { ...select('到货状态', [
    ['pending_arrival', '待到货'], ['partially_arrived', '部分到货'], ['arrived', '已到货'], ['cancelled', '已取消'],
  ], 'pending_arrival'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'order_id', 'supplier_id', 'item_code', 'warehouse_id', 'expected_arrival_on', 'planned_quantity', 'arrived_quantity', 'status']);
