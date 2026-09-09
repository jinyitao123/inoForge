import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../scripts/api-client.mjs';

const path = '.objectstack/acceptance/project-initiation-report.json';
const report = JSON.parse(await readFile(path, 'utf8'));
assert.equal(report.passed, true, 'project initiation acceptance must pass before restart readback');
const api = await connect();
async function read(object, id) {
  const response = await api.request(`/data/${object}/${id}`);
  assert.equal(response.status, 200, `${object}/${id} persisted across restart`);
  return response.value.record;
}
const project = await read('forge_project', report.ids.project);
const member = await read('forge_project_member', report.ids.member);
const link = await read('forge_project_sales_link', report.ids.link);
const type = await read('forge_project_type', report.ids.type);
assert.deepEqual({ name: type.name, code: type.code, active: type.active }, { name: '标准柜机项目', code: 'CABINET_OTC', active: true });
assert.deepEqual({ status: project.status, customer_id: project.customer_id, manager_id: project.manager_id, contract_amount: project.contract_amount, invoice_amount: project.invoice_amount, collected_amount: project.collected_amount },
  { status: 'in_progress', customer_id: report.ids.customer, manager_id: report.ids.manager, contract_amount: 243200, invoice_amount: 0, collected_amount: 0 });
assert.deepEqual({ project_id: member.project_id, user_id: member.user_id, member_duty: member.member_duty, active: member.active },
  { project_id: report.ids.project, user_id: report.ids.manager, member_duty: 'manager', active: true });
assert.deepEqual({ project_id: link.project_id, contract_id: link.contract_id, order_id: link.order_id, order_amount: link.order_amount },
  { project_id: report.ids.project, contract_id: report.ids.contract, order_id: report.ids.order, order_amount: 243200 });
report.restartVerification = { verifiedAt: new Date().toISOString(), status: 'passed', database: '.objectstack/otc-project.sqlite', recordsRead: 4,
  assertion: 'project type, running project, manager membership and exact contract/order link survived a full stop/start' };
await writeFile(path, JSON.stringify(report, null, 2));
console.log('PASS OTC project initiation survived full server restart');
