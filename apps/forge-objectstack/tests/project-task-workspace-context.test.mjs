import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { ProjectCenterPage } from '../src/pages/project-center.page.ts';
import { ProjectTaskWorkspacePage } from '../src/pages/project-task-workspace.page.ts';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@objectstack/cli'));
const { transformSync } = cliRequire('esbuild');

function task(id, status, projectId = 'project-1') {
  return {
    id,
    name: id,
    item_key: id.toUpperCase(),
    project_id: projectId,
    plan_id: projectId === 'project-1' ? 'plan-1' : 'plan-2',
    item_type: 'task',
    status,
    owner_id: 'user-1',
    planned_start_on: '2026-10-01',
    planned_end_on: '2026-10-10',
    progress: status === 'completed' ? 100 : 0,
  };
}

function createHarness(pageSource, { search = '', seed } = {}) {
  const slots = [];
  const navigation = [];
  let cursor = 0;
  const React = {
    Fragment: Symbol.for('react.fragment'),
    createElement(type, props, ...children) {
      const normalized = { ...(props || {}) };
      const flatChildren = children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false);
      if (flatChildren.length) normalized.children = flatChildren.length === 1 ? flatChildren[0] : flatChildren;
      return { type, props: normalized, children: flatChildren };
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        let value = typeof initial === 'function' ? initial() : initial;
        if (value && value.loading === true && Array.isArray(value.projects)) {
          value = { ...value, ...seed, loading: false };
        }
        slots[index] = value;
      }
      return [slots[index], next => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() { cursor++; },
    useMemo(factory) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = factory();
      return slots[index];
    },
  };
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    React,
    useAdapter: () => ({ baseUrl: 'http://forge.test', getAuthHeaders: () => ({}), fetchImpl: async () => { throw new Error('Unexpected API request'); } }),
    navigate: path => navigation.push(path),
    URL,
    URLSearchParams,
    window: {
      location: { search, pathname: '/_console/apps/com.inoforge.forge.project/page_project_center', href: 'http://forge.test/_console/apps/com.inoforge.forge.project/page_project_center' + search },
      history: { pushState() {} },
      addEventListener() {},
      removeEventListener() {},
    },
    setTimeout,
    clearTimeout,
    console,
  };
  const code = transformSync(pageSource, { loader: 'jsx', format: 'cjs' }).code;
  vm.runInNewContext(code, context);
  const App = module.exports.default;
  return {
    navigation,
    render() {
      cursor = 0;
      return App();
    },
  };
}

function findNodes(tree, predicate, results = []) {
  if (!tree || typeof tree !== 'object') return results;
  if (predicate(tree)) results.push(tree);
  for (const child of tree.children || []) findNodes(child, predicate, results);
  return results;
}

function textContent(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return (node.children || []).map(textContent).join('');
}

const projects = [
  { id: 'project-1', code: 'PRJ-1', name: 'Project One', customer_id: 'customer-1', manager_id: 'user-1', created_by: 'user-1', status: 'in_progress', planned_start_on: '2026-10-01', planned_end_on: '2026-10-31', progress: 0 },
  { id: 'project-2', code: 'PRJ-2', name: 'Project Two', customer_id: 'customer-1', manager_id: 'user-1', status: 'in_progress', planned_start_on: '2026-10-01', planned_end_on: '2026-10-31', progress: 0 },
];

test('project detail task status filter is controlled and task links retain project scope', () => {
  const harness = createHarness(ProjectCenterPage.source, {
    search: '?project=project-1',
    seed: {
      currentUserId: 'user-1',
      permissions: { systemPermissions: ['forge_project_operator', 'sales_contract_operator'] },
      projects,
      customers: [{ id: 'customer-1', name: 'Customer One' }],
      users: [{ id: 'user-1', name: 'Project Manager' }],
      items: [task('active-task', 'in_progress'), task('cancelled-task', 'cancelled')],
    },
  });
  let tree = harness.render();
  const tasksTab = findNodes(tree, node => node.type === 'button' && textContent(node) === '任务管理')[0];
  assert.ok(tasksTab, 'the project detail exposes its task section');
  tasksTab.props.onClick();

  tree = harness.render();
  const statusSelect = findNodes(tree, node => node.type?.name === 'ForgeSelectControl' && node.props['aria-label'] === '任务状态')[0];
  assert.ok(statusSelect, 'the status filter is an accessible controlled selector');
  assert.equal(statusSelect.props.value, '');
  const table = findNodes(tree, node => node.type?.name === 'Table' && Array.isArray(node.props.rows))[0];
  const initialRows = table.props.rows.map(textContent);
  assert.equal(initialRows.length, 2);
  assert.match(initialRows[0], /active-task.*进行中/);
  assert.match(initialRows[1], /cancelled-task.*已取消/);

  statusSelect.props.onChange({ target: { value: 'cancelled' } });
  tree = harness.render();
  const filteredTable = findNodes(tree, node => node.type?.name === 'Table' && Array.isArray(node.props.rows))[0];
  assert.equal(filteredTable.props.rows.length, 1);
  assert.match(textContent(filteredTable.props.rows[0]), /cancelled-task/);

  const viewTask = findNodes(filteredTable.props.rows[0], node => node.type === 'button' && textContent(node) === '查看')[0];
  viewTask.props.onClick();
  assert.equal(harness.navigation.at(-1), '/apps/com.inoforge.forge.project/page_project_task_workspace?project=project-1&search=CANCELLED-TASK');
});

