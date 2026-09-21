import { Field, ObjectSchema } from '@objectstack/spec/data';
import { required } from '../model.js';

export const BusinessSettingOption = ObjectSchema.create({
  name: 'forge_business_setting_option',
  label: '业务设置项',
  pluralLabel: '业务设置项',
  description: '财务、行政、人事及其他业务模块共用的可维护设置项',
  icon: 'sliders-horizontal',
  sharingModel: 'public_read_write',
  nameField: 'name',
  searchableFields: ['name', 'code', 'scope', 'setting_type', 'description'],
  fields: {
    name: Field.text({ label: '名称', maxLength: 120, ...required }),
    code: Field.text({ label: '编码', maxLength: 100, ...required }),
    scope: Field.text({ label: '业务范围', maxLength: 80, ...required }),
    setting_type: Field.text({ label: '设置类型', maxLength: 80, ...required }),
    parent_code: Field.text({ label: '上级编码', maxLength: 100 }),
    description: Field.textarea({ label: '说明', maxLength: 500 }),
    enabled: Field.boolean({ label: '启用', defaultValue: true }),
    system_record: Field.boolean({ label: '系统预置', defaultValue: false }),
    sort_order: Field.number({ label: '排序', min: 0, scale: 0, defaultValue: 100 }),
  },
  listViews: {
    all: { label: '全部设置项', type: 'grid', columns: ['name', 'code', 'scope', 'setting_type', 'parent_code', 'enabled', 'sort_order'] },
  },
  indexes: [
    { fields: ['scope', 'setting_type', 'sort_order'] },
    { fields: ['code'], unique: 'organization' },
  ],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: false },
});

export const MeetingRoom = ObjectSchema.create({
  name: 'forge_meeting_room',
  label: '会议室',
  pluralLabel: '会议室',
  description: '行政日程预约使用的会议室主数据',
  icon: 'map-pin',
  sharingModel: 'public_read_write',
  nameField: 'name',
  searchableFields: ['name', 'location', 'description'],
  fields: {
    name: Field.text({ label: '会议室名称', maxLength: 120, ...required }),
    location: Field.text({ label: '位置', maxLength: 200, ...required }),
    capacity: Field.number({ label: '容量', min: 1, scale: 0, ...required }),
    enabled: Field.boolean({ label: '启用', defaultValue: true }),
    description: Field.textarea({ label: '备注', maxLength: 500 }),
  },
  listViews: { all: { label: '全部会议室', type: 'grid', columns: ['name', 'location', 'capacity', 'enabled'] } },
  indexes: [{ fields: ['name'], unique: 'organization' }, { fields: ['enabled', 'capacity'] }],
  enable: { apiEnabled: true, searchable: true, trackHistory: true, feeds: false, activities: false },
});
