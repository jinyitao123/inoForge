import { defineView } from '@objectstack/spec';

/** Curated presentation; field types, defaults, validation and access remain on the object. */
export const CustomerViews = defineView({
  object: 'forge_customer',
  form: {
    type: 'simple',
    data: { provider: 'object', object: 'forge_customer' },
    columns: 4,
    sections: [
      { columns: 4, fields: ['customer_type'] },
      {
        name: 'company', label: '工商信息', columns: 4, collapsible: true,
        fields: [
          { field: 'name', colSpan: 2 }, 'credit_code', 'legal_representative',
          'registered_capital', 'established_on', 'enterprise_scale', 'website',
          { field: 'business_scope', span: 'full' },
        ],
      },
      {
        name: 'profile', label: '客户资料', columns: 4, collapsible: true,
        fields: ['category_id', 'level_id', 'industry', 'responsible_id', { field: 'description', span: 'full' }],
      },
      {
        name: 'invoicing', label: '开票信息', columns: 4, collapsible: true,
        fields: ['invoice_type', 'tax_number', 'bank_name', 'bank_account', { field: 'invoice_address', colSpan: 2 }, 'invoice_phone'],
      },
      {
        name: 'commercial', label: '商务条件', columns: 4, collapsible: true,
        fields: ['payment_term', 'revenue_recognition', 'credit_limit', 'payment_days', 'credit_status'],
      },
      {
        name: 'address', label: '商务信息', columns: 4, collapsible: true,
        fields: [{ field: 'address', colSpan: 2 }, 'province', 'city', { field: 'remarks', span: 'full' }],
      },
    ],
  },
});

/** Contact storage and lifecycle stay on Contact; this view selects its compact editor. */
export const ContactViews = defineView({
  object: 'forge_contact',
  list: {
    type: 'grid', data: { provider: 'object', object: 'forge_contact' },
    columns: [
      { field: 'name', label: '联系人', width: 210, link: true },
      { field: 'gender', label: '性别', width: 70 },
      { field: 'job_title', label: '职位 / 部门', width: 170 },
      { field: 'customer_id', label: '所属公司', width: 220 },
      { field: 'employment_status', label: '任职状态', width: 110 },
      { field: 'decision_weight', label: '决策权重', width: 110 },
      { field: 'channel_summary', label: '联系方式', width: 190 },
      { field: 'responsible_id', label: '维护人', width: 100 },
    ],
    searchableFields: ['name','customer_name','current_company_name','job_title','department','channel_summary'],
    sort: [{ field: 'created_at', order: 'desc' }], pagination: { pageSize: 20 },
  },
  formViews: {
    profile: {
      type: 'simple',
      data: { provider: 'object', object: 'forge_contact' }, columns: 2,
      sections: [
        { columns: 2, fields: ['name', 'gender', 'customer_id', 'department', 'job_title', 'decision_weight', 'responsible_id', 'employment_status', { field: 'is_primary', widget: 'checkbox', span: 'full' }] },
        { columns: 1, fields: ['remarks'] },
      ],
    },
  },
  form: {
    type: 'simple',
    data: { provider: 'object', object: 'forge_contact' },
    columns: 4,
    sections: [
      { name: 'contact_context', label: '所属客户与任职', columns: 4,
        fields: ['customer_id', 'is_primary', 'employment_status', 'responsible_id'] },
      { name: 'contact_information', label: '联系人信息', columns: 4,
        fields: [
          'name', 'job_title', 'gender', 'department', 'decision_weight',
          { field: 'remarks', widget: 'input', colSpan: 3 },
        ] },
    ],
  },
});
