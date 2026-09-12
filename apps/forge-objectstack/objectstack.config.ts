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
  manifest: { id: 'forge', namespace: 'forge', version: '0.1.0', type: 'app', name: 'Forge', engines: { protocol: '>=17.3.0 <18' } },
  objects: Object.values(objects), actions: Object.values(actions), pages: Object.values(pages),
  apps: [{
    name: 'forge', label: 'Forge', icon: 'factory', active: true, isDefault: true,
    areas: [
      {
        id: 'workbench', label: '工作台', icon: 'layout-dashboard',
        navigation: [
          group('workbench_tasks', '工作台', [
            page('workbench_subcontract_tasks', '委外待办', 'page_subcontract_dashboard', 'factory'),
            page('workbench_project_tasks', '项目任务', 'page_project_plan_workspace', 'list-checks'),
          ]),
          group('workbench_guides', '引导与指南', [
            page('workbench_subcontract_guide', '委外管理上手指南', 'page_subcontract_guide', 'circle-help'),
          ]),
        ],
      },
      {
        id: 'supply_chain', label: '供应链', icon: 'boxes',
        navigation: [
          group('arrival_inspection', '到货检验', [
            object('arrival_notices', '到货通知', 'forge_purchase_arrival_notice', 'package-search'),
            page('arrival_registration', '到货登记', 'page_purchase_arrival_workspace', 'package-check'),
            page('pending_inspection', '待检验库存', 'page_pending_inspection_workspace', 'clipboard-clock'),
            page('inspection_orders', '检验单', 'page_purchase_inspection_workspace', 'clipboard-check'),
          ]),
          group('base_records', '基础资料', [
            object('materials', '物料管理', 'forge_material', 'package'),
            page('bom', 'BOM管理', 'page_bom_workspace', 'git-branch'),
            object('suppliers', '供应商管理', 'forge_supplier', 'truck'),
            object('warehouses', '仓库管理', 'forge_warehouse', 'warehouse'),
          ]),
          group('purchasing', '采购管理', [
            page('purchase_orders', '采购订单', 'page_purchase_order_workspace', 'shopping-cart'),
            page('purchase_returns', '采购退换货', 'page_purchase_return', 'rotate-ccw'),
          ]),
          group('inbound_management', '入库管理', [
            page('purchase_inbound', '采购入库', 'page_purchase_inbound_workspace', 'package-plus'),
            object('opening_inbound', '期初入库', 'forge_opening_inbound', 'package-plus'),
          ]),
          group('inventory_management', '库存管理', [
            page('inventory_ncr', '不合格处理', 'page_subcontract_ncr_workspace', 'triangle-alert'),
            object('inventory_balances', '库存余额', 'forge_inventory_balance', 'boxes'),
            object('inventory_flow', '库存流水', 'forge_inventory_ledger', 'book-open'),
          ]),
          group('outbound_management', '出库管理', [
            object('sales_outbound', '销售直接出库', 'forge_sales_outbound', 'truck'),
          ]),
        ],
      },
      {
        id: 'sales', label: '销售', icon: 'trending-up',
        navigation: [
          group('sales_operations', '销售业务', [
            object('sales_contracts', '框架销售合同', 'forge_sales_contract', 'scroll-text'),
            object('sales_orders', '销售订单', 'forge_sales_order', 'clipboard-list'),
            object('sales_shipments', '销售发货单', 'forge_sales_shipment', 'package-check'),
            page('collection_flow', '收款流水', 'page_customer_prepayment', 'badge-dollar-sign'),
          ]),
          group('crm', 'CRM客户管理', [
            object('customers', '客户管理', 'forge_customer', 'building-2'),
            object('contacts', '联系人管理', 'forge_contact', 'contact'),
            object('quotations', '销售报价', 'forge_quotation', 'file-text'),
          ]),
        ],
      },
      {
        id: 'production', label: '生产', icon: 'factory',
        navigation: [
          group('assembly', '组装业务管理', [
            page('assembly_orders', '组装单', 'page_production_assembly_workspace', 'factory'),
            page('assembly_shortages', '缺料待办', 'page_production_shortage_workspace', 'triangle-alert'),
            page('production_issues', '领料单', 'page_production_material_workspace', 'package-minus'),
            page('production_supplies', '补料单', 'page_production_supply_workspace', 'package-plus'),
            page('production_returns', '退料单', 'page_production_return_workspace', 'undo-2'),
            page('disassembly_orders', '拆解单', 'page_production_disassembly_workspace', 'unplug'),
            page('replacement_orders', '换件单', 'page_production_replacement_workspace', 'replace'),
          ]),
          group('drawings', '图纸管理', [
            page('drawing_workspace', '图纸总览与业务办理', 'page_drawing_workspace', 'ruler'),
          ]),
          group('subcontracting', '委外管理', [
            page('subcontract_guide', '委外管理上手指南', 'page_subcontract_guide', 'circle-help'),
            page('subcontract_dashboard', '委外看板', 'page_subcontract_dashboard', 'layout-dashboard'),
            page('subcontract_orders', '委外订单', 'page_subcontract_orders', 'clipboard-list'),
            page('subcontract_issues', '委外发料', 'page_subcontract_issue_workspace', 'package-minus'),
            page('subcontract_receipts', '委外回厂', 'page_subcontract_receipt_workspace', 'package-check'),
            page('subcontract_returns', '委外退料', 'page_subcontract_returns', 'undo-2'),
            page('subcontract_reconciliation', '委外对账', 'page_subcontract_reconciliation', 'file-check-2'),
            page('subcontract_suppliers', '委外供应商', 'page_subcontract_suppliers', 'factory'),
            page('subcontract_stock', '委外库存', 'page_subcontract_stock', 'warehouse'),
            page('subcontract_trace', '批次追溯', 'page_subcontract_trace', 'scan-search'),
            page('subcontract_undelivered', '委外未交', 'page_subcontract_undelivered', 'clock-alert'),
            page('subcontract_receipts_report', '委外进货', 'page_subcontract_receipts_report', 'chart-no-axes-column'),
            page('subcontract_statement', '委外对账单', 'page_subcontract_statement_report', 'receipt-text'),
          ]),
        ],
      },
      {
        id: 'projects', label: '项目', icon: 'briefcase-business',
        navigation: [
          group('project_management', '项目管理', [
            object('project_center', '项目中心', 'forge_project', 'briefcase-business'),
            page('project_tasks', '任务管理', 'page_project_plan_workspace', 'list-checks'),
            page('project_timesheet', '工时管理', 'page_project_timesheet_cost', 'clock-3'),
            page('project_expenses', '项目费用', 'page_project_expense_cost', 'hand-coins'),
            page('project_delivery', '交付与验收 · Forge 扩展', 'page_delivery_acceptance_workspace', 'badge-check'),
          ]),
        ],
      },
      {
        id: 'administration', label: '行政', icon: 'users',
        navigation: [group('administration_scope', '当前恢复范围', [page('administration_status', '行政功能范围', 'page_administration_scope', 'users')])],
      },
      {
        id: 'finance', label: '财务', icon: 'wallet-cards',
        navigation: [
          group('funds', '资金管理', [
            page('bank_flow', '资金流水', 'page_bank_flow', 'landmark'),
            page('collections', '收款管理', 'page_customer_prepayment', 'badge-dollar-sign'),
            page('payments', '付款管理', 'page_purchase_payment', 'send-horizontal'),
            page('refunds', '退款申请', 'page_supplier_refund', 'undo-2'),
            page('bank_statement', '银行文件与余额对账', 'page_bank_statement', 'file-check-2'),
          ]),
          group('business_confirmation', '业务确认', [
            page('revenue_recognition', '销售收入确认', 'page_revenue_recognition', 'badge-dollar-sign'),
            page('counterparty_reconciliation', '对账单', 'page_counterparty_reconciliation', 'file-check-2'),
            page('finance_adjustments', '调整与冲销', 'page_invoice_reversal', 'undo-2'),
          ]),
          group('finance_opening', '期初与结算', [
            page('opening_balance', '期初往来账与对冲', 'page_opening_balance', 'book-open-check'),
            page('collection_settlement', '开票回款与项目结算', 'page_collection_settlement_workspace', 'wallet-cards'),
          ]),
        ],
      },
      {
        id: 'reports', label: '报表', icon: 'chart-no-axes-combined',
        navigation: [group('business_reports', '报表', [
          page('project_analysis', '项目统计', 'page_project_operating_analysis', 'chart-no-axes-combined'),
          page('reports_status', '其他报表范围', 'page_reports_scope', 'chart-no-axes-column'),
        ])],
      },
      {
        id: 'system', label: '系统', icon: 'settings',
        navigation: [
          group('system_scope', '系统设置', [page('system_status', '系统功能范围', 'page_system_scope', 'settings')]),
          group('material_settings', '业务设置 · 商品管理', [
            object('material_categories', '物料分组', 'forge_material_category', 'tags'),
            object('units', '计量单位', 'forge_unit', 'ruler'),
          ]),
          group('partner_settings', '业务设置 · 客户与供应商', [
            object('customer_categories', '客户分类', 'forge_customer_category', 'tags'),
            object('customer_levels', '客户级别', 'forge_customer_level', 'badge-check'),
            object('supplier_categories', '供应商分类', 'forge_supplier_category', 'tags'),
            object('supplier_levels', '供应商级别', 'forge_supplier_level', 'badge-check'),
          ]),
          group('inventory_settings', '业务设置 · 库存管理', [object('warehouse_types', '仓库类型', 'forge_warehouse_type', 'warehouse')]),
          group('project_settings', '业务设置 · 项目管理', [object('project_types', '项目类型', 'forge_project_type', 'tags')]),
          group('sales_settings', '业务设置 · 采购销售', [
            object('quotation_types', '报价类型', 'forge_quotation_type', 'file-text'),
            object('quotation_issuers', '报价主体', 'forge_quotation_issuer', 'landmark'),
            object('contract_types', '合同类型', 'forge_contract_type', 'scroll-text'),
          ]),
        ],
      },
    ],
  }],
});
