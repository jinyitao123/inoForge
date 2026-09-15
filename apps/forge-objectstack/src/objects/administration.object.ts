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
