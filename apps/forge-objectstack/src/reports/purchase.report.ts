import { defineReport } from '@objectstack/spec/ui';

/** First native report sample; inbound, payable and quality facts remain separate. */
export const PurchaseOrderSummary = defineReport({
  name: 'forge_purchase_order_summary',
  label: '采购订单统计',
  type: 'summary',
  dataset: 'forge_purchase_order_metrics',
  rows: ['order_status'],
  values: ['order_count', 'order_amount'],
  chart: { type: 'bar', xAxis: 'order_status', yAxis: 'order_amount' },
});
