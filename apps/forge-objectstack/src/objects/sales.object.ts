import { Field } from '@objectstack/spec/data';
import { master, dictionary, text, code, reference, choice, owner, remarks, required, money } from '../model.js';

const positiveQuantity = (label = '数量') => Field.number({ label, min: 0.0001, scale: 4, ...required });
const percentage = (label: string, defaultValue = 0) => Field.number({ label, min: 0, max: 100, scale: 4, defaultValue });
const nonNegativeMoney = (label: string, scale = 4) => Field.currency({ label, precision: 18, scale, min: 0 });
const paymentMethod = () => choice('付款方式', ['银行转账', '支付宝', '微信支付', '现金', '支票', '其他', '电汇', '承兑汇票', '在线支付', '信用证'], '银行转账');
const revenueTrigger = () => choice('收入确认方式', ['按发货出库', '按开票', '按里程碑', '按周期', '手动确认'], '按发货出库');

// Runtime-observed prerequisites: RM-059 / DR-0291 to DR-0294.
export const QuotationType = dictionary('forge_quotation_type', '报价类型');

export const QuotationIssuer = master('forge_quotation_issuer', '报价主体', 'landmark', {
  name: text('公司全称', true), credit_code: code('统一社会信用代码'), short_name: text('公司简称'),
  address: text('公司地址'), phone: text('联系电话'), email: Field.email({ label: '邮箱' }), remarks: remarks(),
}, ['name', 'short_name', 'credit_code', 'phone', 'email']);

export const ContractType = dictionary('forge_contract_type', '合同类型');

// RM-059 / DR-0279 to DR-0311. The header and lines stay separate so pricing snapshots remain auditable.
export const Quotation = master('forge_quotation', '销售报价', 'file-text', {
  name: text('报价名称', true), code: code('报价单号'), customer_id: reference('forge_customer', '客户', true),
  contact_id: reference('forge_contact', '联系人'), opportunity_name: text('关联商机'),
  quotation_type_id: reference('forge_quotation_type', '报价类型', true), issuer_id: reference('forge_quotation_issuer', '报价主体', true),
  quotation_date: Field.date({ label: '报价日期', ...required }), valid_until: Field.date({ label: '有效期至', ...required }),
  payment_method: paymentMethod(), payment_term: text('付款条件'), responsible_id: owner(true),
  status: { ...choice('报价状态', ['草稿', '待审批', '已审批', '已驳回', '已发送', '已接受'], '草稿'), readonly: true },
  item_count: Field.number({ label: '物料/服务数', min: 0, scale: 0, defaultValue: 0 }),
  subtotal: nonNegativeMoney('折前含税金额'), discount_amount: nonNegativeMoney('折扣金额'),
  tax_amount: nonNegativeMoney('税额'), total_amount: nonNegativeMoney('报价含税总额'), cost_total: nonNegativeMoney('总成本'),
  business_terms: Field.textarea({ label: '商务条款' }), quotation_terms: Field.textarea({ label: '报价条款' }),
  attachment_note: text('附件说明'), remarks: remarks(),
}, ['code', 'name', 'customer_id', 'responsible_id', 'item_count', 'total_amount', 'status', 'valid_until']);

