import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const amount = (label: string) => Field.currency({ label, precision: 18, scale: 4, min: 0 });
const signedAmount = (label: string) => Field.currency({ label, precision: 18, scale: 4 });
const quantity = (label: string) => Field.number({ label, min: 0.0001, scale: 4, ...required });
const invoiceStatus = () => Field.select([
  { value: 'issued', label: '已开票' }, { value: 'settled', label: '已结清' }, { value: 'voided', label: '已作废' },
], { label: '发票状态', defaultValue: 'issued' });
const receivableStatus = () => Field.select([
  { value: 'unpaid', label: '未收款' }, { value: 'partially_collected', label: '部分收款' },
  { value: 'settled', label: '已结清' }, { value: 'overdue', label: '已逾期' },
], { label: '应收状态', defaultValue: 'unpaid' });
const paymentMethod = () => Field.select([
  { value: 'bank_transfer', label: '银行转账' }, { value: 'alipay', label: '支付宝' },
  { value: 'wechat_pay', label: '微信支付' }, { value: 'cash', label: '现金' },
  { value: 'cheque', label: '支票' }, { value: 'other', label: '其他' },
], { label: '收款方式', defaultValue: 'bank_transfer' });

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

// RM-131 to RM-135 separate the physical fund account and receipt flow from receivable write-off.
// Successful same-input RISEMAP receipt allocation is still pending, so approval is explicit and auditable here.
export const FundAccount = master('forge_fund_account', '资金账户', 'landmark', {
  name: text('账户名称', true), code: code('账户编码'), account_type: Field.select([
    { value: 'bank', label: '银行账户' }, { value: 'wechat', label: '微信' },
    { value: 'alipay', label: '支付宝' }, { value: 'cash', label: '现金账户' },
    { value: 'other', label: '其他' },
  ], { label: '账户类型', ...required }),
  bank_name: text('开户银行'), branch_name: text('开户支行'), account_number: text('账户号码'),
  bank_account_type: Field.select([{ value: 'basic', label: '基本户' }, { value: 'general', label: '一般户' }, { value: 'special', label: '专用户' }], { label: '银行账户类型', defaultValue: 'general' }),
  currency: Field.select([{ value: 'cny', label: '人民币 (CNY)' }], { label: '币种', defaultValue: 'cny', ...required }),
  opening_balance: amount('期初余额'), current_balance: { ...amount('当前余额'), readonly: true },
  opening_on: Field.date({ label: '期初日期', ...required }), allow_print: Field.boolean({ label: '允许打印', defaultValue: false }),
  account_manager: text('客户经理'), manager_phone: text('联系电话'), visibility_scope: Field.select([
    { value: 'creator_admin', label: '仅创建人+管理员可见' }, { value: 'organization', label: '全组织可见' },
  ], { label: '可见范围', defaultValue: 'creator_admin' }),
  status: Field.select([{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }], { label: '账户状态', defaultValue: 'active' }),
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'name', 'account_type', 'bank_name', 'account_number', 'currency', 'opening_balance', 'current_balance', 'status']);

export const CashReceipt = master('forge_cash_receipt', '收款流水', 'badge-dollar-sign', {
  name: text('收款流水名称', true), code: code('流水号'), customer_id: reference('forge_customer', '客户', true),
  account_id: reference('forge_fund_account', '收款账户', true), received_on: Field.date({ label: '收款日期', ...required }),
  payment_method: paymentMethod(), amount: amount('收款金额'), allocated_amount: { ...amount('已分配金额'), readonly: true },
  unallocated_amount: { ...amount('未分配金额'), readonly: true },
  status: { ...Field.select([
    { value: 'unallocated', label: '待分配' }, { value: 'partially_allocated', label: '部分分配' },
    { value: 'pending_review', label: '待审核' }, { value: 'allocated', label: '已分配' },
  ], { label: '分配状态', defaultValue: 'unallocated' }), readonly: true },
  counterpart_reference: text('对方流水号'), responsible_id: owner(true), remarks: remarks(),
}, ['code', 'customer_id', 'received_on', 'payment_method', 'account_id', 'amount', 'allocated_amount', 'unallocated_amount', 'status']);

export const CollectionAllocation = master('forge_collection_allocation', '收款核销', 'badge-check', {
  name: text('核销名称', true), code: code('核销编号'), receipt_id: reference('forge_cash_receipt', '收款流水', true),
  receivable_id: reference('forge_accounts_receivable', '应收账款', true), invoice_id: reference('forge_sales_invoice', '销项发票', true),
  order_id: reference('forge_sales_order', '销售订单', true), contract_id: reference('forge_sales_contract', '销售合同'),
  customer_id: reference('forge_customer', '客户', true), allocated_on: Field.date({ label: '分配日期', ...required }),
  amount: amount('核销金额'), status: { ...Field.select([
    { value: 'pending_review', label: '待审核' }, { value: 'approved', label: '已审核' },
    { value: 'cancelled', label: '已取消' },
  ], { label: '核销状态', defaultValue: 'pending_review' }), readonly: true },
  approved_at: { ...Field.datetime({ label: '审核时间' }), readonly: true }, responsible_id: owner(true), remarks: remarks(),
}, ['code', 'receipt_id', 'receivable_id', 'customer_id', 'order_id', 'allocated_on', 'amount', 'status', 'responsible_id']);

