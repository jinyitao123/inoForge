import { defineView } from '@objectstack/spec';

/** Read-oriented order and line views over the canonical procurement objects. */
export const PurchaseOrderViews = defineView({
  object: 'forge_purchase_order',
  form: {
    type: 'simple',
    data: { provider: 'object', object: 'forge_purchase_order' },
    columns: 3,
    sections: [
      {
        name: 'source',
        label: '采购来源',
        columns: 3,
        fields: ['source_type'],
      },
      {
        name: 'purchase_information',
        label: '采购信息',
        columns: 3,
        fields: [
          'code', 'supplier_id', 'warehouse_id', 'expected_arrival_on',
          'payment_term', 'payment_method', 'remarks',
        ],
      },
    ],
  },
  list: {
    label: '订单列表',
    type: 'grid',
    data: { provider: 'object', object: 'forge_purchase_order' },
    columns: [
      { field: 'code', label: '订单号', link: true, width: 180, pinned: 'left' },
      { field: 'supplier_id', label: '供应商', width: 180 },
      { field: 'supplier_order_number', label: '供应商单号', width: 150 },
      { field: 'expected_arrival_on', label: '期望到货', width: 125 },
      { field: 'warehouse_id', label: '仓库', width: 150 },
      { field: 'payment_term', label: '付款条件', width: 150 },
      { field: 'responsible_id', label: '采购员', width: 150 },
      { field: 'total_amount', label: '订单金额', width: 145 },
      { field: 'status', label: '状态', width: 125 },
    ],
    searchableFields: ['code', 'name', 'supplier_order_number'],
    sort: [{ field: 'created_at', order: 'desc' }],
    pagination: { pageSize: 20 },
    rowHeight: 'extra_tall',
  },
});

export const PurchaseOrderLineViews = defineView({
  object: 'forge_purchase_order_line',
  list: {
    label: '订单明细',
    type: 'grid',
    data: { provider: 'object', object: 'forge_purchase_order_line' },
    columns: [
      { field: 'order_id', label: '采购订单', link: true, width: 180, pinned: 'left' },
      { field: 'item_code', label: '物料编码', width: 150 },
      { field: 'name', label: '物料名称', width: 220 },
      { field: 'model', label: '型号', width: 150 },
      { field: 'quantity', label: '数量', width: 100 },
      { field: 'taxed_unit_price', label: '含税单价', width: 135 },
      { field: 'tax_rate', label: '税率', width: 95 },
      { field: 'taxed_subtotal', label: '含税小计', width: 145 },
    ],
    searchableFields: ['name', 'item_code', 'model'],
    pagination: { pageSize: 20 },
    rowHeight: 'tall',
  },
});
