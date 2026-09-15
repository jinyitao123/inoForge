import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('objectstack.config.ts', 'utf8');
const pages = await readFile('src/pages/administration-pages.page.ts', 'utf8');
const manifest = JSON.parse(await readFile('tests/page-polish.manifest.json', 'utf8'));
const pageNames = [...pages.matchAll(/name:'(page_[a-z_]+)'/g)].map(match => match[1]);
const navTargets = [...config.matchAll(/page\('[^']+', '[^']+', '(page_[a-z_]+)'/g)].map(match => match[1]);

assert.equal(pageNames.length, 32, 'administration must expose 32 independent page definitions');
assert.equal(new Set(pageNames).size, 32, 'administration page names must be unique');
assert.equal(config.includes("'page_administration_gap'"), false, 'navigation must not retain the shared administration gap page');
for (const name of pageNames) assert.ok(navTargets.includes(name), `${name} must be linked from navigation`);
const registered = manifest.administration.flatMap(entry => entry.pages);
assert.deepEqual([...registered].sort(), [...pageNames].sort(), 'every administration page must be registered in the polish manifest');
assert.ok(manifest.administration.every(entry => entry.designStatus === 'review_required'));
assert.match(pages, /ForgeDialog/);
assert.match(pages, /ForgeDateInput/);
assert.match(pages, /ForgeSelect/);
assert.match(pages, /forge_administration_record/);
console.log(JSON.stringify({ suite: 'administration-pages-static', pages: pageNames.length, status: 'passed' }, null, 2));
