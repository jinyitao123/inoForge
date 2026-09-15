import { Field } from '@objectstack/spec/data';
import { master, text, reference, choice, owner, remarks, money } from '../model.js';

// Source: DP008/2068 form and DP008/2069 saved list.
export const Customer = master('forge_customer', '客户管理', 'building-2', {
  name: text('客户名称', true), customer_type: choice('客户类型', ['企业', '个人'], '企业'),
  credit_code: text('统一社会信用代码'), legal_representative: text('法定代表人'),
  registered_capital: text('注册资金'), established_on: Field.date({ label: '成立日期' }),
  enterprise_scale: text('企业规模'), website: Field.url({ label: '公司网站' }), business_scope: Field.textarea({ label: '经营范围' }),
  category_id: reference('forge_customer_category', '客户分类', true), level_id: reference('forge_customer_level', '客户级别'),
  industry: text('行业'), responsible_id: owner(), description: Field.textarea({ label: '客户描述' }),
  invoice_type: text('发票类型'), tax_number: text('纳税人识别号'), bank_name: text('开户银行'), bank_account: text('银行账号'),
  invoice_address: text('开票地址'), invoice_phone: text('开票电话'),
  payment_term: text('默认付款条件'), revenue_recognition: text('收入确认方式'),
  credit_limit: money('信用额度'), payment_days: Field.number({ label: '账期天数', defaultValue: 30 }),
  credit_status: Field.select([{ value: 'active', label: '正常' }, { value: 'frozen', label: '已冻结' }], { label: '授信状态', defaultValue: 'active' }),
  address: text('详细地址'), province: text('省份'), city: text('城市'), remarks: remarks(),
}, ['name', 'responsible_id', 'category_id', 'level_id', 'credit_limit', 'payment_days']);

export const Contact = master('forge_contact', '联系人管理', 'contact', {
  name: text('姓名', true), customer_id: reference('forge_customer', '客户', true),
  is_primary: Field.boolean({ label: '主要联系人', defaultValue: false }), job_title: text('职位'), department: text('部门'),
  gender: text('性别'), decision_weight: text('决策权重'), remarks: remarks(),
}, ['name', 'customer_id', 'is_primary', 'job_title', 'department']);

export const ContactChannel = master('forge_contact_channel', '联系人联系方式', 'phone', {
  name: text('标签', true), contact_id: reference('forge_contact', '联系人', true),
  channel_type: choice('类型', ['手机', '座机', '邮箱'], '手机'), value: text('联系方式', true),
}, ['contact_id', 'channel_type', 'name', 'value']);
