import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SalesInvoiceRequestApprove,
  SalesInvoiceRequestIssue,
  SalesInvoiceRequestReject,
} from '../src/actions/finance-workflow.action.ts';
import { ReceivableRegisterCollection } from '../src/actions/finance.action.ts';
import { CashReceipt } from '../src/objects/finance.object.ts';

const invokeBody = (action, ctx) => new Function('ctx', `return (async () => { ${action.body.source}\n})()`)(ctx);

const reviewContext = (status, reviewComment = '核对完成') => {
  const writes = [];
  return {
    writes,
    ctx: {
      recordId: 'request-1',
      record: { id: 'request-1', status },
      session: { userId: 'reviewer-1' },
      input: { review_comment: reviewComment },
      api: {
        object: name => ({
          update: async patch => writes.push({ object: name, patch }),
        }),
      },
    },
  };
};

const issueHarness = ({ status = 'approved', availableQuantity = 3, invoiceCode = 'INV-1' } = {}) => {
  const writes = [];
  const order = { id: 'order-1', code: 'SO-1', contract_id: 'contract-1', customer_id: 'customer-1', responsible_id: 'seller-1', invoiced_amount: 500 };
  const line = {
    id: 'line-1', name: '设备', sku_id: 'sku-1', item_code: 'SKU-1', model: 'M1', specification: '标准', unit_name: '台',
    quantity: 5, shipped_quantity: 5, invoiced_quantity: 5 - availableQuantity, taxed_subtotal: 2500, tax_rate: 13,
  };
  const context = {
    recordId: 'request-1',
    record: {
      id: 'request-1', code: 'IR-1', status, order_id: order.id, requested_quantity: 2, requested_amount: 1000,
      expected_invoice_on: '2026-09-18', due_on: '2026-10-18',
    },
    input: { invoice_code: invoiceCode },
    api: {
      object: name => {
        if (name === 'forge_sales_order') return {
          findOne: async () => order,
          update: async patch => writes.push({ object: name, patch }),
        };
        if (name === 'forge_sales_order_line') return {
          find: async () => [line],
          update: async patch => writes.push({ object: name, patch }),
        };
        if (name === 'forge_sales_invoice') return {
          insert: async row => { writes.push({ object: name, row }); return { id: 'invoice-1' }; },
        };
        if (name === 'forge_sales_invoice_line') return {
          insert: async row => { writes.push({ object: name, row }); return { id: 'invoice-line-1' }; },
        };
        if (name === 'forge_accounts_receivable') return {
          insert: async row => { writes.push({ object: name, row }); return { id: 'receivable-1' }; },
        };
        if (name === 'forge_sales_contract') return {
          findOne: async () => ({ id: 'contract-1', invoiced_amount: 500 }),
          update: async patch => writes.push({ object: name, patch }),
        };
        if (name === 'forge_sales_invoice_request') return {
          update: async patch => writes.push({ object: name, patch }),
        };
        throw new Error(`Unexpected object access: ${name}`);
      },
    },
  };
  return { ctx: context, writes, line };
};

const collectionHarness = (status, { amount = 500, periods = [], duplicateCode = false } = {}) => {
  const writes = [];
  const submittedCodes = new Set();
  const receivable = { id: 'receivable-1', code: 'AR-1', status, outstanding_amount: 750, customer_id: 'customer-1' };
  const account = { id: 'account-1', status: 'active', current_balance: 1000, opening_balance: 0 };
  const ctx = {
    recordId: receivable.id,
    record: receivable,
    session: { userId: 'cashier-1' },
    input: {
      code: 'RCV-1', account_id: account.id, received_on: '2026-09-30',
      payment_method: 'bank_transfer', amount, counterpart_reference: 'BANK-1', remarks: '客户回款',
    },
    api: {
      object: name => {
        if (name === 'forge_fund_account') return {
          findOne: async () => account,
          update: async patch => writes.push({ object: name, patch }),
        };
        if (name === 'forge_financial_period') return { find: async () => periods };
        if (name === 'forge_cash_receipt') return {
          insert: async row => {
            if (duplicateCode && submittedCodes.has(row.code)) throw new Error('Duplicate cash receipt code');
            submittedCodes.add(row.code);
            writes.push({ object: name, row });
            return { id: `receipt-${submittedCodes.size}` };
          },
        };
        throw new Error(`Unexpected object access: ${name}`);
      },
    },
  };
  return { ctx, writes };
};

