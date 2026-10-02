import { defineView } from '@objectstack/spec';

const data = { provider: 'object' as const, object: 'forge_sales_lead' };

export const SalesLeadViews = defineView({
  object: 'forge_sales_lead',
  list: {
    label: '线索列表', type: 'grid', data,
    columns: [
      { field: 'code', width: 180, link: true },
      { field: 'company_name', width: 260 },
      { field: 'contact_name', width: 130 },
      { field: 'phone', width: 150 },
      { field: 'status', width: 110 },
      { field: 'source', width: 160 },
      { field: 'responsible_id', width: 150 },
    ],
    searchableFields: ['code', 'company_name', 'contact_name', 'phone'],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 20 },
    selection: { type: 'none' },
    userFilters: {
      element: 'dropdown',
      fields: [{ field: 'status', type: 'select' }, { field: 'source', type: 'text' }],
    },
    userActions: { editInline: false, group: false, hideFields: true },
  },
  form: {
    type: 'simple', data, columns: 2,
    sections: [
      { name: 'lead_information', label: '线索信息', columns: 2,
        fields: ['name', 'code', { field: 'company_name', span: 'full' }, 'contact_name', 'phone', 'source', 'responsible_id', { field: 'remarks', span: 'full' }] },
    ],
  },
});
