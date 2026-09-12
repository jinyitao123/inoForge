import { defineStack, type NavigationItemInput } from '@objectstack/spec';
import * as objects from './src/objects/index.js';
import * as actions from './src/actions/index.js';
import * as pages from './src/pages/index.js';

const object = (id: string, label: string, objectName: string, icon?: string) => ({
  id, type: 'object' as const, label, objectName, ...(icon ? { icon } : {}),
});

const group = (id: string, label: string, children: NavigationItemInput[], icon?: string) => ({
  id, type: 'group' as const, label, children, expanded: true, ...(icon ? { icon } : {}),
});

const page = (id: string, label: string, pageName: string, icon?: string) => ({
  id, type: 'page' as const, label, pageName, ...(icon ? { icon } : {}),
});

export default defineStack({
  manifest: {
    id: 'forge', namespace: 'forge', version: '0.1.0', type: 'app', name: 'Forge',
    engines: { protocol: '>=17.3.0 <18' },
  },
  objects: Object.values(objects),
  actions: Object.values(actions),
  pages: Object.values(pages),
  apps: [{
    name: 'forge', label: 'Forge', icon: 'factory', active: true, isDefault: true,
    // Keep RISEMAP's observed top-level information architecture. Empty areas
    // remain visible structure gaps and do not imply implemented capability.
    areas: [
      {
        id: 'workspace', label: '工作台', icon: 'layout-dashboard', navigation: [
          group('workspace_overview', '工作台', [
            page('workspace_recovery_status', '工作台复刻状态', 'page_workspace_recovery_status', 'layout-dashboard'),
          ]),
        ],
      },
      {
        id: 'supply_chain', label: '供应链', icon: 'boxes', navigation: [
          group('arrival_inspection', '到货检验', [
            object('purchase_arrival_notices', '到货通知', 'forge_purchase_arrival_notice', 'package-search'),
            page('purchase_receipts', '到货登记', 'page_purchase_arrival_workspace', 'package-check'),
            page('pending_inspections', '待检验库存', 'page_pending_inspection_workspace', 'clipboard-clock'),
            page('purchase_inspections', '检验单', 'page_purchase_inspection_workspace', 'clipboard-check'),
          ]),
          group('supply_master_data', '基础资料', [
            object('materials', '物料管理', 'forge_material', 'package'),
            page('bom_workspace', 'BOM管理', 'page_bom_workspace', 'git-branch'),
            object('suppliers', '供应商管理', 'forge_supplier', 'truck'),
            object('warehouses', '仓库管理', 'forge_warehouse', 'warehouse'),
          ]),
          group('purchase_management', '采购管理', [
            page('purchase_orders', '采购订单', 'page_purchase_order_workspace', 'shopping-cart'),
            page('purchase_returns', '采购退换货', 'page_purchase_return', 'rotate-ccw'),
          ]),
          group('inbound_management', '入库管理', [
            page('purchase_inbounds', '采购入库', 'page_purchase_inbound_workspace', 'package-plus'),
            object('opening_inbounds', '期初入库', 'forge_opening_inbound', 'package-plus'),
          ]),
          group('inventory_management', '库存管理', [
            object('inventory_balances', '库存总览', 'forge_inventory_balance', 'boxes'),
            object('inventory_ledgers', '库存流水', 'forge_inventory_ledger', 'book-open'),
          ]),
          group('outbound_management', '出库管理', [
            object('sales_outbounds', '出库单列表', 'forge_sales_outbound', 'truck'),
          ]),
        ],
      },
      {
        id: 'sales', label: '销售', icon: 'badge-dollar-sign', navigation: [
          group('sales_business', '销售业务', [
            object('sales_contracts', '框架销售合同', 'forge_sales_contract', 'scroll-text'),
            object('sales_orders', '销售订单', 'forge_sales_order', 'clipboard-list'),
            object('sales_shipments', '销售发货单', 'forge_sales_shipment', 'package-check'),
          ]),
          group('crm_customer_management', 'CRM客户管理', [
            object('customers', '客户管理', 'forge_customer', 'building-2'),
            object('contacts', '联系人管理', 'forge_contact', 'contact'),
            object('quotations', '销售报价', 'forge_quotation', 'file-text'),
          ]),
        ],
      },
      {
        id: 'production', label: '生产', icon: 'factory', navigation: [
          group('assembly_management', '组装业务管理', [
            page('assembly_orders', '组装单', 'page_production_assembly_workspace', 'factory'),
            page('assembly_shortages', '缺料待办', 'page_production_shortage_workspace', 'triangle-alert'),
            page('production_issues', '领料单', 'page_production_material_workspace', 'package-minus'),
            page('production_supplies', '补料单', 'page_production_supply_workspace', 'package-plus'),
            page('production_returns', '退料单', 'page_production_return_workspace', 'undo-2'),
            page('disassembly_orders', '拆解单', 'page_production_disassembly_workspace', 'unplug'),
            page('replacement_orders', '换件单', 'page_production_replacement_workspace', 'replace'),
          ]),
          group('drawing_management', '图纸管理', [
            page('drawing_workspace', '图纸管理', 'page_drawing_workspace', 'ruler'),
          ]),
          group('subcontract_management', '委外管理', [
            page('subcontract_workspace', '委外看板与订单', 'page_subcontract_workspace', 'layout-dashboard'),
            page('subcontract_issues', '委外发料', 'page_subcontract_issue_workspace', 'package-minus'),
            page('subcontract_receipts', '委外回厂', 'page_subcontract_receipt_workspace', 'package-check'),
            page('subcontract_ncr', '委外不合格处理', 'page_subcontract_ncr_workspace', 'triangle-alert'),
            page('subcontract_reconciliation', '委外对账', 'page_subcontract_reconciliation', 'file-check-2'),
            page('subcontract_reconciliation_report', '委外对账单', 'page_subcontract_reconciliation', 'file-check-2'),
            object('subcontract_suppliers', '委外供应商', 'forge_subcontract_supplier_profile', 'factory'),
            object('subcontract_stock', '委外库存', 'forge_subcontract_stock_balance', 'warehouse'),
          ]),
        ],
      },
      {
        id: 'project', label: '项目', icon: 'briefcase-business', navigation: [
          group('project_management', '项目管理', [
            object('projects', '项目中心', 'forge_project', 'briefcase-business'),
            page('project_plan_workspace', '任务管理', 'page_project_plan_workspace', 'calendar-range'),
            page('project_timesheet_cost', '工时管理', 'page_project_timesheet_cost', 'clock-3'),
            page('delivery_acceptance_workspace', '交付验收', 'page_delivery_acceptance_workspace', 'badge-check'),
            page('project_expense_cost', '项目费用与成本', 'page_project_expense_cost', 'hand-coins'),
          ]),
        ],
      },
      {
        id: 'administration', label: '行政', icon: 'building', navigation: [
          group('administration_overview', '行政', [
            page('administration_recovery_status', '行政复刻状态', 'page_administration_recovery_status', 'building'),
          ]),
        ],
      },
      {
        id: 'finance', label: '财务', icon: 'landmark', navigation: [
          group('fund_management', '资金管理', [
            page('bank_flow', '资金流水', 'page_bank_flow', 'landmark'),
            page('opening_balance', '期初往来账与对冲', 'page_opening_balance', 'book-open-check'),
            page('customer_prepayment', '收款管理', 'page_customer_prepayment', 'badge-dollar-sign'),
            page('purchase_payment', '付款管理', 'page_purchase_payment', 'send-horizontal'),
            page('refunds', '退款申请', 'page_supplier_refund', 'undo-2'),
          ]),
          group('business_confirmation', '业务确认', [
            page('revenue_recognition', '销售收入确认', 'page_revenue_recognition', 'badge-dollar-sign'),
          ]),
          group('invoice_management', '发票管理', [
            page('finance_adjustments', '财务冲销', 'page_invoice_reversal', 'receipt-text'),
            page('collection_settlement', '开票与结算', 'page_collection_settlement_workspace', 'wallet-cards'),
          ]),
          group('reconciliation_management', '对账单', [
            page('counterparty_reconciliation', '对账中心', 'page_counterparty_reconciliation', 'file-check-2'),
            page('bank_statement', '银行余额对账', 'page_bank_statement', 'file-check-2'),
          ]),
        ],
      },
      {
        id: 'reports', label: '报表', icon: 'chart-no-axes-combined', navigation: [
          group('business_reports', '报表', [
            page('project_operating_analysis', '项目经营分析', 'page_project_operating_analysis', 'chart-no-axes-combined'),
          ]),
        ],
      },
      {
        id: 'system', label: '系统', icon: 'settings', navigation: [
          group('material_settings', '商品管理', [
            object('material_skus', '规格与价格', 'forge_material_sku', 'boxes'),
            object('material_categories', '物料分类', 'forge_material_category', 'tags'),
            object('units', '计量单位', 'forge_unit', 'ruler'),
            object('supplier_categories', '供应商分类', 'forge_supplier_category', 'tags'),
            object('supplier_levels', '供应商级别', 'forge_supplier_level', 'star'),
          ]),
          group('customer_settings', '客户管理', [
            object('customer_categories', '客户分类', 'forge_customer_category', 'tags'),
            object('customer_levels', '客户级别', 'forge_customer_level', 'star'),
          ]),
          group('purchase_sales_settings', '采购销售', [
            object('quotation_types', '报价类型', 'forge_quotation_type', 'tags'),
            object('quotation_issuers', '报价主体', 'forge_quotation_issuer', 'landmark'),
            object('contract_types', '合同类型', 'forge_contract_type', 'tags'),
          ]),
          group('inventory_settings', '库存管理', [
            object('warehouse_types', '仓库类型', 'forge_warehouse_type', 'warehouse'),
          ]),
          group('project_settings', '项目管理', [
            object('project_types', '项目类型', 'forge_project_type', 'tags'),
          ]),
        ],
      },
    ],
  }],
});
