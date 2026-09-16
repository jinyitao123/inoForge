import { Field, ObjectSchema } from '@objectstack/spec/data';
import { required } from '../model.js';

const option = (value: string, label: string) => ({ value, label });

/**
 * Administrative pages currently share one deliberately small persistence
 * envelope.  `page_key` keeps records on their owning business surface while
 * the page contract remains under review against RISEMAP.  It is not a claim
 * that the different administrative documents have one final domain model.
 */
export const AdministrationRecord = ObjectSchema.create({
  name: 'forge_administration_record',
  label: '行政业务记录',
  pluralLabel: '行政业务记录',
  icon: 'building',
  sharingModel: 'private',
  nameField: 'title',
  fields: {
    title: Field.text({ label: '标题', maxLength: 255, ...required }),
    code: Field.text({ label: '编号', maxLength: 100 }),
    page_key: Field.text({ label: '业务页面', maxLength: 100, ...required }),
    category: Field.text({ label: '分类', maxLength: 100 }),
    status: Field.select([
      option('draft', '草稿'), option('pending', '待处理'), option('in_progress', '进行中'),
      option('approved', '已通过'), option('completed', '已完成'), option('rejected', '已驳回'),
      option('inactive', '已停用'),
    ], { label: '状态', defaultValue: 'draft', ...required }),
    priority: Field.select([
      option('normal', '普通'), option('important', '重要'), option('urgent', '紧急'),
    ], { label: '优先级', defaultValue: 'normal' }),
    owner_name: Field.text({ label: '负责人', maxLength: 100 }),
    department: Field.text({ label: '部门', maxLength: 100 }),
    start_on: Field.date({ label: '开始日期' }),
    end_on: Field.date({ label: '结束日期' }),
    amount: Field.currency({ label: '金额', precision: 18, scale: 2, min: 0 }),
    quantity: Field.number({ label: '数量', min: 0, scale: 2 }),
    details: Field.textarea({ label: '业务说明' }),
    source_ref: Field.text({ label: '来源关联', maxLength: 255 }),
    remarks: Field.textarea({ label: '备注' }),
  },
  searchableFields: ['title', 'code', 'category', 'owner_name', 'department', 'source_ref'],
  listViews: {
    all: {
      label: '全部', type: 'grid',
      columns: ['code', 'title', 'page_key', 'category', 'owner_name', 'department', 'start_on', 'end_on', 'status'],
    },
  },
  indexes: [
    { fields: ['page_key', 'status'] },
    { fields: ['page_key', 'start_on'] },
  ],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const ApprovalInstance = ObjectSchema.create({
  name: 'forge_approval_instance',
  label: '审批实例',
  pluralLabel: '审批实例',
  icon: 'file-check',
  sharingModel: 'private',
  nameField: 'title',
  fields: {
    title: Field.text({ label: '审批标题', maxLength: 255, ...required }),
    code: Field.text({ label: '审批编号', maxLength: 100, ...required }),
    process_name: Field.text({ label: '审批类型', maxLength: 120, ...required }),
    priority: Field.select([
      option('normal', '普通'), option('important', '重要'), option('urgent', '紧急'),
    ], { label: '优先级', defaultValue: 'normal', ...required }),
    status: Field.select([
      option('draft', '草稿'), option('in_progress', '进行中'), option('approved', '已通过'),
      option('rejected', '已驳回'), option('reversed', '已反审核'), option('cancelled', '已取消'),
      option('paused', '已暂停'),
    ], { label: '状态', defaultValue: 'draft', ...required }),
    current_node: Field.text({ label: '当前节点', maxLength: 120 }),
    initiator_name: Field.text({ label: '发起人', maxLength: 100, ...required }),
    initiated_at: Field.datetime({ label: '发起时间' }),
    ended_at: Field.datetime({ label: '结束时间' }),
    due_at: Field.datetime({ label: '到期时间' }),
    remarks: Field.textarea({ label: '申请说明' }),
  },
  searchableFields: ['title', 'code', 'process_name', 'initiator_name', 'current_node'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'title', 'process_name', 'priority', 'status', 'current_node', 'initiated_at', 'ended_at'] } },
  indexes: [{ fields: ['status', 'initiated_at'] }, { fields: ['initiator_name', 'status'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const ApprovalTask = ObjectSchema.create({
  name: 'forge_approval_task',
  label: '审批任务',
  pluralLabel: '审批任务',
  icon: 'clipboard-check',
  sharingModel: 'private',
  nameField: 'title',
  fields: {
    title: Field.text({ label: '任务名称', maxLength: 255, ...required }),
    code: Field.text({ label: '任务编号', maxLength: 100, ...required }),
    instance_id: Field.lookup('forge_approval_instance', { label: '审批实例', ...required }),
    process_name: Field.text({ label: '流程名称', maxLength: 120, ...required }),
    process_title: Field.text({ label: '流程标题', maxLength: 255, ...required }),
    initiator_name: Field.text({ label: '发起人', maxLength: 100, ...required }),
    assignee_name: Field.text({ label: '审批人', maxLength: 100, ...required }),
    created_at_business: Field.datetime({ label: '创建时间', ...required }),
    due_at: Field.datetime({ label: '到期时间' }),
    urged_count: Field.number({ label: '催办次数', min: 0, scale: 0, defaultValue: 0 }),
    status: Field.select([
      option('pending', '待处理'), option('approved', '已通过'), option('rejected', '已驳回'),
    ], { label: '状态', defaultValue: 'pending', ...required }),
    decision_comment: Field.textarea({ label: '审批意见' }),
    transferred_to: Field.text({ label: '转办给', maxLength: 100 }),
    completed_at: Field.datetime({ label: '完成时间' }),
  },
  searchableFields: ['title', 'code', 'process_name', 'process_title', 'initiator_name', 'assignee_name'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'title', 'process_name', 'process_title', 'initiator_name', 'assignee_name', 'due_at', 'status'] } },
  indexes: [{ fields: ['assignee_name', 'status'] }, { fields: ['instance_id', 'status'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const ApprovalCc = ObjectSchema.create({
  name: 'forge_approval_cc',
  label: '审批抄送',
  pluralLabel: '审批抄送',
  icon: 'send',
  sharingModel: 'private',
  nameField: 'title',
  fields: {
    title: Field.text({ label: '流程标题', maxLength: 255, ...required }),
    code: Field.text({ label: '抄送编号', maxLength: 100, ...required }),
    instance_id: Field.lookup('forge_approval_instance', { label: '审批实例', ...required }),
    process_name: Field.text({ label: '流程名称', maxLength: 120, ...required }),
    initiator_name: Field.text({ label: '发起人', maxLength: 100, ...required }),
    copied_at: Field.datetime({ label: '抄送时间', ...required }),
    progress: Field.text({ label: '当前进度', maxLength: 120 }),
    read_status: Field.select([option('unread', '未读'), option('read', '已读')], { label: '阅读状态', defaultValue: 'unread', ...required }),
    read_at: Field.datetime({ label: '阅读时间' }),
  },
  searchableFields: ['title', 'code', 'process_name', 'initiator_name', 'progress'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['read_status', 'code', 'process_name', 'title', 'initiator_name', 'copied_at', 'progress'] } },
  indexes: [{ fields: ['read_status', 'copied_at'] }, { fields: ['instance_id'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const ProcessCategory = ObjectSchema.create({
  name: 'forge_process_category', label: '流程分类', pluralLabel: '流程分类', icon: 'tags',
  sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '分类名称', maxLength: 120, ...required }),
    code: Field.text({ label: '分类编码', maxLength: 80, ...required }),
    status: Field.select([option('active', '已启用'), option('inactive', '已停用')], { label: '状态', defaultValue: 'active', ...required }),
    sort_order: Field.number({ label: '显示顺序', min: 0, scale: 0, defaultValue: 100 }),
    description: Field.textarea({ label: '分类说明' }),
  },
  searchableFields: ['title', 'code', 'description'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'title', 'status', 'sort_order'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status', 'sort_order'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const ProcessDefinition = ObjectSchema.create({
  name: 'forge_process_definition', label: '流程定义', pluralLabel: '流程定义', icon: 'git-branch',
  sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '流程名称', maxLength: 160, ...required }),
    code: Field.text({ label: '流程编码', maxLength: 80, ...required }),
    category_id: Field.lookup('forge_process_category', { label: '流程分类', ...required }),
    status: Field.select([option('active', '已启用'), option('inactive', '已停用')], { label: '状态', defaultValue: 'active', ...required }),
    process_type: Field.select([option('approval', '审批流程'), option('business', '业务流程')], { label: '流程类型', defaultValue: 'approval', ...required }),
    version: Field.text({ label: '版本号', maxLength: 30, defaultValue: 'V1.0', ...required }),
    default_approver: Field.text({ label: '默认审批人', maxLength: 100, ...required }),
    description: Field.textarea({ label: '流程说明' }),
  },
  searchableFields: ['title', 'code', 'default_approver', 'description'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'title', 'category_id', 'status', 'process_type', 'version', 'default_approver'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['category_id', 'status'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const CompanyNotice = ObjectSchema.create({
  name: 'forge_company_notice', label: '公司通知', pluralLabel: '公司通知', icon: 'megaphone',
  sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '通知主题', maxLength: 200, ...required }),
    code: Field.text({ label: '通知编号', maxLength: 80, ...required }),
    category: Field.select([option('activity', '活动通知'), option('administration', '行政通知'), option('personnel', '人事通知'), option('system', '系统通知')], { label: '通知类别', defaultValue: 'administration', ...required }),
    priority: Field.select([option('normal', '普通'), option('important', '重要'), option('urgent', '紧急')], { label: '优先级', defaultValue: 'normal', ...required }),
    status: Field.select([option('draft', '草稿'), option('published', '已发布'), option('withdrawn', '已撤回'), option('expired', '已失效')], { label: '状态', defaultValue: 'draft', ...required }),
    department: Field.text({ label: '发布部门', maxLength: 120, ...required }),
    publisher_name: Field.text({ label: '发布人', maxLength: 100, ...required }),
    summary: Field.textarea({ label: '摘要', ...required }),
    content: Field.textarea({ label: '正文', ...required }),
    audience_type: Field.select([option('company', '全公司'), option('departments', '指定部门'), option('people', '指定人员')], { label: '接收范围', defaultValue: 'company', ...required }),
    audience_detail: Field.text({ label: '范围说明', maxLength: 500 }),
    expires_on: Field.date({ label: '失效日期' }),
    pinned: Field.boolean({ label: '置顶显示', defaultValue: false }),
    published_at: Field.datetime({ label: '发布时间' }),
    withdrawn_at: Field.datetime({ label: '撤回时间' }),
    read_count: Field.number({ label: '已读人数', min: 0, scale: 0, defaultValue: 0 }),
    recipient_count: Field.number({ label: '接收人数', min: 0, scale: 0, defaultValue: 0 }),
  },
  searchableFields: ['title', 'code', 'department', 'publisher_name', 'summary', 'content'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code', 'title', 'status', 'category', 'priority', 'audience_type', 'department', 'publisher_name', 'published_at', 'read_count'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status', 'published_at'] }, { fields: ['category', 'audience_type'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const WorkReport = ObjectSchema.create({
  name: 'forge_work_report', label: '工作汇报', pluralLabel: '工作汇报', icon: 'clipboard-list', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '汇报标题', maxLength: 200, ...required }),
    code: Field.text({ label: '汇报编号', maxLength: 80, ...required }),
    report_type: Field.select([option('weekly','周报'), option('monthly','月报'), option('daily','日报'), option('free','自由汇报')], { label: '汇报类型', defaultValue: 'weekly', ...required }),
    status: Field.select([option('draft','草稿'), option('submitted','待审阅'), option('approved','已确认'), option('rejected','已退回')], { label: '状态', defaultValue: 'draft', ...required }),
    owner_name: Field.text({ label: '提交人', maxLength: 100, ...required }),
    period_start: Field.date({ label: '汇报周期起始', ...required }), period_end: Field.date({ label: '汇报周期结束', ...required }),
    work_content: Field.textarea({ label: '工作内容', ...required }), completion: Field.number({ label: '完成度', min: 0, max: 100, scale: 0, defaultValue: 0 }),
    summary: Field.textarea({ label: '工作总结', ...required }), next_plan: Field.textarea({ label: '下期计划' }), risks: Field.textarea({ label: '问题与风险' }),
    self_score: Field.number({ label: '自评得分', min: 0, max: 100, scale: 0 }), submitted_at: Field.datetime({ label: '提交时间' }), reviewer_name: Field.text({ label: '审阅人', maxLength: 100 }), review_note: Field.textarea({ label: '审阅意见' }),
  },
  searchableFields: ['title','code','owner_name','work_content','summary','next_plan','risks'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code','title','owner_name','report_type','period_start','period_end','status','submitted_at','self_score'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status','period_end'] }, { fields: ['owner_name','period_start'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const DocumentEntry = ObjectSchema.create({
  name: 'forge_document_entry', label: '文档条目', pluralLabel: '文档条目', icon: 'folder', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '名称', maxLength: 200, ...required }), code: Field.text({ label: '文档编号', maxLength: 80, ...required }),
    entry_type: Field.select([option('folder','文件夹'), option('document','文档')], { label: '条目类型', defaultValue: 'folder', ...required }),
    parent_id: Field.lookup('forge_document_entry', { label: '上级目录' }), description: Field.textarea({ label: '描述' }),
    access: Field.select([option('company','全员可见'), option('restricted','限制访问')], { label: '访问权限', defaultValue: 'company', ...required }),
    owner_name: Field.text({ label: '负责人', maxLength: 100, ...required }), favorite: Field.boolean({ label: '收藏', defaultValue: false }),
    updated_at: Field.datetime({ label: '更新时间', ...required }), file_name: Field.text({ label: '文件名', maxLength: 255 }), file_size: Field.number({ label: '文件大小', min: 0, scale: 0 }),
  }, searchableFields: ['title','code','description','file_name','owner_name'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['entry_type','code','title','access','owner_name','updated_at','favorite'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['entry_type','parent_id'] }, { fields: ['favorite','updated_at'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const RulePolicy = ObjectSchema.create({
  name: 'forge_rule_policy', label: '规章制度', pluralLabel: '规章制度', icon: 'book-open', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '制度名称', maxLength: 200, ...required }),
    code: Field.text({ label: '制度编号', maxLength: 80, ...required }),
    category: Field.text({ label: '分类', maxLength: 100, ...required }),
    status: Field.select([option('draft','草稿'), option('published','已发布'), option('inactive','已停用')], { label: '状态', defaultValue: 'draft', ...required }),
    scope: Field.text({ label: '适用范围', maxLength: 200 }),
    effective_on: Field.date({ label: '生效日期' }),
    version: Field.text({ label: '版本', maxLength: 30, defaultValue: 'V1.0', ...required }),
    owner_name: Field.text({ label: '创建人', maxLength: 100, ...required }),
    summary: Field.textarea({ label: '制度摘要' }),
  },
  searchableFields: ['title','code','category','scope','owner_name','summary'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code','title','category','status','scope','effective_on','version','owner_name'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status','effective_on'] }, { fields: ['category','status'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const EmployeeRecord = ObjectSchema.create({
  name: 'forge_employee_record', label: '员工档案', pluralLabel: '员工档案', icon: 'users', sharingModel: 'private', nameField: 'name',
  fields: {
    name: Field.text({ label: '姓名', maxLength: 100, ...required }),
    employee_code: Field.text({ label: '工号', maxLength: 60, ...required }),
    department: Field.text({ label: '部门', maxLength: 120 }),
    position: Field.text({ label: '岗位', maxLength: 120 }),
    grade: Field.text({ label: '职级', maxLength: 80 }),
    employment_type: Field.select([option('full_time','正式'), option('probation','试用'), option('part_time','兼职'), option('contract','合同')], { label: '用工类型', defaultValue: 'full_time', ...required }),
    status: Field.select([option('active','在职'), option('probation','试用期'), option('leave','休假'), option('resigned','离职')], { label: '员工状态', defaultValue: 'active', ...required }),
    joined_on: Field.date({ label: '入职日期' }),
    contract_end_on: Field.date({ label: '合同到期日' }),
    passport_no: Field.text({ label: '护照号码', maxLength: 80 }),
    system_user: Field.text({ label: '系统用户', maxLength: 120 }),
    mobile: Field.text({ label: '手机', maxLength: 40 }),
    remarks: Field.textarea({ label: '备注' }),
  },
  searchableFields: ['name','employee_code','department','position','grade','passport_no','system_user','mobile'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['employee_code','name','department','position','grade','employment_type','status','joined_on','contract_end_on','passport_no','system_user','mobile'] } },
  indexes: [{ fields: ['employee_code'], unique: 'organization' }, { fields: ['department','status'] }, { fields: ['contract_end_on','status'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const MeetingMinute = ObjectSchema.create({
  name: 'forge_meeting_minute', label: '会议纪要', pluralLabel: '会议纪要', icon: 'calendar', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '会议主题', maxLength: 200, ...required }),
    code: Field.text({ label: '会议编号', maxLength: 80, ...required }),
    meeting_type: Field.text({ label: '会议类型', maxLength: 100 }),
    meeting_at: Field.datetime({ label: '日期/时间', ...required }),
    host_name: Field.text({ label: '主持人', maxLength: 100 }),
    attendee_count: Field.number({ label: '参会人数', min: 0, scale: 0, defaultValue: 0 }),
    todo_count: Field.number({ label: '待办', min: 0, scale: 0, defaultValue: 0 }),
    status: Field.select([option('draft','草稿'), option('confirmed','已确认'), option('archived','已归档')], { label: '状态', defaultValue: 'draft', ...required }),
    decisions: Field.textarea({ label: '会议决议' }),
    todos: Field.textarea({ label: '待办事项' }),
    remarks: Field.textarea({ label: '备注' }),
  },
  searchableFields: ['title','code','meeting_type','host_name','decisions','todos'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code','title','meeting_type','meeting_at','host_name','attendee_count','todo_count','status'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['meeting_at','status'] }, { fields: ['host_name','meeting_at'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const SealApplication = ObjectSchema.create({
  name: 'forge_seal_application', label: '用章申请', pluralLabel: '用章申请', icon: 'stamp', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '文件名称', maxLength: 200, ...required }),
    code: Field.text({ label: '申请编号', maxLength: 80, ...required }),
    company_name: Field.text({ label: '公司抬头', maxLength: 200 }),
    applicant_name: Field.text({ label: '申请人', maxLength: 100, ...required }),
    seal_type: Field.text({ label: '印章类型', maxLength: 100, ...required }),
    reason: Field.textarea({ label: '用章事由', ...required }),
    status: Field.select([option('draft','草稿'), option('pending','待审批'), option('approved','已通过'), option('rejected','已驳回'), option('completed','已盖章')], { label: '状态', defaultValue: 'draft', ...required }),
    applied_on: Field.date({ label: '申请日期', ...required }),
    external_use: Field.boolean({ label: '是否外带', defaultValue: false }),
    remarks: Field.textarea({ label: '备注' }),
  },
  searchableFields: ['title','code','company_name','applicant_name','seal_type','reason'],
  listViews: { all: { label: '全部', type: 'grid', columns: ['code','company_name','applicant_name','seal_type','title','reason','status','applied_on'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status','applied_on'] }, { fields: ['applicant_name','applied_on'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});

export const FixedAsset = ObjectSchema.create({
  name: 'forge_fixed_asset', label: '固定资产', pluralLabel: '固定资产', icon: 'box', sharingModel: 'private', nameField: 'title',
  fields: {
    title: Field.text({ label: '资产名称', maxLength: 200, ...required }), code: Field.text({ label: '资产编号', maxLength: 80, ...required }),
    category: Field.text({ label: '资产分类', maxLength: 100, ...required }), owner_name: Field.text({ label: '责任人', maxLength: 100 }), department: Field.text({ label: '部门', maxLength: 120 }),
    purchase_on: Field.date({ label: '购入日期' }), original_value: Field.currency({ label: '资产原值', precision: 18, scale: 2, min: 0 }), accumulated_depreciation: Field.currency({ label: '累计折旧', precision: 18, scale: 2, min: 0 }),
    residual_value: Field.currency({ label: '预计残值', precision: 18, scale: 2, min: 0 }), net_value: Field.currency({ label: '资产净值', precision: 18, scale: 2, min: 0 }), monthly_depreciation: Field.currency({ label: '月折旧额', precision: 18, scale: 2, min: 0 }),
    status: Field.select([option('in_use','在用'), option('idle','闲置'), option('repair','维修中'), option('scrapped','已报废')], { label: '状态', defaultValue: 'in_use', ...required }), remarks: Field.textarea({ label: '备注' }),
  },
  searchableFields: ['title','code','category','owner_name','department'], listViews: { all: { label: '全部', type: 'grid', columns: ['code','title','category','original_value','accumulated_depreciation','residual_value','net_value','monthly_depreciation','owner_name','department','status','purchase_on'] } },
  indexes: [{ fields: ['code'], unique: 'organization' }, { fields: ['status','department'] }, { fields: ['category','purchase_on'] }], enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: true },
});