test('task workspace reads project scope from its route and filters cancelled tasks', () => {
  const harness = createHarness(ProjectTaskWorkspacePage.source, {
    search: '?project=project-1',
    seed: {
      projects,
      plans: [{ id: 'plan-1', project_id: 'project-1', status: 'active' }, { id: 'plan-2', project_id: 'project-2', status: 'active' }],
      items: [task('active-task', 'in_progress'), task('cancelled-task', 'cancelled'), task('other-project-task', 'cancelled', 'project-2')],
      users: [{ id: 'user-1', name: 'Project Manager' }],
      evidence: [],
      error: '',
    },
  });
  let tree = harness.render();
  const projectSelect = findNodes(tree, node => node.type?.name === 'ForgeSelectControl' && node.props['aria-label'] === '项目筛选')[0];
  assert.ok(projectSelect);
  assert.equal(projectSelect.props.value, 'project-1');
  assert.doesNotMatch(textContent(tree), /other-project-task/);
  assert.match(textContent(tree), /active-task/);
  assert.match(textContent(tree), /cancelled-task/);

  const cancelledTab = findNodes(tree, node => node.type === 'button' && textContent(node) === '已取消')[0];
  assert.ok(cancelledTab, 'cancelled is a selectable task state');
  cancelledTab.props.onClick();
  tree = harness.render();
  assert.doesNotMatch(textContent(tree), /active-task/);
  assert.match(textContent(tree), /cancelled-task/);
  assert.doesNotMatch(textContent(tree), /other-project-task/);

  const createButton = findNodes(tree, node => node.type === 'button' && textContent(node) === '新建任务')[0];
  createButton.props.onClick();
  tree = harness.render();
  const projectField = findNodes(tree, node => node.type?.name === 'ForgeSelectControl' && node.props['aria-label'] === '任务项目')[0];
  assert.equal(projectField.props.value, 'project-1', 'new work remains scoped to the originating project');
  const planField = findNodes(tree, node => node.type?.name === 'ForgeSelectControl' && node.props['aria-label'] === '任务计划')[0];
  assert.equal(planField.props.value, 'plan-1', 'new work defaults to that project’s active plan');
});

test('task workspace does not fall back to another project when the requested scope is unavailable', () => {
  const harness = createHarness(ProjectTaskWorkspacePage.source, {
    search: '?project=unavailable-project',
    seed: {
      projects,
      plans: [{ id: 'plan-1', project_id: 'project-1', status: 'active' }],
      items: [task('active-task', 'in_progress')],
      users: [],
      evidence: [],
      error: '',
    },
  });
  const tree = harness.render();
  assert.doesNotMatch(textContent(tree), /active-task/);
  const createButton = findNodes(tree, node => node.type === 'button' && textContent(node) === '新建任务')[0];
  assert.equal(createButton.props.disabled, true, 'an inaccessible project cannot silently route task creation to a different project');
});

test('task workspace honors a task search passed from a project detail row', () => {
  const harness = createHarness(ProjectTaskWorkspacePage.source, {
    search: '?project=project-1&search=CANCELLED-TASK',
    seed: {
      projects,
      plans: [{ id: 'plan-1', project_id: 'project-1', status: 'active' }],
      items: [task('active-task', 'in_progress'), task('cancelled-task', 'cancelled')],
      users: [{ id: 'user-1', name: 'Project Manager' }],
      evidence: [],
      error: '',
    },
  });
  const tree = harness.render();
  const searchInput = findNodes(tree, node => node.type === 'input' && node.props['aria-label'] === '搜索任务')[0];
  assert.equal(searchInput.props.value, 'CANCELLED-TASK');
  assert.match(textContent(tree), /cancelled-task/);
  assert.doesNotMatch(textContent(tree), /active-task/);
});
