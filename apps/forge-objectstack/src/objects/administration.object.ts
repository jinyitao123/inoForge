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
