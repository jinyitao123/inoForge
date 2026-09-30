import { defineDataset } from '@objectstack/spec/ui';

/** Governed purchase-order facts for reports; row security follows the object. */
export const PurchaseOrderMetrics = defineDataset({
  name: 'forge_purchase_order_metrics',
  label: '采购订单指标',
  object: 'forge_purchase_order',
  dimensions: [
    { name: 'order_status', label: '订单状态', field: 'status', type: 'string' },
    { name: 'order_month', label: '下单月份', field: 'order_on', type: 'date', dateGranularity: 'month' },
    { name: 'supplier', label: '供应商', field: 'supplier_id', type: 'lookup' },
  ],
  measures: [
    { name: 'order_count', label: '采购订单数', aggregate: 'count' },
    { name: 'order_amount', label: '采购额', field: 'total_amount', aggregate: 'sum', currency: 'CNY' },
  ],
});
