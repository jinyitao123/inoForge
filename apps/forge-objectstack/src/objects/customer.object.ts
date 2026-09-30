import { Field, ObjectSchema } from '@objectstack/spec/data';
import { master, text, reference, choice, owner, remarks, code } from '../model.js';

// Source: DP008/2068 form and DP008/2069 saved list.
export const Customer = ObjectSchema.create({
  name: 'forge_customer', label: '客户管理', pluralLabel: '客户管理', icon: 'building-2', sharingModel: 'private',
  fieldGroups: [
    { key: 'company', label: '工商信息', collapse: 'expanded' },
    { key: 'profile', label: '客户资料', collapse: 'expanded' },
    { key: 'invoicing', label: '开票信息', collapse: 'expanded' },
    { key: 'commercial', label: '商务条件', collapse: 'expanded' },
    { key: 'address', label: '商务信息', collapse: 'expanded' },
  ],
  fields: {
    name: { ...text('客户名称', true), group: 'company' },
    customer_type: { ...choice('客户类型', ['企业', '个人'], '企业'), group: 'company' },
    credit_code: { ...text('统一社会信用代码'), group: 'company' },
    legal_representative: { ...text('法定代表人'), group: 'company' },
    registered_capital: { ...text('注册资金'), group: 'company' },
    established_on: { ...Field.date({ label: '成立日期' }), group: 'company' },
    enterprise_scale: { ...text('企业规模'), group: 'company' },
    website: { ...Field.url({ label: '公司网站' }), group: 'company' },
    business_scope: { ...Field.textarea({ label: '经营范围' }), group: 'company' },
    category_id: { ...reference('forge_customer_category', '客户分类', true), group: 'profile' },
    level_id: { ...reference('forge_customer_level', '客户级别'), group: 'profile' },
    industry: { ...text('行业'), group: 'profile' },
    responsible_id: { ...Field.user({ label: '负责人', defaultValue: 'current_user' }), group: 'profile' },
    description: { ...Field.textarea({ label: '客户描述' }), group: 'profile' },
    invoice_type: { ...text('发票类型'), group: 'invoicing' },
    tax_number: { ...text('纳税人识别号'), group: 'invoicing' },
    bank_name: { ...text('开户银行'), group: 'invoicing' },
    bank_account: { ...text('银行账号'), group: 'invoicing' },
    invoice_address: { ...text('开票地址'), group: 'invoicing' },
    invoice_phone: { ...text('开票电话'), group: 'invoicing' },
    payment_term: { ...text('默认付款条件'), group: 'commercial' },
    revenue_recognition: { ...text('收入确认方式'), group: 'commercial' },
    credit_limit: { ...Field.currency({ label: '信用额度', precision: 18, scale: 2, min: 0, defaultValue: 0 }), group: 'commercial' },
    payment_days: { ...Field.number({ label: '账期天数', defaultValue: 30 }), group: 'commercial' },
    credit_status: { ...Field.select([{ value: 'active', label: '正常' }, { value: 'frozen', label: '已冻结' }], { label: '授信状态', defaultValue: 'active' }), group: 'commercial' },
    address: { ...text('详细地址'), group: 'address' },
    province: { ...text('省份'), group: 'address' },
    city: { ...text('城市'), group: 'address' },
    remarks: { ...remarks(), group: 'address' },
  },
  nameField: 'name',
  listViews: { all: {
    label: '全部', type: 'grid',
    columns: [
      { field: 'name', link: true, width: 240, pinned: 'left' },
      { field: 'responsible_id', width: 150 },
      { field: 'category_id', width: 150 },
      { field: 'level_id', width: 130 },
      { field: 'credit_limit', width: 140 },
      { field: 'payment_days', width: 120 },
    ],
    searchableFields: ['name'],
    pagination: { pageSize: 20 },
    selection: { type: 'multiple' },
    rowHeight: 'extra_tall',
  } },
  enable: { apiEnabled: true, searchable: true, trackHistory: true },
});

// RISEMAP /base/customers: “标签与团队 → 团队成员” and the
// “我参与的 / 下属参与的” customer-owner scopes.
export const CustomerTeamMember = master('forge_customer_team_member', '客户团队成员', 'users', {
  name: text('成员名称', true), membership_key: code('成员关系键'),
  customer_id: { ...reference('forge_customer', '客户', true), relatedList: false }, user_id: Field.user({ label: '团队成员', required: true, storage: { notNull: true } }),
  member_duty: Field.select([{ value: 'collaborator', label: '协同销售' }], { label: '成员职责', defaultValue: 'collaborator' }),
  active: Field.boolean({ label: '有效成员', defaultValue: true }), remarks: remarks(),
}, ['customer_id', 'user_id', 'member_duty', 'active']);

export const Contact = master('forge_contact', '联系人管理', 'contact', {
  name: text('姓名', true), customer_id: { ...reference('forge_customer', '客户', true), relatedList: true, relatedListTitle: '联系人', relatedListColumns: ["name", "is_primary", "job_title", "department", "employment_status"] },
  is_primary: Field.boolean({ label: '主要联系人', defaultValue: false }), job_title: text('职位'), department: text('部门'),
  // Retain stored text values while declaring the choices for the shared widget.
  gender: { ...text('性别'), widget: 'declared-label-select', options: [
    { value: 'male', label: '男' }, { value: 'female', label: '女' },
  ] },
  decision_weight: { ...text('决策权重'), widget: 'declared-label-select', options: [
    { value: 'price', label: '价格' }, { value: 'delivery', label: '交期' },
    { value: 'quality', label: '质量' }, { value: 'service', label: '服务' },
    { value: 'brand', label: '品牌' }, { value: 'payment_terms', label: '付款条件' },
  ] },
  employment_status: Field.select([
    { value: 'active', label: '在职' }, { value: 'transferred', label: '已跳槽' },
    { value: 'resigned', label: '已离职' }, { value: 'retired', label: '已退休' },
    { value: 'inactive', label: '停用' },
  ], { label: '任职状态', defaultValue: 'active' }),
  responsible_id: owner(), remarks: remarks(),
}, ['name', 'customer_id', 'is_primary', 'job_title', 'department', 'employment_status', 'responsible_id']);

export const ContactChannel = master('forge_contact_channel', '联系人联系方式', 'phone', {
  name: text('标签', true), contact_id: reference('forge_contact', '联系人', true),
  channel_type: Field.select([
    { value: 'mobile', label: '手机' }, { value: 'telephone', label: '座机' },
    { value: 'email', label: '邮箱' }, { value: 'wechat', label: '微信' },
    { value: 'dingtalk', label: '钉钉' }, { value: 'qq', label: 'QQ' },
    { value: 'linkedin', label: 'LinkedIn' }, { value: 'other', label: '其他' },
  ], { label: '类型', defaultValue: 'mobile' }),
  value: text('联系方式', true), is_primary: Field.boolean({ label: '主要联系方式', defaultValue: false }),
}, ['contact_id', 'channel_type', 'name', 'value', 'is_primary']);
