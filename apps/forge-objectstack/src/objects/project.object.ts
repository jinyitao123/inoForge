import { Field, ObjectSchema } from '@objectstack/spec/data';
import { master, text, code, reference, owner, remarks, required } from '../model.js';

const select = (label: string, options: Array<[string, string]>, defaultValue?: string) => Field.select(
  options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  { label, ...(defaultValue ? { defaultValue } : {}) },
);
const amount = (label: string, readonly = false) => Field.currency({ label, precision: 18, scale: 2, min: 0, defaultValue: 0, ...(readonly ? { readonly: true } : {}) });

// Live RISEMAP 2026-09-09: the account had no project type, so CABINET_OTC was created before the first project.
export const ProjectType = master('forge_project_type', '项目类型', 'tags', {
  name: text('类型名称', true), code: code('类型编码'), color: text('标识颜色'), active: Field.boolean({ label: '启用', defaultValue: true }), remarks: remarks(),
}, ['code', 'name', 'color', 'active']);

export const Project = ObjectSchema.create({
  name: 'forge_project', label: '项目中心', pluralLabel: '项目中心', icon: 'briefcase-business', sharingModel: 'private',
  fields: {
    name: text('项目名称', true),
    code: Field.autonumber({ label: '项目编号', autonumberFormat: 'PRJ-{YYYY}-{000}' }),
    type_id: reference('forge_project_type', '项目类型', true),
    customer_id: reference('forge_customer', '客户', true), manager_id: owner(true),
    priority: select('优先级', [['high', '高'], ['medium', '中'], ['low', '低']], 'medium'),
    planned_start_on: Field.date({ label: '计划开始日期', ...required }),
    planned_end_on: Field.date({ label: '计划结束日期', ...required }),
    actual_start_on: Field.date({ label: '实际开始日期', readonly: true }),
    expected_revenue: amount('预计营收'), budget_amount: amount('预算金额'),
    contract_amount: amount('合同金额', true), invoice_amount: amount('已开票', true),
    collected_amount: amount('已回款', true), total_cost: amount('总成本', true),
    progress: Field.number({ label: '项目进度', min: 0, max: 100, scale: 2, defaultValue: 0, readonly: true }),
    status: { ...select('项目状态', [
      ['pending', '待执行'], ['in_progress', '进行中'], ['paused', '已暂停'], ['completed', '已完工'],
      ['settled', '已结算'], ['terminated', '已终止'], ['archived', '已归档'],
    ], 'pending'), readonly: true },
    pause_reason: Field.textarea({ label: '暂停原因', readonly: true }),
    termination_reason: Field.textarea({ label: '终止原因', readonly: true }),
    description: Field.textarea({ label: '项目描述' }), remarks: remarks(),
  },
  nameField: 'name',
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'name', 'customer_id', 'manager_id', 'planned_start_on', 'planned_end_on', 'progress', 'expected_revenue', 'budget_amount', 'contract_amount', 'total_cost', 'status'] } },
  validations: [
    { type: 'script', name: 'project_date_order', condition: 'record.planned_end_on < record.planned_start_on', message: '计划结束日期不得早于计划开始日期' },
    { type: 'state_machine', name: 'project_lifecycle', field: 'status', initialStates: ['pending'], transitions: {
      pending: ['in_progress', 'terminated'], in_progress: ['paused', 'completed', 'terminated'], paused: ['in_progress', 'terminated'],
      completed: ['settled'], settled: ['archived'], terminated: ['archived'], archived: [],
    }, message: '项目状态流转不合法，请使用对应业务动作' },
  ],
  enable: { apiEnabled: true, searchable: true, trackHistory: true },
});

export const ProjectMember = master('forge_project_member', '项目团队', 'users', {
  name: text('成员名称', true), membership_key: code('成员关系编号'), project_id: reference('forge_project', '项目', true),
  user_id: owner(true), member_duty: select('项目角色', [['manager', '项目经理'], ['member', '项目成员']], 'member'),
  joined_on: Field.date({ label: '加入日期', ...required }), active: Field.boolean({ label: '在项目中', defaultValue: true }), remarks: remarks(),
}, ['project_id', 'user_id', 'member_duty', 'joined_on', 'active']);

// RISEMAP links a contract and automatically brings in all non-draft orders under it.
export const ProjectSalesLink = master('forge_project_sales_link', '项目订单合同关联', 'link', {
  name: text('关联名称', true), link_key: code('关联编号'), project_id: reference('forge_project', '项目', true),
  contract_id: reference('forge_sales_contract', '销售合同', true), order_id: reference('forge_sales_order', '销售订单', true),
  order_amount: amount('订单金额', true), invoice_amount: amount('已开票', true), collected_amount: amount('已回款', true), remarks: remarks(),
}, ['project_id', 'contract_id', 'order_id', 'order_amount', 'invoice_amount', 'collected_amount']);

