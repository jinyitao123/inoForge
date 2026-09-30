import { defineView } from '@objectstack/spec';

const data = { provider: 'object' as const, object: 'forge_project' };

export const projectGridColumns = [
  { field: 'name', label: '项目名称', link: true, width: 260, pinned: 'left' as const },
  { field: 'customer_id', label: '客户名称', width: 200 },
  { field: 'manager_id', label: '项目经理', width: 150 },
  { field: 'planned_start_on', label: '开始日期', width: 120 },
  { field: 'planned_end_on', label: '结束日期', width: 120 },
  { field: 'progress', label: '项目进度', width: 120 },
  { field: 'expected_revenue', label: '预计营收', width: 140 },
  { field: 'budget_amount', label: '预算金额', width: 140 },
  { field: 'status', label: '状态', width: 110 },
];
export const projectGanttColumns = ['name', 'manager_id', 'status'];

/**
 * The project list and timeline share the same governed object. The view only
 * describes presentation; project lifecycle and permissions stay on the object
 * and its business actions.
 */
export const ProjectViews = defineView({
  object: 'forge_project',
  list: {
    label: '项目列表',
    type: 'grid',
    data,
    columns: projectGridColumns,
    searchableFields: ['name', 'code'],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 20 },
    selection: { type: 'multiple' },
    rowHeight: 'extra_tall',
  },
  listViews: {
    timeline: {
      label: '甘特图',
      type: 'gantt',
      data,
      columns: projectGanttColumns,
      gantt: {
        startDateField: 'planned_start_on',
        endDateField: 'planned_end_on',
        titleField: 'name',
        progressField: 'progress',
      },
      searchableFields: ['name', 'code'],
      pagination: { pageSize: 20 },
    },
  },
});
