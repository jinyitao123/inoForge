import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const amount = (label: string) => Field.currency({ label, precision: 18, scale: 4, min: 0 });
const quantity = (label: string) => Field.number({ label, min: 0.0001, scale: 4, ...required });
const invoiceStatus = () => Field.select([
  { value: 'issued', label: '已开票' }, { value: 'settled', label: '已结清' }, { value: 'voided', label: '已作废' },
], { label: '发票状态', defaultValue: 'issued' });
const receivableStatus = () => Field.select([
  { value: 'unpaid', label: '未收款' }, { value: 'partially_collected', label: '部分收款' },
  { value: 'settled', label: '已结清' }, { value: 'overdue', label: '已逾期' },
], { label: '应收状态', defaultValue: 'unpaid' });

// RM-056, RM-144 and RM-145 currently establish the sales-request / finance-ledger split.
// This first executable slice represents the issued finance-side document directly.
export const SalesInvoice = master('forge_sales_invoice', '销项发票', 'receipt-text', {
  name: text('发票名称', true), code: code('发票编号'), order_id: reference('forge_sales_order', '销售订单', true),
  contract_id: reference('forge_sales_contract', '销售合同'), customer_id: reference('forge_customer', '客户', true),
  invoice_on: Field.date({ label: '开票日期', ...required }), due_on: Field.date({ label: '应收日期', ...required }),
  total_amount: amount('价税合计'), collected_amount: { ...amount('已收金额'), readonly: true },
  outstanding_amount: { ...amount('未收金额'), readonly: true },
  status: { ...invoiceStatus(), readonly: true }, responsible_id: owner(true), remarks: remarks(),
}, ['code', 'customer_id', 'order_id', 'invoice_on', 'due_on', 'total_amount', 'outstanding_amount', 'status', 'responsible_id']);

export const SalesInvoiceLine = master('forge_sales_invoice_line', '销项发票明细', 'list', {
  name: text('物料/服务名称', true), invoice_id: reference('forge_sales_invoice', '销项发票', true),
  order_id: reference('forge_sales_order', '销售订单', true), order_line_id: reference('forge_sales_order_line', '订单明细', true),
  sku_id: reference('forge_material_sku', '物料规格', true), item_code: text('物料编码'), model: text('型号'),
  specification: text('规格'), unit_name: text('单位'), quantity: quantity('开票数量'),
  taxed_unit_price: amount('含税单价'), tax_rate: Field.number({ label: '税率', min: 0, max: 100, scale: 4, defaultValue: 13 }),
  taxed_subtotal: amount('价税小计'), remarks: remarks(),
}, ['invoice_id', 'order_id', 'item_code', 'name', 'model', 'quantity', 'taxed_unit_price', 'tax_rate', 'taxed_subtotal']);

// RM-133 lists receivables independently from invoices so cash allocation can be added later without rewriting invoice history.
export const AccountsReceivable = master('forge_accounts_receivable', '应收账款', 'wallet-cards', {
  name: text('应收名称', true), code: code('应收编号'), invoice_id: reference('forge_sales_invoice', '销项发票', true),
  order_id: reference('forge_sales_order', '销售订单', true), contract_id: reference('forge_sales_contract', '销售合同'),
  customer_id: reference('forge_customer', '客户', true), recognized_on: Field.date({ label: '确认日期', ...required }),
  due_on: Field.date({ label: '到期日期', ...required }), original_amount: amount('应收原值'),
  collected_amount: { ...amount('已核销金额'), readonly: true }, outstanding_amount: { ...amount('应收余额'), readonly: true },
  status: { ...receivableStatus(), readonly: true }, responsible_id: owner(true), remarks: remarks(),
}, ['code', 'customer_id', 'invoice_id', 'order_id', 'recognized_on', 'due_on', 'original_amount', 'outstanding_amount', 'status', 'responsible_id']);

const payableStatus = () => Field.select([
  { value: 'unpaid', label: '未付款' }, { value: 'partially_paid', label: '部分付款' },
  { value: 'settled', label: '已结清' }, { value: 'overdue', label: '已逾期' },
], { label: '应付状态', defaultValue: 'unpaid' });

// RM-017, RM-133 and RM-135 expose purchase invoices, payables and payment tasks as separate ledgers.
// The successful same-input RISEMAP flow is still absent, so this slice keeps invoice registration and payable recognition explicit.
export const PurchaseInvoice = master('forge_purchase_invoice', '进项发票', 'receipt', {
  name: text('发票名称', true), code: code('登记编号'), invoice_number: text('发票号码', true),
  inbound_id: reference('forge_purchase_inbound', '采购入库单', true), order_id: reference('forge_purchase_order', '采购订单', true),
  supplier_id: reference('forge_supplier', '供应商', true), invoice_on: Field.date({ label: '开票日期', ...required }),
  due_on: Field.date({ label: '应付日期', ...required }), total_amount: amount('价税合计'),
  tax_rate: Field.number({ label: '税率', min: 0, max: 100, scale: 4, defaultValue: 13 }),
  status: { ...Field.select([
    { value: 'normal', label: '正常' }, { value: 'voided', label: '已作废' }, { value: 'red_reversed', label: '已红冲' },
  ], { label: '发票状态', defaultValue: 'normal' }), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'invoice_number', 'invoice_on', 'supplier_id', 'order_id', 'total_amount', 'tax_rate', 'status', 'responsible_id']);

export const PurchaseInvoiceLine = master('forge_purchase_invoice_line', '进项发票明细', 'list', {
  name: text('物料名称', true), invoice_id: reference('forge_purchase_invoice', '进项发票', true),
  inbound_id: reference('forge_purchase_inbound', '采购入库单', true), order_id: reference('forge_purchase_order', '采购订单', true),
  order_line_id: reference('forge_purchase_order_line', '采购订单明细', true), sku_id: reference('forge_material_sku', '物料规格', true),
  item_code: text('物料编码'), quantity: quantity('开票数量'), taxed_unit_price: amount('含税单价'),
  tax_rate: Field.number({ label: '税率', min: 0, max: 100, scale: 4, defaultValue: 13 }), taxed_subtotal: amount('价税小计'),
  remarks: remarks(),
}, ['invoice_id', 'inbound_id', 'order_id', 'item_code', 'name', 'quantity', 'taxed_unit_price', 'tax_rate', 'taxed_subtotal']);

export const AccountsPayable = master('forge_accounts_payable', '应付账款', 'hand-coins', {
  name: text('应付名称', true), code: code('应付编号'), source_type: Field.select([
    { value: 'purchase_inbound', label: '采购入库' }, { value: 'purchase_invoice', label: '进项发票' },
  ], { label: '应付来源', ...required }),
  inbound_id: reference('forge_purchase_inbound', '采购入库单', true), invoice_id: reference('forge_purchase_invoice', '进项发票'),
  order_id: reference('forge_purchase_order', '采购订单', true), supplier_id: reference('forge_supplier', '供应商', true),
  recognized_on: Field.date({ label: '确认日期', ...required }), due_on: Field.date({ label: '到期日期' }),
  original_amount: amount('应付原值'), paid_amount: { ...amount('已付款金额'), readonly: true },
  offset_amount: { ...amount('已冲抵金额'), readonly: true }, outstanding_amount: { ...amount('应付余额'), readonly: true },
  status: { ...payableStatus(), readonly: true }, responsible_id: owner(true), remarks: remarks(),
}, ['code', 'source_type', 'supplier_id', 'inbound_id', 'invoice_id', 'order_id', 'recognized_on', 'due_on', 'original_amount', 'outstanding_amount', 'status', 'responsible_id']);
