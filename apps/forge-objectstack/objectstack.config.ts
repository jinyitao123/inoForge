import { defineStack } from '@objectstack/spec';
import * as objects from './src/objects/index.js';
import * as actions from './src/actions/index.js';

const object = (id: string, label: string, objectName: string, icon?: string) => ({
  id, type: 'object' as const, label, objectName, ...(icon ? { icon } : {}),
});

const group = (id: string, label: string, children: ReturnType<typeof object>[], icon?: string) => ({
  id, type: 'group' as const, label, children, expanded: true, ...(icon ? { icon } : {}),
});

export default defineStack({
  manifest: {
    id: 'forge', namespace: 'forge', version: '0.1.0', type: 'app', name: 'Forge',
    engines: { protocol: '>=17.3.0 <18' },
  },
  objects: Object.values(objects),
  actions: Object.values(actions),
  apps: [{
    name: 'forge', label: 'Forge', icon: 'factory', active: true, isDefault: true,
    areas: [
      {
        id: 'customer_sales', label: '客户与销售', icon: 'handshake',
        navigation: [
          group('sales_transactions', '销售业务', [
            object('quotations', '销售报价', 'forge_quotation', 'file-text'),
            object('sales_contracts', '框架销售合同', 'forge_sales_contract', 'scroll-text'),
            object('sales_orders', '销售订单', 'forge_sales_order', 'clipboard-list'),
            object('sales_shipments', '销售发货单', 'forge_sales_shipment', 'package-check'),
            object('sales_outbounds', '销售出库单', 'forge_sales_outbound', 'truck'),
            object('sales_invoices', '销售发票', 'forge_sales_invoice', 'receipt-text'),
            object('accounts_receivable', '应收账款', 'forge_accounts_receivable', 'wallet-cards'),
          ]),
          group('customer_records', '客户档案', [
            object('customers', '客户', 'forge_customer', 'building-2'),
            object('contacts', '联系人', 'forge_contact', 'contact'),
            object('contact_channels', '联系方式', 'forge_contact_channel', 'phone'),
          ]),
          group('customer_settings', '客户配置', [
            object('customer_categories', '客户分类', 'forge_customer_category'),
            object('customer_levels', '客户级别', 'forge_customer_level'),
            object('quotation_types', '报价类型', 'forge_quotation_type'),
            object('quotation_issuers', '报价主体', 'forge_quotation_issuer', 'landmark'),
            object('contract_types', '合同类型', 'forge_contract_type'),
          ]),
        ],
      },
      {
        id: 'procurement_supply', label: '采购与供应', icon: 'shopping-cart',
        navigation: [
          group('purchase_transactions', '采购业务', [
            object('purchase_orders', '采购订单', 'forge_purchase_order', 'shopping-cart'),
            object('purchase_arrival_notices', '到货通知', 'forge_purchase_arrival_notice', 'package-search'),
            object('purchase_receipts', '到货登记', 'forge_purchase_receipt', 'package-check'),
            object('purchase_inspections', '采购检验单', 'forge_purchase_inspection', 'clipboard-check'),
            object('purchase_inbounds', '采购入库', 'forge_purchase_inbound', 'package-plus'),
          ]),
          group('supplier_records', '供应商档案', [
            object('suppliers', '供应商', 'forge_supplier', 'truck'),
            object('supplier_banks', '银行账户', 'forge_supplier_bank_account', 'landmark'),
          ]),
          group('supplier_settings', '供应商配置', [
            object('supplier_categories', '供应商分类', 'forge_supplier_category'),
            object('supplier_levels', '供应商级别', 'forge_supplier_level'),
          ]),
        ],
      },
      {
        id: 'material_inventory', label: '物料与库存', icon: 'warehouse',
        navigation: [
          group('material_records', '物料资料', [
            object('materials', '物料', 'forge_material', 'package'),
            object('material_skus', '规格与价格', 'forge_material_sku', 'boxes'),
          ]),
          group('warehouse_records', '仓库资料', [
            object('warehouses', '仓库', 'forge_warehouse', 'warehouse'),
            object('opening_inbounds', '期初入库', 'forge_opening_inbound', 'package-plus'),
            object('inventory_balances', '库存余额', 'forge_inventory_balance', 'boxes'),
            object('inventory_ledgers', '库存流水', 'forge_inventory_ledger', 'book-open'),
          ]),
          group('material_settings', '基础配置', [
            object('material_categories', '物料分类', 'forge_material_category'),
            object('units', '计量单位', 'forge_unit'),
            object('warehouse_types', '仓库类型', 'forge_warehouse_type'),
          ]),
        ],
      },
      {
        id: 'production_bom', label: '生产与 BOM', icon: 'factory',
        navigation: [
          group('bom_records', 'BOM 管理', [
            object('boms', 'BOM', 'forge_bom', 'git-branch'),
            object('bom_nodes', 'BOM 结构明细', 'forge_bom_node', 'network'),
          ]),
        ],
      },
    ],
  }],
});