test('invoice request actions declare the existing finance capabilities', () => {
  assert.deepEqual(SalesInvoiceRequestApprove.requiredPermissions, ['forge_finance_reviewer']);
  assert.deepEqual(SalesInvoiceRequestReject.requiredPermissions, ['forge_finance_reviewer']);
  assert.deepEqual(SalesInvoiceRequestIssue.requiredPermissions, ['forge_finance_receivables_operator']);
});

test('approve and reject bodies write their existing state and reviewer fields', async () => {
  for (const [action, status] of [[SalesInvoiceRequestApprove, 'approved'], [SalesInvoiceRequestReject, 'rejected']]) {
    const fixture = reviewContext('pending_review');
    const result = await invokeBody(action, fixture.ctx);
    assert.deepEqual(result, { id: 'request-1', status });
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.writes[0].object, 'forge_sales_invoice_request');
    assert.equal(fixture.writes[0].patch.status, status);
    assert.equal(fixture.writes[0].patch.reviewer_id, 'reviewer-1');
    assert.equal(fixture.writes[0].patch.review_comment, '核对完成');
    assert.ok(fixture.writes[0].patch.reviewed_at);
  }
});

test('review bodies refuse the wrong state or a blank comment without writing', async () => {
  for (const [action, rejectedState] of [[SalesInvoiceRequestApprove, 'rejected'], [SalesInvoiceRequestReject, 'issued']]) {
    const wrongState = reviewContext(rejectedState);
    await assert.rejects(invokeBody(action, wrongState.ctx), /仅待审批开票申请可以/);
    assert.equal(wrongState.writes.length, 0);

    const blankComment = reviewContext('pending_review', '  ');
    await assert.rejects(invokeBody(action, blankComment.ctx), /审批意见不能为空/);
    assert.equal(blankComment.writes.length, 0);
  }
});

test('issue body creates the linked invoice and receivable, then updates existing totals', async () => {
  const fixture = issueHarness();
  const result = await invokeBody(SalesInvoiceRequestIssue, fixture.ctx);
  assert.deepEqual(result, { id: 'invoice-1', request_id: 'request-1', receivable_id: 'receivable-1', status: 'issued' });
  const invoice = fixture.writes.find(entry => entry.object === 'forge_sales_invoice').row;
  const invoiceLine = fixture.writes.find(entry => entry.object === 'forge_sales_invoice_line').row;
  const receivable = fixture.writes.find(entry => entry.object === 'forge_accounts_receivable').row;
  assert.deepEqual(
    { invoice: invoice.total_amount, quantity: invoiceLine.quantity, receivable: receivable.original_amount, source: receivable.source_type },
    { invoice: 1000, quantity: 2, receivable: 1000, source: 'sales_invoice' },
  );
  assert.equal(invoiceLine.invoice_id, 'invoice-1');
  assert.equal(receivable.invoice_id, 'invoice-1');
  assert.deepEqual(fixture.writes.find(entry => entry.object === 'forge_sales_order_line').patch, { id: 'line-1', invoiced_quantity: 4 });
  assert.deepEqual(fixture.writes.find(entry => entry.object === 'forge_sales_order').patch, { id: 'order-1', invoiced_amount: 1500 });
  assert.deepEqual(fixture.writes.find(entry => entry.object === 'forge_sales_contract').patch, { id: 'contract-1', invoiced_amount: 1500 });
  assert.deepEqual(fixture.writes.find(entry => entry.object === 'forge_sales_invoice_request').patch, {
    id: 'request-1', status: 'issued', invoice_code: 'INV-1', invoice_id: 'invoice-1',
  });
});

