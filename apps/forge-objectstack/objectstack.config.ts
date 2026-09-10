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
    areas: [
      {
        id: 'demand_initiation', label: '客户需求与立项', icon: 'flag',
        navigation: [
          group('customer_context', '客户与需求', [
            object('customers', '客户', 'forge_customer', 'building-2'),
            object('contacts', '联系人', 'forge_contact', 'contact'),
            object('contact_channels', '联系方式', 'forge_contact_channel', 'phone'),
          ]),
          group('project_initiation', '项目立项', [
            object('projects', '项目中心', 'forge_project', 'briefcase-business'),
            object('project_members', '项目团队', 'forge_project_member', 'users'),
            object('project_types', '项目类型', 'forge_project_type', 'tags'),
          ]),
        ],
      },
      {
        id: 'commercial_order', label: '报价合同与订单', icon: 'file-signature',
        navigation: [
          group('commercial_flow', '商务单据', [
            object('quotations', '销售报价', 'forge_quotation', 'file-text'),
            object('sales_contracts', '销售合同', 'forge_sales_contract', 'scroll-text'),
            object('sales_orders', '销售订单', 'forge_sales_order', 'clipboard-list'),
            object('project_sales_links', '项目订单关联', 'forge_project_sales_link', 'link'),
          ]),
          group('commercial_settings', '商务配置', [
            object('quotation_types', '报价类型', 'forge_quotation_type'),
            object('quotation_issuers', '报价主体', 'forge_quotation_issuer', 'landmark'),
            object('contract_types', '合同类型', 'forge_contract_type'),
          ]),
        ],
      },
      {
        id: 'plan_design', label: '计划与方案设计', icon: 'drafting-compass',
        navigation: [
          group('project_planning', '项目计划与执行', [
            page('project_plan_workspace', '项目计划与执行', 'page_project_plan_workspace', 'calendar-range'),
          ]),
          group('design_bom', '方案与 BOM', [
            page('bom_workspace', 'BOM管理', 'page_bom_workspace', 'git-branch'),
            object('bom_nodes', 'BOM结构明细', 'forge_bom_node', 'network'),
            object('bom_approval_logs', 'BOM审批日志', 'forge_bom_approval_log', 'history'),
          ]),
        ],
      },
      {
        id: 'procurement_readiness', label: '采购与物料齐套', icon: 'shopping-cart',
        navigation: [
          group('material_readiness', '物料齐套', [
            object('shortage_analyses', '缺料分析', 'forge_bom_shortage_analysis', 'chart-no-axes-column-increasing'),
            object('shortage_lines', '缺料明细', 'forge_bom_shortage_line', 'list'),
          ]),
          group('procurement_flow', '采购执行', [
            page('purchase_orders', '采购订单', 'page_purchase_order_workspace', 'shopping-cart'),
            object('purchase_order_lines', '采购订单明细', 'forge_purchase_order_line', 'list'),
            page('purchase_returns', '采购退换货', 'page_purchase_return', 'rotate-ccw'),
            object('purchase_return_lines', '采购退货明细', 'forge_purchase_return_line', 'list'),
            object('purchase_return_logs', '退货审批记录', 'forge_purchase_return_approval_log', 'history'),
            object('purchase_return_refunds', '退货退款流水', 'forge_purchase_return_refund_receipt', 'badge-dollar-sign'),
            object('purchase_arrival_notices', '到货通知', 'forge_purchase_arrival_notice', 'package-search'),
            object('purchase_arrival_notice_lines', '到货通知明细', 'forge_purchase_arrival_notice_line', 'list'),
            page('purchase_receipts', '到货登记', 'page_purchase_arrival_workspace', 'package-check'),
            object('purchase_receipt_lines', '到货登记明细', 'forge_purchase_receipt_line', 'list'),
            page('pending_inspections', '待检验库存', 'page_pending_inspection_workspace', 'clipboard-clock'),
            page('purchase_inspections', '检验单', 'page_purchase_inspection_workspace', 'clipboard-check'),
            page('purchase_inbounds', '采购入库', 'page_purchase_inbound_workspace', 'package-plus'),
            object('purchase_inbound_lines', '采购入库明细', 'forge_purchase_inbound_line', 'list'),
            object('purchase_inbound_approval_logs', '入库审批记录', 'forge_purchase_inbound_approval_log', 'history'),
          ]),
          group('supplier_records', '供应商', [
            object('suppliers', '供应商档案', 'forge_supplier', 'truck'),
            object('supplier_banks', '银行账户', 'forge_supplier_bank_account', 'landmark'),
          ]),
        ],
      },
      {
        id: 'manufacturing', label: '制造与装配', icon: 'factory',
        navigation: [
          group('assembly_operations', '组装业务管理', [
            page('assembly_orders', '组装单', 'page_production_assembly_workspace', 'factory'),
            page('assembly_shortages', '缺料待办', 'page_production_shortage_workspace', 'triangle-alert'),
            page('production_issues', '领料单', 'page_production_material_workspace', 'package-minus'),
            page('production_supplies', '补料单', 'page_production_supply_workspace', 'package-plus'),
            page('production_returns', '退料单', 'page_production_return_workspace', 'undo-2'),
            page('disassembly_orders', '拆解单', 'page_production_disassembly_workspace', 'unplug'),
            page('replacement_orders', '换件单', 'page_production_replacement_workspace', 'replace'),
            object('production_inbounds', '生产入库', 'forge_production_inbound', 'package-check'),
            object('production_logs', '生产业务日志', 'forge_production_approval_log', 'history'),
          ]),
          group('material_stock', '物料与库存', [
            object('opening_inbounds', '期初入库', 'forge_opening_inbound', 'package-plus'),
            object('inventory_balances', '库存余额', 'forge_inventory_balance', 'boxes'),
            object('inventory_ledgers', '库存流水', 'forge_inventory_ledger', 'book-open'),
          ]),
        ],
      },
      {
        id: 'shipping_site', label: '发运与现场交付', icon: 'truck',
        navigation: [
          group('shipping_flow', '发运执行', [
            object('sales_shipments', '销售发货单', 'forge_sales_shipment', 'package-check'),
            object('sales_outbounds', '销售出库单', 'forge_sales_outbound', 'truck'),
          ]),
        ],
      },
      {
        id: 'integration_acceptance', label: '集成调试与验收', icon: 'badge-check',
        navigation: [
          group('acceptance_context', '项目上下文', [
            page('delivery_acceptance_workspace', '调试与交付验收', 'page_delivery_acceptance_workspace', 'badge-check'),
            object('commissioning_records', '集成调试记录', 'forge_commissioning_record', 'wrench'),
            object('delivery_packages', '项目交付包', 'forge_delivery_package', 'package-check'),
            object('customer_acceptances', '客户验收单', 'forge_customer_acceptance', 'badge-check'),
            object('acceptance_rectifications', '验收整改项', 'forge_acceptance_rectification', 'refresh-cw'),
            object('acceptance_projects', '项目中心', 'forge_project', 'briefcase-business'),
            object('acceptance_daily_reports', '项目日报', 'forge_project_daily_report', 'notebook-pen'),
          ]),
        ],
      },
      {
        id: 'invoice_collection', label: '开票回款', icon: 'wallet-cards',
        navigation: [
          group('sales_finance', '销售财务', [
            page('revenue_recognition', '销售收入确认', 'page_revenue_recognition', 'badge-dollar-sign'),
            page('customer_prepayment', '收款管理', 'page_customer_prepayment', 'badge-dollar-sign'),
            page('customer_refunds', '退款申请', 'page_supplier_refund', 'undo-2'),
            page('collection_settlement_workspace', '开票回款与项目结算', 'page_collection_settlement_workspace', 'wallet-cards'),
            object('sales_invoices', '销售发票', 'forge_sales_invoice', 'receipt-text'),
            object('accounts_receivable', '应收账款', 'forge_accounts_receivable', 'wallet-cards'),
            object('cash_receipts', '收款流水', 'forge_cash_receipt', 'badge-dollar-sign'),
            object('collection_allocations', '收款核销', 'forge_collection_allocation', 'badge-check'),
            object('customer_prepayments', '客户预收款', 'forge_customer_prepayment', 'landmark'),
            object('customer_prepayment_offsets', '预收款冲抵', 'forge_customer_prepayment_offset', 'badge-check'),
            object('customer_refund_records', '客户退款记录', 'forge_customer_refund', 'undo-2'),
            object('fund_accounts', '资金账户', 'forge_fund_account', 'landmark'),
          ]),
          group('purchase_finance', '采购财务', [
            page('purchase_payment', '付款管理', 'page_purchase_payment', 'send-horizontal'),
            page('supplier_refunds', '退款申请', 'page_supplier_refund', 'undo-2'),
            object('purchase_invoices', '采购发票', 'forge_purchase_invoice', 'receipt'),
            object('accounts_payable', '应付账款', 'forge_accounts_payable', 'hand-coins'),
            object('payment_tasks', '付款任务', 'forge_payment_task', 'send-horizontal'),
            object('cash_payments', '付款流水', 'forge_cash_payment', 'badge-minus'),
            object('payment_writeoffs', '付款核销', 'forge_payment_writeoff', 'badge-check'),
            object('supplier_prepayments', '供应商预付款', 'forge_supplier_prepayment', 'landmark'),
            object('supplier_prepayment_offsets', '预付款冲抵', 'forge_supplier_prepayment_offset', 'badge-check'),
            object('supplier_refund_records', '供应商退款记录', 'forge_supplier_refund', 'undo-2'),
          ]),
        ],
      },
      {
        id: 'project_close', label: '结项经营复盘', icon: 'chart-no-axes-combined',
        navigation: [
          group('close_context', '项目上下文', [
            page('close_settlement_workspace', '项目结算工作台', 'page_collection_settlement_workspace', 'chart-no-axes-combined'),
            page('project_operating_analysis', '项目经营分析', 'page_project_operating_analysis', 'chart-no-axes-combined'),
            page('project_timesheet_cost', '项目工时与人工成本', 'page_project_timesheet_cost', 'clock-3'),
            page('project_expense_cost', '项目费用与成本归集', 'page_project_expense_cost', 'hand-coins'),
            object('close_projects', '项目中心', 'forge_project', 'briefcase-business'),
            object('project_timesheets', '项目工时', 'forge_project_timesheet', 'clock-3'),
            object('project_expenses', '项目费用报销', 'forge_project_expense', 'hand-coins'),
            object('project_expense_lines', '项目费用明细', 'forge_project_expense_line', 'list'),
            object('project_cost_entries', '项目成本池', 'forge_project_cost_entry', 'circle-dollar-sign'),
            object('project_settlements', '项目结算', 'forge_project_settlement', 'chart-no-axes-combined'),
            object('close_sales_links', '项目订单关联', 'forge_project_sales_link', 'link'),
          ]),
        ],
      },
      {
        id: 'master_support', label: '基础资料与配置', icon: 'database',
        navigation: [
          group('material_records', '物料主数据', [
            object('materials', '物料', 'forge_material', 'package'),
            object('material_skus', '规格与价格', 'forge_material_sku', 'boxes'),
            object('material_categories', '物料分类', 'forge_material_category'),
            object('units', '计量单位', 'forge_unit'),
          ]),
          group('warehouse_records', '仓库配置', [
            object('warehouses', '仓库', 'forge_warehouse', 'warehouse'),
            object('warehouse_types', '仓库类型', 'forge_warehouse_type'),
          ]),
          group('partner_settings', '往来单位配置', [
            object('customer_categories', '客户分类', 'forge_customer_category'),
            object('customer_levels', '客户级别', 'forge_customer_level'),
            object('supplier_categories', '供应商分类', 'forge_supplier_category'),
            object('supplier_levels', '供应商级别', 'forge_supplier_level'),
          ]),
        ],
      },
    ],
  }],
});
