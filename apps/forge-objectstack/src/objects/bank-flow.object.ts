import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const amount = (label: string) => Field.currency({ label, precision: 18, scale: 4, min: 0 });

export const BankTransaction = master('forge_bank_transaction', '资金流水', 'landmark', {
  name: text('流水名称', true), code: code('流水号'), account_id: reference('forge_fund_account', '资金账户', true),
  transacted_at: Field.datetime({ label: '交易时间', ...required }), direction: Field.select([
    { value: 'income', label: '收入' }, { value: 'expense', label: '支出' },
  ], { label: '收支方向', ...required }),
  flow_type: Field.select([
    { value: 'sales', label: '销售' }, { value: 'purchase', label: '采购' }, { value: 'refund', label: '退款' },
    { value: 'fee', label: '手续费' }, { value: 'transfer', label: '账户划转' }, { value: 'other', label: '其他' },
  ], { label: '流水类型', defaultValue: 'other', ...required }),
  customer_id: reference('forge_customer', '客户'), supplier_id: reference('forge_supplier', '供应商/往来单位'),
  counterparty_name: text('对方单位'), amount: amount('流水金额'),
  approved_amount: { ...amount('已审核分配'), readonly: true }, pending_amount: { ...amount('待审核分配'), readonly: true },
  unallocated_amount: { ...amount('待分配金额'), readonly: true },
  status: { ...Field.select([
    { value: 'unallocated', label: '待分配' }, { value: 'partially_allocated', label: '部分分配' },
    { value: 'pending_review', label: '待审核' }, { value: 'allocated', label: '已分配' },
    { value: 'reversed', label: '已冲销' },
  ], { label: '流水状态', defaultValue: 'unallocated' }), readonly: true },
  source: { ...Field.select([{ value: 'manual', label: '手工录入' }, { value: 'import', label: '导入' }, { value: 'business', label: '业务生成' }], { label: '流水来源', defaultValue: 'manual' }), readonly: true },
  bank_reference: text('银行参考号'), created_by: Field.user({ label: '登记人', ...required, readonly: true }),
  reversed_by: Field.user({ label: '冲销人', readonly: true }), reversed_at: Field.datetime({ label: '冲销时间', readonly: true }),
  reversal_reason: Field.textarea({ label: '冲销原因', readonly: true }), responsible_id: owner(true), remarks: remarks(),
}, ['code', 'transacted_at', 'account_id', 'counterparty_name', 'direction', 'flow_type', 'amount', 'approved_amount', 'pending_amount', 'unallocated_amount', 'status', 'source']);

export const BankTransactionMatch = master('forge_bank_transaction_match', '流水分配', 'split', {
  name: text('分配名称', true), code: code('分配编号'), transaction_id: reference('forge_bank_transaction', '资金流水', true),
  direction: Field.select([{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }], { label: '收支方向', ...required }),
  receivable_id: reference('forge_accounts_receivable', '应收账款'), payable_id: reference('forge_accounts_payable', '应付账款'),
  sales_order_id: reference('forge_sales_order', '销售订单'), purchase_order_id: reference('forge_purchase_order', '采购订单'),
  customer_id: reference('forge_customer', '客户'), supplier_id: reference('forge_supplier', '供应商/往来单位'),
  amount: amount('分配金额'), matched_on: Field.date({ label: '分配日期', ...required }),
  status: { ...Field.select([
    { value: 'pending_review', label: '待审核' }, { value: 'approved', label: '已审核' },
    { value: 'cancelled', label: '已取消' }, { value: 'reversed', label: '已反审核' },
  ], { label: '分配状态', defaultValue: 'pending_review' }), readonly: true },
  matched_by: Field.user({ label: '分配人', ...required, readonly: true }), reviewed_by: Field.user({ label: '审核人', readonly: true }),
  reviewed_at: Field.datetime({ label: '审核时间', readonly: true }), review_comment: Field.textarea({ label: '审核意见', readonly: true }),
  reversed_by: Field.user({ label: '反审核人', readonly: true }), reversed_at: Field.datetime({ label: '反审核时间', readonly: true }),
  reversal_reason: Field.textarea({ label: '取消或反审核原因', readonly: true }), responsible_id: owner(true), remarks: remarks(),
}, ['code', 'transaction_id', 'direction', 'receivable_id', 'payable_id', 'sales_order_id', 'purchase_order_id', 'customer_id', 'supplier_id', 'amount', 'matched_on', 'status', 'matched_by', 'reviewed_by']);

export const BankTransactionLog = master('forge_bank_transaction_log', '资金流水操作记录', 'history', {
  name: text('记录名称', true), event_key: code('事件键'), transaction_id: reference('forge_bank_transaction', '资金流水', true),
  match_id: reference('forge_bank_transaction_match', '流水分配'), action: Field.select([
    { value: 'registered', label: '登记流水' }, { value: 'matched', label: '分配' }, { value: 'approved', label: '审核通过' },
    { value: 'cancelled', label: '取消分配' }, { value: 'match_reversed', label: '分配反审核' }, { value: 'transaction_reversed', label: '冲销流水' },
  ], { label: '动作', ...required }),
  amount: amount('金额'), from_status: text('原状态'), to_status: text('新状态'), comment: Field.textarea({ label: '说明' }),
  occurred_at: Field.datetime({ label: '操作时间', ...required, readonly: true }), operator_id: Field.user({ label: '操作人', ...required, readonly: true }),
}, ['event_key', 'transaction_id', 'match_id', 'action', 'amount', 'from_status', 'to_status', 'comment', 'operator_id', 'occurred_at']);