test('issue body blocks a stale quantity or blank invoice code before creating records', async () => {
  const staleQuantity = issueHarness({ availableQuantity: 1 });
  await assert.rejects(invokeBody(SalesInvoiceRequestIssue, staleQuantity.ctx), /当前可开票数量已变化/);
  assert.equal(staleQuantity.writes.length, 0);

  const blankCode = issueHarness({ invoiceCode: ' ' });
  await assert.rejects(invokeBody(SalesInvoiceRequestIssue, blankCode.ctx), /发票编号不能为空/);
  assert.equal(blankCode.writes.length, 0);

  const wrongState = issueHarness({ status: 'pending_review' });
  await assert.rejects(invokeBody(SalesInvoiceRequestIssue, wrongState.ctx), /仅审批通过的申请可以登记开票/);
  assert.equal(wrongState.writes.length, 0);
});

test('overdue receivables remain eligible for actual receipt registration', async () => {
  assert.match(ReceivableRegisterCollection.visible.source, /record\.status == 'overdue'/);
  const fixture = collectionHarness('overdue');
  const result = await invokeBody(ReceivableRegisterCollection, fixture.ctx);
  assert.deepEqual(result, { id: 'receipt-1', receivable_id: 'receivable-1', amount: 500, unallocated_amount: 500 });
  const receipt = fixture.writes.find(entry => entry.object === 'forge_cash_receipt').row;
  assert.deepEqual(
    { customer_id: receipt.customer_id, status: receipt.status, amount: receipt.amount, unallocated: receipt.unallocated_amount },
    { customer_id: 'customer-1', status: 'unallocated', amount: 500, unallocated: 500 },
  );
  assert.deepEqual(fixture.writes.find(entry => entry.object === 'forge_fund_account').patch, {
    id: 'account-1', current_balance: 1500,
  });
});

test('receipt registration still blocks settled receivables before writing', async () => {
  const fixture = collectionHarness('settled');
  await assert.rejects(invokeBody(ReceivableRegisterCollection, fixture.ctx), /仅未收款、部分收款或逾期应收可以登记收款/);
  assert.equal(fixture.writes.length, 0);
});

test('receipt registration retains amount and open-period checks', async () => {
  const overBalance = collectionHarness('overdue', { amount: 751 });
  await assert.rejects(invokeBody(ReceivableRegisterCollection, overBalance.ctx), /不得超过当前应收余额/);
  assert.equal(overBalance.writes.length, 0);

  const closedPeriod = collectionHarness('overdue', {
    periods: [{ status: 'locked', period_start: '2026-09-01', period_end: '2026-09-30' }],
  });
  await assert.rejects(invokeBody(ReceivableRegisterCollection, closedPeriod.ctx), /不在开放财务期间内/);
  assert.equal(closedPeriod.writes.length, 0);

  const openPeriod = collectionHarness('overdue', {
    periods: [{ status: 'open', period_start: '2026-09-01', period_end: '2026-09-30' }],
  });
  await invokeBody(ReceivableRegisterCollection, openPeriod.ctx);
  assert.equal(openPeriod.writes.filter(entry => entry.object === 'forge_cash_receipt').length, 1);
});

test('receipt code uniqueness prevents duplicate account posting', async () => {
  assert.equal(CashReceipt.fields.code.unique, true);
  const fixture = collectionHarness('unpaid', { duplicateCode: true });
  await invokeBody(ReceivableRegisterCollection, fixture.ctx);
  await assert.rejects(invokeBody(ReceivableRegisterCollection, fixture.ctx), /Duplicate cash receipt code/);
  assert.equal(fixture.writes.filter(entry => entry.object === 'forge_cash_receipt').length, 1);
  assert.equal(fixture.writes.filter(entry => entry.object === 'forge_fund_account').length, 1);
});
