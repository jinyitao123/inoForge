import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { ProjectCenterPage } from '../src/pages/project-center.page.ts';
import { DeliveryAcceptanceWorkspacePage } from '../src/pages/delivery-acceptance-workspace.page.ts';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@objectstack/cli'));
const { transformSync } = cliRequire('esbuild');

const project = {
  id: 'project-1',
  code: 'PRJ-2026-001',
  name: 'Delivery Entry Project',
  customer_id: 'customer-1',
  manager_id: 'user-1',
  created_by: 'user-1',
  status: 'in_progress',
  planned_start_on: '2026-10-01',
  planned_end_on: '2026-10-31',
  progress: 0,
};

function createHarness(pageSource, { search = '', seed = {} } = {}) {
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
        if (value && value.loading === true && Array.isArray(value.projects)) value = { ...value, ...seed, loading: false };
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
    ListView: props => React.createElement('div', props),
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
  vm.runInNewContext(transformSync(pageSource, { loader: 'jsx', format: 'cjs' }).code, context);
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

function deliverySeed(commissionings) {
  return {
    projects: [project],
    assemblies: [],
    commissionings,
    packages: [],
    acceptances: [],
    record: null,
    lines: [],
    rectifications: [],
    error: '',
  };
}

function completePackageFields(harness) {
  let tree = harness.render();
  const revision = findNodes(tree, node => node.type === 'input' && node.props['aria-label'] === '交付版本')[0];
  revision.props.onChange({ target: { value: 'V1' } });
  tree = harness.render();
  const evidenceInputs = () => findNodes(tree, node => node.type === 'input' && String(node.props['aria-label'] || '').endsWith(' 证据'));
  for (let index = 0; index < 4; index++) {
    evidenceInputs()[index].props.onChange({ target: { value: `REF-${index + 1}` } });
    tree = harness.render();
  }
  return tree;
}

test('project detail opens package creation with its current project selected', () => {
  const harness = createHarness(ProjectCenterPage.source, {
    search: '?project=project-1',
    seed: {
      currentUserId: 'user-1',
      permissions: { systemPermissions: ['forge_project_operator', 'forge_delivery_operator'] },
      projects: [project],
      customers: [{ id: 'customer-1', name: 'Customer One' }],
      types: [],
      users: [{ id: 'user-1', name: 'Project Manager' }],
      items: [],
    },
  });
  let tree = harness.render();
  findNodes(tree, node => node.type === 'button' && textContent(node) === '交付包')[0].props.onClick();
  tree = harness.render();
  findNodes(tree, node => node.type === 'button' && textContent(node) === '新建交付包')[0].props.onClick();
  assert.equal(harness.navigation.at(-1), '/apps/com.inoforge.forge.project/page_delivery_acceptance_workspace?new=package&project=project-1');

  const delivery = createHarness(DeliveryAcceptanceWorkspacePage.source, {
    search: '?new=package&project=project-1',
    seed: deliverySeed([{ id: 'commissioning-1', project_id: 'project-1', status: 'passed' }]),
  });
  const deliveryTree = delivery.render();
  const projectSelect = findNodes(deliveryTree, node => node.type?.name === 'ForgeSelectControl' && node.props['aria-label'] === '项目')[0];
  assert.equal(projectSelect.props.value, 'project-1');
});

test('package creation stays blocked until this project has a passed commissioning record', () => {
  const eligible = createHarness(DeliveryAcceptanceWorkspacePage.source, {
    search: '?new=package&project=project-1',
    seed: deliverySeed([{ id: 'commissioning-1', project_id: 'project-1', status: 'passed' }]),
  });
  let tree = completePackageFields(eligible);
  const eligibleSave = findNodes(tree, node => node.type === 'button' && textContent(node) === '保存')[0];
  assert.equal(eligibleSave.props.disabled, false, 'the existing package form is usable after its declared fields are complete');

  const blocked = createHarness(DeliveryAcceptanceWorkspacePage.source, {
    search: '?new=package&project=project-1',
    seed: deliverySeed([]),
  });
  tree = completePackageFields(blocked);
  assert.match(textContent(tree), /当前项目不满足交付包创建条件/);
  const blockedSave = findNodes(tree, node => node.type === 'button' && textContent(node) === '保存')[0];
  assert.equal(blockedSave.props.disabled, true, 'the page enforces the same-project passed-commissioning precondition before submit');
});
