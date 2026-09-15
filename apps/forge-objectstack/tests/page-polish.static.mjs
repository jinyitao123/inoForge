import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('./page-polish.manifest.json', import.meta.url), 'utf8'));
const pagesDir = new URL('../src/pages/', import.meta.url);
const config = await readFile(new URL('../objectstack.config.ts', import.meta.url), 'utf8');
const findings = [];

for (const [area, entries] of Object.entries(manifest)) {
  for (const entry of entries) {
    const source = await readFile(new URL(entry.file, pagesDir), 'utf8');
    for (const [label, pattern] of [
      ['product-ui.ts 样式', /forgeProductUiCss/],
      ['product-ui.ts 运行时', /forgeProductUiRuntime/],
      ['标准产品根节点', /forge-product/],
      ['标准标题区', /ForgePageHeader|fp-page-header/],
      ['可执行按钮', /<button\b[^>]*onClick=/],
    ]) if (!pattern.test(source)) findings.push(`${area}/${entry.file}: 缺少${label}`);
    for (const [label, pattern] of [
      ['浏览器原生弹框', /(?<!function\s)(?<!const\s)(?<!let\s)(?<!var\s)(?:window\.)?(?:alert|confirm|prompt)\s*\(/],
      ['浏览器原生选择器', /<select\b/],
      ['浏览器原生日期控件', /type=["'](?:date|datetime-local)["']/],
      ['内部验收文案', /复刻验收|本阶段仅验证|后续切片|待复核/],
    ]) if (pattern.test(source)) findings.push(`${area}/${entry.file}: 包含${label}`);
    for (const page of entry.pages) if (!source.includes(page)) findings.push(`${area}/${entry.file}: 未导出 ${page}`);
  }
}

const financeStart = config.indexOf("id: 'finance'");
const financeEnd = config.indexOf("id: 'reports'", financeStart);
const financeBlock = config.slice(financeStart, financeEnd);
const financePages = [...financeBlock.matchAll(/page\([^,]+,[^,]+,\s*'([^']+)'/g)].map(match => match[1]);
const polishedFinancePages = new Set(manifest.finance.flatMap(entry => entry.pages));
for (const page of financePages) if (!polishedFinancePages.has(page)) findings.push(`finance: ${page} 未加入 page-polish 清单`);
assert.equal(financeBlock.includes("'page_finance_gap'"), false, '财务导航仍指向空白占位页');
assert.deepEqual(findings, [], findings.join('\n'));
console.log(`PASS page-polish 清单覆盖 ${Object.values(manifest).flat().length} 个页面文件，${financePages.length} 个财务页面全部纳入且导航无空白占位入口`);
