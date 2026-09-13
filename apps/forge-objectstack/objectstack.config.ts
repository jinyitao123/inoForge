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
            page('workspace_ai', 'AI 广场', 'page_workspace_recovery_status', 'sparkles'),
            page('workspace_guidance', '引导中心', 'page_workspace_recovery_status', 'book-open'),
            page('workspace_todo', '待办管理', 'page_workspace_recovery_status', 'list-todo'),
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
            page('inspection_rules', '检验规则', 'page_supply_chain_gap', 'list-check'),
          ]),
          group('supply_master_data', '基础资料', [
            object('materials', '物料管理', 'forge_material', 'package'),
            page('material_combinations', '物料组合', 'page_supply_chain_gap', 'boxes'),
            page('bom_workspace', 'BOM管理', 'page_bom_workspace', 'git-branch'),
            page('material_search', '综合物料搜索', 'page_supply_chain_gap', 'search'),
            object('suppliers', '供应商管理', 'forge_supplier', 'truck'),
            page('product_trace', '产品实例追溯', 'page_supply_chain_gap', 'search-check'),
            object('warehouses', '仓库管理', 'forge_warehouse', 'warehouse'),
          ]),
          group('purchase_management', '采购管理', [
            page('purchase_invoices', '采购发票', 'page_supply_chain_gap', 'receipt-text'),
            page('purchase_requests', '采购申请', 'page_supply_chain_gap', 'file-plus-2'),
            page('purchase_todo', '采购待办池', 'page_supply_chain_gap', 'list-todo'),
            page('purchase_inquiry', '询价管理', 'page_supply_chain_gap', 'messages-square'),
            page('purchase_orders', '采购订单', 'page_purchase_order_workspace', 'shopping-cart'),
            page('purchase_returns', '采购退换货', 'page_purchase_return', 'rotate-ccw'),
            page('supplier_prices', '供应商价格本', 'page_supply_chain_gap', 'badge-dollar-sign'),
          ]),
          group('inbound_management', '入库管理', [
            page('all_inbounds', '全部入库单', 'page_supply_chain_gap', 'package-plus'),
            page('purchase_inbounds', '采购入库', 'page_purchase_inbound_workspace', 'package-plus'),
            page('production_inbounds', '生产入库', 'page_supply_chain_gap', 'package-plus'),
            page('other_inbounds', '其他入库', 'page_supply_chain_gap', 'package-plus'),
            object('opening_inbounds', '期初入库', 'forge_opening_inbound', 'package-plus'),
            page('inbound_lines', '入库明细', 'page_supply_chain_gap', 'list'),
          ]),
          group('inventory_management', '库存管理', [
            object('inventory_balances', '库存总览', 'forge_inventory_balance', 'boxes'),
            page('inventory_ncr', '不合格处理', 'page_supply_chain_gap', 'triangle-alert'),
            object('inventory_ledgers', '库存流水', 'forge_inventory_ledger', 'book-open'),
            page('inventory_locks', '库存锁定', 'page_supply_chain_gap', 'lock'),
            page('inventory_count', '库存盘点', 'page_supply_chain_gap', 'clipboard-check'),
            page('inventory_transfer', '调拨与借出', 'page_supply_chain_gap', 'arrow-left-right'),
            page('inventory_alerts', '库存预警', 'page_supply_chain_gap', 'bell-ring'),
            page('inventory_loss', '报损单', 'page_supply_chain_gap', 'file-warning'),
            page('inventory_sn', 'SN码管理', 'page_supply_chain_gap', 'scan-line'),
          ]),
          group('outbound_management', '出库管理', [
            object('sales_outbounds', '出库单列表', 'forge_sales_outbound', 'truck'),
            page('production_outbounds', '生产出库', 'page_supply_chain_gap', 'package-minus'),
            page('other_outbounds', '其他出库', 'page_supply_chain_gap', 'package-minus'),
            page('sales_direct_outbounds', '销售直接出库', 'page_supply_chain_gap', 'package-minus'),
            page('pending_shipments', '待出库发货单', 'page_supply_chain_gap', 'list-todo'),
            page('purchase_return_outbounds', '采购退换货出库', 'page_supply_chain_gap', 'undo-2'),
            page('outbound_lines', '出库明细', 'page_supply_chain_gap', 'list'),
          ]),
        ],
      },
      {
        id: 'sales', label: '销售', icon: 'badge-dollar-sign', navigation: [
          group('sales_business', '销售业务', [
            object('sales_contracts', '框架销售合同', 'forge_sales_contract', 'scroll-text'),
            object('sales_orders', '销售订单', 'forge_sales_order', 'clipboard-list'),
            page('sales_collections', '收款流水', 'page_sales_gap', 'badge-dollar-sign'),
            object('sales_shipments', '销售发货单', 'forge_sales_shipment', 'package-check'),
            page('sales_returns', '销售退货', 'page_sales_gap', 'undo-2'),
            page('sales_performance_bank', '业绩银行', 'page_sales_gap', 'landmark'),
            page('sales_pricing', '价格策略', 'page_sales_gap', 'tag'),
            page('goodwill_orders', 'Goodwill订单', 'page_sales_gap', 'gift'),
            page('sales_teams', '销售团队', 'page_sales_gap', 'users'),
            page('sales_targets', '销售目标', 'page_sales_gap', 'target'),
            page('sales_invoices', '销售发票', 'page_sales_gap', 'receipt-text'),
          ]),
          group('crm_customer_management', 'CRM客户管理', [
            object('customers', '客户管理', 'forge_customer', 'building-2'),
            object('contacts', '联系人管理', 'forge_contact', 'contact'),
            object('quotations', '销售报价', 'forge_quotation', 'file-text'),
            page('customer_material_map', '客户物料对照', 'page_sales_gap', 'tags'),
            page('opportunities', '商机管理', 'page_sales_gap', 'sparkles'),
            page('leads', '线索管理', 'page_sales_gap', 'funnel'),
            page('follow_ups', '跟进记录', 'page_sales_gap', 'messages-square'),
            page('customer_pool', '公海客户', 'page_sales_gap', 'users-round'),
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
            page('drawing_guide', '进入图纸管理上手指南', 'page_production_gap', 'book-open'),
            page('drawing_workspace', '图纸总览', 'page_drawing_workspace', 'ruler'),
            page('drawing_archive', '图号档案', 'page_production_gap', 'archive'),
            page('drawing_review', '图纸评审', 'page_production_gap', 'clipboard-check'),
            page('drawing_release', '图纸发布', 'page_production_gap', 'send'),
            page('drawing_change', '图纸变更', 'page_production_gap', 'git-compare'),
            page('drawing_distribution', '图纸发放记录', 'page_production_gap', 'history'),
            page('drawing_query', '图纸关联查询', 'page_production_gap', 'search'),
            page('customer_drawings', '客户图纸', 'page_production_gap', 'file-image'),
          ]),
          group('subcontract_management', '委外管理', [
            page('subcontract_guide', '进入委外管理上手指南', 'page_production_gap', 'book-open'),
            page('subcontract_dashboard', '委外看板', 'page_subcontract_dashboard', 'layout-dashboard'),
            page('subcontract_workspace', '委外订单', 'page_subcontract_workspace', 'clipboard-list'),
            page('subcontract_issues', '委外发料', 'page_subcontract_issue_workspace', 'package-minus'),
            page('subcontract_receipts', '委外回厂', 'page_subcontract_receipt_workspace', 'package-check'),
            page('subcontract_returns', '委外退料', 'page_subcontract_return_workspace', 'undo-2'),
            page('subcontract_reconciliation', '委外对账', 'page_subcontract_reconciliation', 'file-check-2'),
            page('subcontract_reconciliation_report', '委外对账单', 'page_subcontract_reconciliation_report', 'file-chart-column'),
            object('subcontract_suppliers', '委外供应商', 'forge_subcontract_supplier_profile', 'factory'),
            page('subcontract_stock', '委外库存', 'page_subcontract_stock', 'warehouse'),
            page('subcontract_undelivered', '委外未交', 'page_subcontract_undelivered', 'list-todo'),
            page('subcontract_trace', '批次追溯', 'page_subcontract_trace', 'search-check'),
            page('subcontract_inbound_report', '委外进货', 'page_subcontract_inbound_report', 'package-search'),
          ]),
        ],
      },
      {
        id: 'project', label: '项目', icon: 'briefcase-business', navigation: [
          group('project_management', '项目管理', [
            object('projects', '项目中心', 'forge_project', 'briefcase-business'),
            page('project_operating_analysis', '项目分析中心', 'page_project_operating_analysis', 'chart-no-axes-combined'),
            page('project_plan_workspace', '任务管理', 'page_project_plan_workspace', 'calendar-range'),
            page('project_timesheet_cost', '工时管理', 'page_project_timesheet_cost', 'clock-3'),
            page('project_settings', '项目配置中心', 'page_project_settings', 'sliders-horizontal'),
          ]),
          group('project_execution_and_cost', '项目执行与成本', [
            page('delivery_acceptance_workspace', '交付验收', 'page_delivery_acceptance_workspace', 'badge-check'),
            page('project_expense_cost', '项目费用与成本', 'page_project_expense_cost', 'hand-coins'),
          ]),
        ],
      },
      {
        id: 'administration', label: '行政', icon: 'building', navigation: [
          group('approval_center', '审批中心', [
            page('my_approvals', '我的审批', 'page_administration_gap', 'check-check'),
            page('cc_to_me', '抄送我的', 'page_administration_gap', 'send'),
            page('initiated_by_me', '我发起的', 'page_administration_gap', 'file-up'),
            page('administration_requests', '行政申请', 'page_administration_gap', 'file-plus-2'),
          ]),
          group('administration_management', '行政管理', [
            page('administration_notice', '公司通知', 'page_administration_gap', 'megaphone'),
            page('seal_management', '用章管理', 'page_administration_gap', 'stamp'),
            page('meeting_minutes', '会议纪要', 'page_administration_gap', 'notebook-pen'),
            page('work_reports', '工作汇报', 'page_administration_gap', 'clipboard-list'),
            page('document_center', '文档中心', 'page_administration_gap', 'folder-open'),
            page('fixed_assets', '固定资产', 'page_administration_gap', 'building-2'),
            page('qualification_declaration', '资质与申报', 'page_administration_gap', 'file-check-2'),
            page('material_pickup', '物料领取', 'page_administration_gap', 'package'),
            page('equipment_maintenance', '设备维护', 'page_administration_gap', 'wrench'),
            page('gift_management', '礼品管理', 'page_administration_gap', 'gift'),
            page('loan_management', '借出管理', 'page_administration_gap', 'handshake'),
            page('vehicle_management', '车辆管理', 'page_administration_gap', 'car'),
          ]),
          group('human_resources', '人力资源', [
            page('hr_workspace', '人事工作台', 'page_administration_gap', 'layout-dashboard'),
            page('employee_records', '员工档案', 'page_administration_gap', 'contact'),
            page('recruitment', '招聘管理', 'page_administration_gap', 'user-plus'),
            page('onboarding_offboarding', '入职离职', 'page_administration_gap', 'log-out'),
            page('salary_benefits', '薪酬福利', 'page_administration_gap', 'wallet-cards'),
            page('rules_policies', '规章制度', 'page_administration_gap', 'book-open'),
            page('directory', '通讯录', 'page_administration_gap', 'contact-round'),
          ]),
          group('attendance_leave', '考勤假期', [
            page('overtime_requests', '加班申请', 'page_administration_gap', 'clock-3'),
            page('leave_management', '请假管理', 'page_administration_gap', 'calendar-off'),
            page('business_trip', '出差申请', 'page_administration_gap', 'plane'),
            page('attendance_management', '考勤管理', 'page_administration_gap', 'calendar-check'),
            page('attendance_statistics', '考勤统计', 'page_administration_gap', 'chart-column'),
          ]),
          group('process_center', '流程中心', [
            page('approval_records', '审批记录', 'page_administration_gap', 'history'),
            page('start_process', '发起流程', 'page_administration_gap', 'play'),
            page('process_definitions', '流程定义', 'page_administration_gap', 'git-branch'),
            page('process_categories', '流程分类', 'page_administration_gap', 'tags'),
          ]),
        ],
      },
      {
        id: 'finance', label: '财务', icon: 'landmark', navigation: [
          group('fund_management', '资金管理', [
            page('fund_accounts', '资金账户', 'page_finance_gap', 'wallet'),
            page('bank_flow', '资金流水', 'page_bank_flow', 'landmark'),
            page('bank_statement', '银行余额对账', 'page_bank_statement', 'file-check-2'),
            page('opening_balance', '期初往来账与对冲', 'page_opening_balance', 'book-open-check'),
            page('receivables_payables', '应收应付', 'page_finance_gap', 'scale'),
            page('customer_prepayment', '收款管理', 'page_customer_prepayment', 'badge-dollar-sign'),
            page('purchase_payment', '付款管理', 'page_purchase_payment', 'send-horizontal'),
            page('refunds', '退款申请', 'page_supplier_refund', 'undo-2'),
            page('credit_limits', '授信额度管理', 'page_finance_gap', 'gauge'),
            page('loans', '借款贷款管理', 'page_finance_gap', 'hand-coins'),
          ]),
          group('business_confirmation', '业务确认', [
            page('revenue_recognition', '销售收入确认', 'page_revenue_recognition', 'badge-dollar-sign'),
            page('cost_center', '成本中心', 'page_finance_gap', 'chart-pie'),
            page('expense_center', '费用中心', 'page_finance_gap', 'receipt'),
            page('reimbursement', '报销管理', 'page_finance_gap', 'file-spreadsheet'),
            page('counterparty_reconciliation', '对账单', 'page_counterparty_reconciliation', 'file-check-2'),
          ]),
          group('invoice_management', '发票管理', [
            page('invoice_overview', '发票总览', 'page_finance_gap', 'files'),
            page('output_invoices', '销项发票', 'page_finance_gap', 'receipt-text'),
            page('input_invoices', '进项发票', 'page_finance_gap', 'receipt-text'),
            page('invoice_tasks', '开票任务', 'page_finance_gap', 'list-todo'),
            page('finance_adjustments', '调整记录', 'page_invoice_reversal', 'receipt-text'),
            page('collection_settlement', '开票与结算', 'page_collection_settlement_workspace', 'wallet-cards'),
          ]),
        ],
      },
      {
        id: 'reports', label: '报表', icon: 'chart-no-axes-combined', navigation: [
          group('business_reports', '报表', [
            page('sales_statistics', '销售统计', 'page_reports_gap', 'chart-column'),
            page('purchase_statistics', '采购统计', 'page_reports_gap', 'chart-column'),
            page('inventory_statistics', '库存统计', 'page_reports_gap', 'chart-column'),
            page('project_statistics', '项目统计', 'page_project_operating_analysis', 'chart-no-axes-combined'),
            page('assembly_statistics', '组装统计', 'page_reports_gap', 'chart-column'),
          ]),
          group('finance_reports', '财务统计', [
            page('finance_overview', '财务总览', 'page_reports_gap', 'layout-dashboard'),
            page('profit_loss', '损益分析', 'page_reports_gap', 'chart-pie'),
            page('fund_analysis', '资金分析', 'page_reports_gap', 'chart-line'),
            page('receivable_report', '往来账款', 'page_reports_gap', 'scale'),
            page('tax_inventory', '税务库存', 'page_reports_gap', 'file-chart-column'),
            page('risk_monitoring', '风险监控', 'page_reports_gap', 'shield-alert'),
          ]),
        ],
      },
      {
        id: 'system', label: '系统', icon: 'settings', navigation: [
          group('system_settings', '系统设置', [
            page('system_base_config', '基础配置', 'page_system_gap', 'settings-2'),
            page('system_users_roles', '用户与角色', 'page_system_gap', 'users'),
            page('system_departments', '部门管理', 'page_system_gap', 'network'),
            page('system_sessions', '用户会话', 'page_system_gap', 'monitor'),
            page('system_audit', '审计日志', 'page_system_gap', 'scroll-text'),
          ]),
          group('business_settings', '业务设置', [
          group('finance_settings', '财务配置', [page('finance_config_gap', '财务配置', 'page_system_gap', 'landmark')]),
          group('administration_settings', '行政管理', [page('administration_config_gap', '行政管理', 'page_system_gap', 'building')]),
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
          group('project_business_settings', '项目管理', [
            object('project_types', '项目类型', 'forge_project_type', 'tags'),
          ]),
          group('other_settings', '其他配置', [page('other_config_gap', '其他配置', 'page_system_gap', 'sliders-horizontal')]),
          group('hr_settings', '人事配置', [page('hr_config_gap', '人事配置', 'page_system_gap', 'users')]),
          group('drawing_settings', '图纸配置', [page('drawing_config_gap', '图纸配置', 'page_system_gap', 'ruler')]),
          group('production_settings', '生产配置', [page('production_config_gap', '生产配置', 'page_system_gap', 'factory')]),
          group('subcontract_settings', '委外配置', [page('subcontract_config_gap', '委外配置', 'page_system_gap', 'truck')]),
          group('document_printing', '单据打印', [page('document_printing_gap', '单据打印', 'page_system_gap', 'printer')]),
          group('plugin_center', '插件中心', [page('plugin_center_gap', '插件中心', 'page_system_gap', 'blocks')]),
          group('service_subscription', '服务订阅', [page('service_subscription_gap', '服务订阅', 'page_system_gap', 'rss')]),
          group('promotion_rewards', '推广奖励', [page('promotion_rewards_gap', '推广奖励', 'page_system_gap', 'award')]),
          group('field_management', '字段管理', [page('field_management_gap', '字段管理', 'page_system_gap', 'list')]),
          ]),
        ],
      },
    ],
  }],
});
