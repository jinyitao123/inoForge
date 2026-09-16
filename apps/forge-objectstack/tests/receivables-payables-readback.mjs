import assert from 'node:assert/strict';
import { connect } from '../scripts/api-client.mjs';

const endpoint = process.env.FORGE_URL || 'http://localhost:4441';
const api = await connect(endpoint);
const find = async (object, where) => {
  const query = new URLSearchParams({ $filter: JSON.stringify(where), $top: '20' });
  const response = await api.request(`/data/${object}?${query}`);
  assert.equal(response.status, 200, JSON.stringify(response.value));
  return response.value.records || [];
};
const invoke = (id, params, authenticated = true) => api.request(
  `/actions/forge_accounts_receivable/receivable_register_collection/${id}`,
  'POST',
  { params },
  authenticated,
);

const [receivable] = await find('forge_accounts_receivable', { code: 'AR-INV-BROWSER-20260916-001' });
const [reversed] = await find('forge_accounts_receivable', { code: 'AR-INV-ISSUED-1789545797758' });
const [receipt] = await find('forge_cash_receipt', { code: 'RCV-PAGE-20260916-001' });
const [account] = await find('forge_fund_account', { code: 'FA-AR-PAGE-20260916' });
const [order] = await find('forge_sales_order', { id: receivable?.order_id });
assert.ok(receivable && reversed && receipt && account && order, '缺少应收应付页面验收材料');

assert.deepEqual(
  {
    receivableStatus: receivable.status,
    receivableOutstanding: receivable.outstanding_amount,
    receiptCustomer: receipt.customer_id,
    receiptAccount: receipt.account_id,
    receiptAmount: receipt.amount,
    receiptAllocated: receipt.allocated_amount,
    receiptUnallocated: receipt.unallocated_amount,
    receiptStatus: receipt.status,
    accountBalance: account.current_balance,
    orderId: order.id,
    orderCode: order.code,
    reversedStatus: reversed.status,
    reversedOutstanding: reversed.outstanding_amount,
  },
  {
    receivableStatus: 'unpaid',
    receivableOutstanding: 26000,
    receiptCustomer: receivable.customer_id,
    receiptAccount: account.id,
    receiptAmount: 26000,
    receiptAllocated: 0,
    receiptUnallocated: 26000,
    receiptStatus: 'unallocated',
    accountBalance: 126000,
    orderId: receivable.order_id,
    orderCode: 'SO-INV-APPROVED-BROWSER-1789545797758',
    reversedStatus: 'red_reversed',
    reversedOutstanding: 0,
  },
);

const params = {
  code: 'RCV-INVALID-20260916',
  account_id: account.id,
  received_on: '2026-09-16',
  payment_method: 'bank_transfer',
  amount: 26001,
  counterpart_reference: '',
  remarks: '超额登记不应成功',
};
assert.equal((await invoke(receivable.id, params, false)).status, 401);
assert.equal((await invoke(receivable.id, params)).status, 400);

console.log(JSON.stringify({
  suite: 'receivables-payables-readback',
  status: 'passed',
  endpoint,
  ids: { receivable: receivable.id, receipt: receipt.id, account: account.id, order: order.id },
  accountBalance: account.current_balance,
  unallocatedAmount: receipt.unallocated_amount,
}, null, 2));