export const QuotationLine = master('forge_quotation_line', '报价明细', 'list', {
  name: text('物料/服务名称', true), quotation_id: reference('forge_quotation', '报价单', true),
  line_type: choice('明细类型', ['物料', '服务项目'], '物料'), group_name: text('分组'), sku_id: reference('forge_material_sku', '物料规格'),
  item_code: text('编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  quantity: positiveQuantity(), taxed_unit_price: nonNegativeMoney('含税单价'), untaxed_unit_price: nonNegativeMoney('不含税单价'),
  tax_rate: percentage('税率', 13), discount_rate: percentage('折扣率', 0), taxed_subtotal: nonNegativeMoney('折后含税小计'),
  cost_price: nonNegativeMoney('成本单价'), sort_order: Field.number({ label: '排序', min: 0, scale: 0, defaultValue: 0 }), remarks: remarks(),
}, ['quotation_id', 'group_name', 'name', 'model', 'quantity', 'taxed_unit_price', 'tax_rate', 'discount_rate', 'taxed_subtotal']);

// RM-046 / DR-0165 to DR-0177. A contract constrains orders and never represents shipment execution itself.
export const SalesContract = master('forge_sales_contract', '框架销售合同', 'scroll-text', {
  name: text('合同名称', true), code: code('合同编号'), customer_po_number: text('客户单号'),
  contract_type_id: reference('forge_contract_type', '合同类型', true), customer_id: reference('forge_customer', '客户', true),
  contact_id: reference('forge_contact', '联系人'), quotation_id: reference('forge_quotation', '来源报价单'), project_name: text('关联项目'),
  signed_on: Field.date({ label: '签订日期' }), starts_on: Field.date({ label: '生效日期' }), ends_on: Field.date({ label: '到期日期' }),
  responsible_id: owner(true), total_amount: nonNegativeMoney('合同含税总额'),
  has_order_amount_limit: Field.boolean({ label: '限制累计下单金额', defaultValue: false }), order_amount_limit: nonNegativeMoney('累计下单金额上限'),
  allow_affiliate_orders: Field.boolean({ label: '允许关联公司下单', defaultValue: false }),
  outside_item_requires_approval: Field.boolean({ label: '协议外物料需审批', defaultValue: true }),
  all_orders_require_approval: Field.boolean({ label: '额度内订单仍需审批', defaultValue: false }),
  revenue_trigger: revenueTrigger(), ordered_count: Field.number({ label: '下单笔数', min: 0, scale: 0, defaultValue: 0 }),
  ordered_amount: nonNegativeMoney('已下单金额'), invoiced_amount: nonNegativeMoney('已开票金额'),
  shipped_amount: nonNegativeMoney('已发货金额'), collected_amount: nonNegativeMoney('已回款金额'),
  status: { ...choice('合同状态', ['草稿', '待审批', '已审批', '已签订', '执行中', '已暂停', '已终止', '已到期', '已完成'], '草稿'), readonly: true },
  business_terms: Field.textarea({ label: '合同条款' }), attachment_note: text('附件说明'), remarks: remarks(),
}, ['code', 'customer_po_number', 'name', 'contract_type_id', 'customer_id', 'total_amount', 'ordered_amount', 'status', 'signed_on', 'responsible_id']);

export const SalesContractLine = master('forge_sales_contract_line', '合同物料明细', 'list', {
  name: text('物料名称', true), contract_id: reference('forge_sales_contract', '销售合同', true),
  quotation_line_id: reference('forge_quotation_line', '来源报价明细'), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  quantity_limit: positiveQuantity('数量上限'), ordered_quantity: Field.number({ label: '已下单数量', min: 0, scale: 4, defaultValue: 0 }),
  taxed_unit_price: nonNegativeMoney('协议含税单价'), tax_rate: percentage('税率', 13), discount_rate: percentage('折扣率', 0),
  taxed_subtotal: nonNegativeMoney('含税小计'), remarks: remarks(),
}, ['contract_id', 'item_code', 'name', 'model', 'quantity_limit', 'ordered_quantity', 'taxed_unit_price', 'taxed_subtotal']);

// RM-047 / DR-0178 to DR-0183. Direct and contract-backed orders converge on this execution document.
export const SalesOrder = master('forge_sales_order', '销售订单', 'clipboard-list', {
  name: text('订单名称', true), code: code('订单编号'), customer_po_number: text('客户单号'),
  source_type: choice('订单来源', ['直接新建', '关联合同'], '直接新建'), customer_id: reference('forge_customer', '客户', true),
  contact_id: reference('forge_contact', '联系人'), contract_id: reference('forge_sales_contract', '关联合同'),
  quotation_id: reference('forge_quotation', '来源报价单'), project_name: text('所属项目'),
  planned_delivery_on: Field.date({ label: '计划交货日期', ...required }), responsible_id: owner(true),
  use_credit: Field.boolean({ label: '使用授信额度', defaultValue: false }), payment_term: text('付款条件', true), payment_method: paymentMethod(),
  revenue_trigger: revenueTrigger(), total_amount: nonNegativeMoney('订单含税金额'),
  invoiced_amount: nonNegativeMoney('已开票金额'), shipped_amount: nonNegativeMoney('已发货金额'), collected_amount: nonNegativeMoney('已回款金额'),
  shipment_count: Field.number({ label: '发货单数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  planned_shipment_amount: nonNegativeMoney('已建发货单金额'),
  status: { ...choice('订单状态', ['草稿', '待审批', '已审批', '执行中', '部分发货', '已发货', '已完成', '已取消'], '草稿'), readonly: true },
  delivery_address: text('收货地址'), delivery_contact: text('收货人'), delivery_phone: text('联系电话'),
  attachment_note: text('附件说明'), remarks: remarks(),
}, ['code', 'customer_po_number', 'name', 'contract_id', 'customer_id', 'total_amount', 'status', 'planned_delivery_on', 'responsible_id']);

export const SalesOrderLine = master('forge_sales_order_line', '销售订单明细', 'list', {
  name: text('物料/服务名称', true), order_id: reference('forge_sales_order', '销售订单', true),
  contract_line_id: reference('forge_sales_contract_line', '来源合同明细'), quotation_line_id: reference('forge_quotation_line', '来源报价明细'),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'), specification: text('规格'), unit_name: text('单位'),
  quantity: positiveQuantity(), shipped_quantity: Field.number({ label: '已发货数量', min: 0, scale: 4, defaultValue: 0 }),
  invoiced_quantity: Field.number({ label: '已开票数量', min: 0, scale: 4, defaultValue: 0 }),
  taxed_unit_price: nonNegativeMoney('含税单价'), untaxed_unit_price: nonNegativeMoney('不含税单价'),
  tax_rate: percentage('税率', 13), discount_rate: percentage('折扣率', 0), taxed_subtotal: nonNegativeMoney('含税小计'),
  planned_delivery_on: Field.date({ label: '计划交货日期' }), remarks: remarks(),
}, ['order_id', 'item_code', 'name', 'model', 'quantity', 'shipped_quantity', 'taxed_unit_price', 'taxed_subtotal', 'planned_delivery_on']);

// RM-060 / DR-1642 onward. A shipment is a customer delivery plan. It reserves order quantity but does not move inventory or mark it shipped.
export const SalesShipment = master('forge_sales_shipment', '销售发货单', 'package-check', {
  name: text('发货单名称', true), code: code('发货单号'), customer_id: reference('forge_customer', '客户', true),
  contact_id: reference('forge_contact', '联系人'), shipment_on: Field.date({ label: '发货日期', ...required }),
  recipient: text('收货人', true), recipient_phone: text('联系电话'), delivery_address: text('收货地址', true),
  total_amount: nonNegativeMoney('发货含税金额'), total_quantity: positiveQuantity('发货数量'),
  outbound_quantity: Field.number({ label: '已出库数量', min: 0, scale: 4, defaultValue: 0, readonly: true }),
  outbound_count: Field.number({ label: '出库单数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  status: { ...choice('发货单状态', ['待发货', '部分出库', '已出库', '已取消'], '待发货'), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'name', 'customer_id', 'shipment_on', 'total_quantity', 'outbound_quantity', 'total_amount', 'status']);

export const SalesShipmentLine = master('forge_sales_shipment_line', '发货物料明细', 'list', {
  name: text('物料名称', true), shipment_id: reference('forge_sales_shipment', '销售发货单', true),
  order_id: reference('forge_sales_order', '销售订单', true), order_line_id: reference('forge_sales_order_line', '订单明细', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), quantity: positiveQuantity(),
  outbound_quantity: Field.number({ label: '已出库数量', min: 0, scale: 4, defaultValue: 0, readonly: true }),
  taxed_unit_price: nonNegativeMoney('含税单价'), taxed_subtotal: nonNegativeMoney('含税小计'), remarks: remarks(),
}, ['shipment_id', 'order_id', 'item_code', 'name', 'model', 'quantity', 'outbound_quantity', 'taxed_unit_price', 'taxed_subtotal']);

// RM-043 / DR-1645 onward. Outbound execution consumes the shipment plan and records the stock check.
export const SalesOutbound = master('forge_sales_outbound', '销售出库单', 'truck', {
  name: text('出库单名称', true), code: code('出库单号'), shipment_id: reference('forge_sales_shipment', '发货单', true),
  order_id: reference('forge_sales_order', '销售订单', true), warehouse_id: reference('forge_warehouse', '出库仓库', true),
  sku_id: reference('forge_material_sku', '物料规格', true),
  outbound_on: Field.date({ label: '出库日期', ...required }), quantity: positiveQuantity('出库数量'),
  customer_pickup: Field.boolean({ label: '客户自取', defaultValue: false }), recipient: text('收货人'),
  recipient_phone: text('联系电话'), delivery_address: text('收货地址'), available_quantity: Field.number({ label: '校验时可用库存', min: 0, scale: 4, readonly: true }),
  before_on_hand: Field.number({ label: '出库前库存', min: 0, scale: 4, readonly: true }),
  after_on_hand: Field.number({ label: '出库后库存', min: 0, scale: 4, readonly: true }),
  unit_cost: { ...nonNegativeMoney('含税单位成本'), readonly: true },
  inventory_amount: { ...nonNegativeMoney('库存含税金额'), readonly: true },
  status: { ...choice('出库单状态', ['草稿', '已出库', '已取消'], '已出库'), readonly: true }, responsible_id: owner(true), remarks: remarks(),
}, ['code', 'name', 'shipment_id', 'order_id', 'warehouse_id', 'sku_id', 'outbound_on', 'quantity', 'available_quantity', 'before_on_hand', 'after_on_hand', 'inventory_amount', 'status']);
