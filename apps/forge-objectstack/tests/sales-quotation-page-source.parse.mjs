import assert from 'node:assert/strict';
import ts from 'typescript';
import { SalesQuotationsPage } from '../src/pages/sales-crm-service-pages.page.ts';

const parsed = ts.createSourceFile('sales-quotations.jsx', SalesQuotationsPage.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
assert.equal(parsed.parseDiagnostics.length, 0, parsed.parseDiagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'));
assert.match(SalesQuotationsPage.source, /find\('forge_sales_opportunity','id,name,customer_id,contact_id,stage,owner_id,responsible_id'\)/, 'quote entry must load opportunities through the authenticated ObjectStack data API');
assert.match(SalesQuotationsPage.source, /activeOpportunities\.filter\(row=>row\.customer_id===form\.customer_id\)/, 'quote options must be restricted to the selected customer');
assert.match(SalesQuotationsPage.source, /opportunity_name\)/, 'quote list and details should retain a readable opportunity title when an option is unavailable');
assert.match(SalesQuotationsPage.source, /aria-label="报价关联商机"/, 'new quote form must present the canonical opportunity relationship');
assert.match(SalesQuotationsPage.source, /opportunity_id:form\.opportunity_id\|\|null/, 'new quote form must submit the relationship ID to the formal draft Action');
console.log('PASS generated sales quotation page parses and submits its permitted opportunity relationship');
