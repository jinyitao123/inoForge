import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { SalesContactsPage } from '../src/pages/sales-contacts.page.ts';
import { SalesCustomersPage } from '../src/pages/sales-customers.page.ts';
import { SalesQuotationsPage } from '../src/pages/sales-crm-service-pages.page.ts';
for (const page of [SalesContactsPage, SalesCustomersPage, SalesQuotationsPage]) {
  test(`${page.name} composes model editor fragments without lexical conflicts`, () => {
    const parsed=ts.createSourceFile('page.jsx',page.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
    assert.equal(parsed.parseDiagnostics.length,0);
    const {outputText}=ts.transpileModule(page.source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
    assert.doesNotThrow(()=>new Function(outputText), 'native runtime must be able to compile the complete page');
  });
}