export const ProjectSettlement = master('forge_project_settlement', '项目结算', 'chart-no-axes-combined', {
  name: text('结算名称', true), code: code('结算编号'), project_id: reference('forge_project', '项目', true),
  settled_on: Field.date({ label: '结算日期', ...required }), contract_amount: { ...amount('合同金额'), readonly: true },
  invoiced_amount: { ...amount('已开票'), readonly: true }, collected_amount: { ...amount('已回款'), readonly: true },
  production_cost: { ...amount('生产材料成本'), readonly: true }, labor_cost: { ...amount('人工成本'), readonly: true },
  manufacturing_cost: { ...amount('制造费用'), readonly: true }, travel_cost: { ...amount('差旅费用'), readonly: true },
  subcontract_cost: { ...amount('委外成本'), readonly: true }, other_cost: { ...amount('其他项目成本'), readonly: true },
  total_cost: { ...amount('项目总成本'), readonly: true }, gross_margin: { ...signedAmount('项目毛利'), readonly: true },
  gross_margin_rate: Field.number({ label: '毛利率 (%)', scale: 4, readonly: true }),
  status: { ...Field.select([{ value: 'settled', label: '已结算' }], { label: '结算状态', defaultValue: 'settled' }), readonly: true },
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'project_id', 'settled_on', 'contract_amount', 'invoiced_amount', 'collected_amount', 'production_cost', 'labor_cost', 'manufacturing_cost', 'travel_cost', 'subcontract_cost', 'other_cost', 'total_cost', 'gross_margin', 'gross_margin_rate', 'status']);

// RM-142 reimbursement drafts contain a project cost owner and one or more dated expense lines.
export const ProjectExpense = master('forge_project_expense', '项目费用报销', 'hand-coins', {
  name: text('费用标题', true), code: code('报销单号'), project_id: reference('forge_project', '关联项目', true),
  customer_id: reference('forge_customer', '客户', true), ownership_type: Field.select([
    { value: 'project', label: '项目成本' },
  ], { label: '成本归属', defaultValue: 'project', ...required }),
  claim_type: Field.select([
    { value: 'self', label: '本人报销' }, { value: 'on_behalf', label: '代人报销' },
  ], { label: '报销类型', defaultValue: 'self', ...required }),
  applicant_id: Field.user({ label: '申请人', ...required }), beneficiary_id: Field.user({ label: '报销人', ...required }),
  supplier_id: reference('forge_supplier', '供应商'), expected_payment_on: Field.date({ label: '期望付款日期' }),
  total_amount: { ...amount('单据金额'), readonly: true }, line_count: Field.number({ label: '费用项数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  status: { ...Field.select([
    { value: 'draft', label: '待提交' }, { value: 'pending_review', label: '待审核' },
    { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' },
    { value: 'paid', label: '已打款' }, { value: 'voided', label: '已作废' },
  ], { label: '报销状态', defaultValue: 'draft' }), readonly: true },
  submitted_at: Field.datetime({ label: '提交时间', readonly: true }), reviewed_at: Field.datetime({ label: '审核时间', readonly: true }),
  reviewer_id: Field.user({ label: '审核人', readonly: true }), review_comment: Field.textarea({ label: '审核意见', readonly: true }),
  cost_entry_count: Field.number({ label: '成本记录数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  responsible_id: owner(true), remarks: remarks(),
}, ['code', 'name', 'ownership_type', 'claim_type', 'applicant_id', 'beneficiary_id', 'project_id', 'supplier_id', 'total_amount', 'line_count', 'status']);

export const ProjectExpenseLine = master('forge_project_expense_line', '项目费用明细', 'list', {
  name: text('费用名称', true), line_key: code('费用明细编号'), expense_id: reference('forge_project_expense', '报销单', true),
  category: Field.select([
    { value: 'manufacturing', label: '制造费用' }, { value: 'travel', label: '差旅费用' },
    { value: 'subcontract', label: '外协与委外' }, { value: 'inspection', label: '检测认证' },
    { value: 'software', label: '软件与云服务' }, { value: 'office', label: '行政办公' }, { value: 'other', label: '其他费用' },
  ], { label: '费用类别', ...required }),
  cost_type: Field.select([
    { value: 'manufacturing', label: '制造费用' }, { value: 'travel', label: '差旅费用' },
    { value: 'subcontract', label: '委外成本' }, { value: 'other', label: '其他成本' },
  ], { label: '成本类型', ...required }),
  occurred_on: Field.date({ label: '发生日期', ...required }), amount: amount('金额'),
  description: Field.textarea({ label: '费用说明', ...required }), invoice_reference: text('票据编号'),
  attachment: Field.file({ label: '票据附件' }), remarks: remarks(),
}, ['expense_id', 'line_key', 'category', 'cost_type', 'name', 'occurred_on', 'amount', 'description', 'invoice_reference']);

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
