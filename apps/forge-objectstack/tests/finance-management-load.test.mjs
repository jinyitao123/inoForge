import assert from 'node:assert/strict';
import test from 'node:test';
import * as ts from 'typescript';
import {
  InputInvoicesPage,
  InvoiceOverviewPage,
  InvoiceTasksPage,
  OutputInvoicesPage,
  ReceivablesPayablesPage,
} from '../src/pages/finance-management.page.ts';

const loadFinancePageReads = page => {
  const start = page.source.indexOf('const resolveFinancePageReads=');
  const end = page.source.indexOf(';\nfunction App', start);
  assert.ok(start >= 0 && end > start, `${page.name}: generated page must include its data resolver`);
  return new Function(`${page.source.slice(start, end + 1)}; return resolveFinancePageReads;`)();
};

test('primary finance object failures are returned as errors rather than empty rows', async () => {
  const resolve = loadFinancePageReads(ReceivablesPayablesPage);
  const result = await resolve(
    ['forge_accounts_receivable', 'forge_customer'],
    async name => {
      if (name === 'forge_accounts_receivable') throw new Error('403 Forbidden');
      return [];
    },
  );

  assert.deepEqual(result, {
    rows: [], related: {}, primaryError: '403 Forbidden', unavailableRelated: [],
  });
});

test('failed related reads are identified without discarding primary rows or other relations', async () => {
  const resolve = loadFinancePageReads(ReceivablesPayablesPage);
  const rows = [{ id: 'ar-1', outstanding_amount: 125 }];
  const result = await resolve(
    ['forge_accounts_receivable', 'forge_customer', 'forge_sales_order'],
    async name => {
      if (name === 'forge_accounts_receivable') return rows;
      if (name === 'forge_customer') throw new Error('relation denied');
      return [{ id: 'order-1', code: 'SO-1' }];
    },
  );

  assert.equal(result.primaryError, '');
  assert.deepEqual(result.unavailableRelated, ['forge_customer']);
  assert.equal(result.rows, rows);
  assert.deepEqual(result.related, { forge_sales_order: [{ id: 'order-1', code: 'SO-1' }] });
});

test('only a primary object failure blocks the finance page', () => {
  for (const page of [InvoiceTasksPage, ReceivablesPayablesPage]) {
    const guard = page.source.indexOf('if(state.primaryError)');
    assert.ok(guard >= 0, `${page.name}: missing load-failure guard`);
    assert.match(page.source, /主数据读取失败：\{state\.primaryError\}/);
    assert.doesNotMatch(page.source, /if\(state\.error\|\|state\.unavailableRelated\.length/);
  }

  assert.doesNotMatch(InvoiceTasksPage.source, /async function find\(name\)\{try\{/);
});

test('unread relationships show an explicit fallback and gate only dependent values/actions', () => {
  const source = ReceivablesPayablesPage.source;
  assert.match(source, /关联信息不可读取/);
  assert.match(source, /moneyOrUnavailable/);
  assert.match(source, /disabled=\{relationUnavailable\('forge_fund_account'\)\}/);
  assert.match(source, /disabled=\{relationUnavailable\('forge_accounts_payable'\)\}/);
  assert.match(source, /effectiveAccountView/);

  assert.match(InvoiceTasksPage.source, /disabled=\{relationUnavailable\('forge_sales_order'\)\|\|relationUnavailable\('forge_sales_order_line'\)\}/);
  assert.match(InvoiceTasksPage.source, /关联明细不可读取/);
  assert.match(OutputInvoicesPage.source, /relationUnavailable\('forge_sales_invoice_line'\)\?null/);
  assert.match(InputInvoicesPage.source, /relationUnavailable\('forge_purchase_invoice_line'\)\?null/);
});

test('generated finance pages remain valid TSX after load-state changes', () => {
  for (const page of [InvoiceTasksPage, ReceivablesPayablesPage, InvoiceOverviewPage, OutputInvoicesPage, InputInvoicesPage]) {
    const file = ts.createSourceFile(`${page.name}.tsx`, page.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(
      file.parseDiagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
      [],
      page.name,
    );
  }
});
