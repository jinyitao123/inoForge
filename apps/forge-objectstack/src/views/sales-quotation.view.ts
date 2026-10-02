import { defineView } from '@objectstack/spec';

/** RISEMAP column geometry; source fields and authorization remain Forge metadata. */
export const SalesQuotationViews = defineView({
  object: 'forge_quotation',
  list: {
    label: '报价列表', type: 'grid', data: { provider: 'object', object: 'forge_quotation' },
    columns: [
      { field: 'code', width: 181, link: true },
      { field: 'customer_id', width: 195 },
      { field: 'opportunity_id', width: 140 },
      { field: 'created_by', width: 80 },
      { field: 'responsible_id', width: 106 },
      { field: 'item_count', width: 80 },
      { field: 'total_amount', label: '报价金额', width: 120, align: 'right' },
      { field: 'overall_discount_label', width: 70, sortable: false },
      { field: 'status', label: '审批状态', width: 90 },
      { field: 'valid_until', label: '有效期', width: 107 },
      { field: 'created_at', label: '创建日期', width: 163 },
    ],
    searchableFields: ['code', 'name', 'customer_name', 'opportunity_name'],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 20 }, selection: { type: 'none' },
    userFilters: { element: 'dropdown', fields: [{ field: 'responsible_id' }, { field: 'status' }] },
    userActions: { editInline: false, group: false, hideFields: true },
  },
});