// Live RISEMAP 2026-09-09: a project without a plan offers system/custom/copy/manual starts.
// The observed tenant had zero system and custom templates, so only the manual structure is implemented here.
export const ProjectPlan = master('forge_project_plan', '项目计划', 'calendar-range', {
  name: text('计划名称', true), plan_key: code('计划编号'), project_id: reference('forge_project', '项目', true),
  source: select('创建方式', [['manual', '手工创建'], ['system_template', '系统模板'], ['custom_template', '我的模板'], ['copied_project', '从项目复制']], 'manual'),
  revision: Field.number({ label: '修订号', min: 1, scale: 0, defaultValue: 1, readonly: true }),
  planned_start_on: Field.date({ label: '计划开始', ...required }), planned_end_on: Field.date({ label: '计划结束', ...required }),
  status: { ...select('计划状态', [['active', '执行中'], ['superseded', '已替代'], ['archived', '已归档']], 'active'), readonly: true },
  item_count: Field.number({ label: '工作项数', min: 0, scale: 0, defaultValue: 0, readonly: true }),
  progress: Field.number({ label: '计划进度', min: 0, max: 100, scale: 2, defaultValue: 0, readonly: true }), remarks: remarks(),
}, ['project_id', 'name', 'source', 'revision', 'planned_start_on', 'planned_end_on', 'item_count', 'progress', 'status']);

export const ProjectWorkItem = master('forge_project_work_item', '项目计划工作项', 'list-checks', {
  name: text('名称', true), item_key: code('工作项编号'), project_id: reference('forge_project', '项目', true),
  plan_id: reference('forge_project_plan', '项目计划', true),
  item_type: select('类型', [['phase', '阶段'], ['milestone', '里程碑'], ['task', '任务']], 'task'),
  parent_id: reference('forge_project_work_item', '所属阶段'), owner_id: Field.user({ label: '负责人' }),
  planned_start_on: Field.date({ label: '计划开始', ...required }), planned_end_on: Field.date({ label: '计划结束', ...required }),
  duration_days: Field.number({ label: '工期(天)', min: 0, scale: 0, readonly: true }),
  predecessor_ids: Field.lookup('forge_project_work_item', { label: '前置任务', multiple: true, relatedList: false }), weight: Field.number({ label: '权重', min: 0, max: 100, scale: 2, defaultValue: 20 }),
  critical_path: Field.boolean({ label: '关键路径', defaultValue: false }), planned_deliverable: Field.textarea({ label: '计划产出物' }),
  status: { ...select('工作项状态', [['pending', '未开始'], ['in_progress', '进行中'], ['completed', '已完成'], ['delayed', '已延期'], ['cancelled', '已取消']], 'pending'), readonly: true },
  progress: Field.number({ label: '完成度', min: 0, max: 100, scale: 2, defaultValue: 0, readonly: true }),
  actual_start_on: Field.date({ label: '实际开始', readonly: true }), actual_end_on: Field.date({ label: '实际完成', readonly: true }),
  sort_order: Field.number({ label: '排序', min: 0, scale: 0, defaultValue: 0 }), remarks: remarks(),
}, ['plan_id', 'item_type', 'parent_id', 'name', 'owner_id', 'planned_start_on', 'planned_end_on', 'duration_days', 'predecessor_ids', 'weight', 'critical_path', 'progress', 'status', 'actual_start_on', 'actual_end_on']);

// Live RISEMAP 2026-09-09: the progress view provides one daily-report form beside the task table.
export const ProjectDailyReport = master('forge_project_daily_report', '项目日报', 'notebook-pen', {
  name: text('日报名称', true), report_key: code('日报编号'), project_id: reference('forge_project', '项目', true),
  plan_id: reference('forge_project_plan', '项目计划', true), work_item_id: reference('forge_project_work_item', '工作项', true),
  reporter_id: Field.user({ label: '填报人', ...required }), report_on: Field.date({ label: '日报日期', ...required }),
  completed_today: Field.textarea({ label: '今日完成内容', ...required }),
  completion_percent: Field.number({ label: '完成度', min: 0, max: 100, scale: 2, ...required }),
  blockage: Field.textarea({ label: '阻塞问题' }), assistance_needed: Field.textarea({ label: '需要协助' }),
  expected_finish_changed: Field.boolean({ label: '预计完成日期是否变化', defaultValue: false }),
  expected_finish_on: Field.date({ label: '调整后的预计完成日期' }),
  attachment: Field.file({ label: '附件', description: 'RISEMAP 页面提示单个附件不超过 20MB。' }), remarks: remarks(),
}, ['report_on', 'project_id', 'plan_id', 'work_item_id', 'reporter_id', 'completion_percent', 'expected_finish_changed', 'expected_finish_on']);
