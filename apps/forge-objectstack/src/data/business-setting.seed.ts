import { defineSeed } from '@objectstack/spec/data';
import { BusinessSettingOption } from '../objects/business-setting.object.js';

const paymentMethods = ['银行转账', '支付宝', '微信支付', '现金', '支票', '其他', '电汇', '承兑汇票', '在线支付', '信用证'];
const expenseCategories: Array<[string, string, string | null, number]> = [
  ['sales_expense', '销售费用', null, 100],
  ['customer_development', '客户开发费用', 'sales_expense', 110], ['customer_visit', '客户拜访费', 'customer_development', 111], ['customer_entertainment', '客户招待费', 'customer_development', 112], ['customer_gift', '客户礼品费', 'customer_development', 113],
  ['market_promotion', '市场推广费用', 'sales_expense', 120], ['advertising', '广告推广费', 'market_promotion', 121], ['exhibition', '展会活动费', 'market_promotion', 122], ['promotion_material', '宣传物料费', 'market_promotion', 123],
  ['sales_support', '销售支持费用', 'sales_expense', 130], ['sample', '样品费', 'sales_support', 131], ['presales_support', '售前支持费', 'sales_support', 132], ['sales_commission', '销售佣金', 'sales_support', 133],
  ['project_expense', '项目费用', null, 200],
  ['project_travel', '项目差旅费用', 'project_expense', 210], ['project_transportation', '项目交通费', 'project_travel', 211], ['project_accommodation', '项目住宿费', 'project_travel', 212], ['project_meal_allowance', '项目餐饮补贴', 'project_travel', 213],
  ['project_implementation', '项目实施费用', 'project_expense', 220], ['installation_debugging', '安装调试费', 'project_implementation', 221], ['site_construction', '现场施工费', 'project_implementation', 222], ['temporary_labor', '临时用工费', 'project_implementation', 223],
  ['project_material', '项目材料费用', 'project_expense', 230], ['project_auxiliary_material', '项目辅材费', 'project_material', 231], ['project_consumables', '项目耗材费', 'project_material', 232], ['project_replenishment', '项目补料费', 'project_material', 233],
  ['project_outsource', '项目外协费用', 'project_expense', 240], ['outsourced_processing', '外协加工费', 'project_outsource', 241], ['outsourced_service', '外包服务费', 'project_outsource', 242], ['external_technical_support', '外部技术支持费', 'project_outsource', 243],
  ['procurement_expense', '采购费用', null, 300],
  ['procurement_business', '采购业务费用', 'procurement_expense', 310], ['supplier_visit', '供应商拜访费', 'procurement_business', 311], ['supplier_entertainment', '供应商招待费', 'procurement_business', 312], ['supplier_inspection', '供应商考察费', 'procurement_business', 313],
  ['procurement_logistics', '采购物流费用', 'procurement_expense', 320], ['procurement_transportation', '采购运输费', 'procurement_logistics', 321], ['loading_handling', '装卸搬运费', 'procurement_logistics', 322], ['packaging', '包装费', 'procurement_logistics', 323],
  ['quality_handling', '质量处理费用', 'procurement_expense', 330], ['incoming_inspection', '来料检测费', 'quality_handling', 331], ['rework_handling', '返修处理费', 'quality_handling', 332], ['return_transportation', '退货运输费', 'quality_handling', 333],
  ['rd_expense', '研发费用', null, 400],
  ['rd_material', '研发材料费用', 'rd_expense', 410], ['rd_material_cost', '研发材料费', 'rd_material', 411], ['rd_prototyping', '研发打样费', 'rd_material', 412], ['rd_test_piece', '研发测试件费用', 'rd_material', 413],
  ['rd_testing', '研发测试费用', 'rd_expense', 420], ['test_inspection', '测试检测费', 'rd_testing', 421], ['certification_calibration', '认证校准费', 'rd_testing', 422], ['experiment', '实验费用', 'rd_testing', 423],
  ['rd_service', '研发服务费用', 'rd_expense', 430], ['technical_consulting', '技术咨询费', 'rd_service', 431], ['outsourced_development', '外包开发费', 'rd_service', 432], ['intellectual_property', '知识产权费', 'rd_service', 433],
  ['admin_expense', '行政办公费用', null, 500],
  ['office_supplies', '办公用品费用', 'admin_expense', 510], ['office_supply_cost', '办公用品费', 'office_supplies', 511], ['office_consumables', '办公耗材费', 'office_supplies', 512], ['office_equipment', '办公设备费', 'office_supplies', 513],
  ['office_site', '办公场地费用', 'admin_expense', 520], ['rent_property', '房租物业费', 'office_site', 521], ['utilities', '水电费', 'office_site', 522], ['renovation_maintenance', '装修维修费', 'office_site', 523],
  ['daily_admin', '日常行政费用', 'admin_expense', 530], ['courier', '快递费', 'daily_admin', 531], ['printing', '印刷费', 'daily_admin', 532], ['meeting', '会议费', 'daily_admin', 533],
  ['hr_expense', '人事费用', null, 600],
  ['recruitment_expense', '招聘费用', 'hr_expense', 610], ['recruitment_platform', '招聘平台费', 'recruitment_expense', 611], ['headhunting', '猎头费', 'recruitment_expense', 612], ['interview', '面试费用', 'recruitment_expense', 613],
  ['training_expense', '培训费用', 'hr_expense', 620], ['internal_training', '内部培训费', 'training_expense', 621], ['external_training', '外部培训费', 'training_expense', 622], ['course', '课程费用', 'training_expense', 623],
  ['employee_welfare', '员工福利费用', 'hr_expense', 630], ['holiday_welfare', '节日福利费', 'employee_welfare', 631], ['team_building', '团建费', 'employee_welfare', 632], ['employee_care', '员工关怀费', 'employee_welfare', 633],
  ['finance_legal_expense', '财务法务费用', null, 700],
  ['finance_service', '财务服务费用', 'finance_legal_expense', 710], ['bookkeeping_agency', '代理记账费', 'finance_service', 711], ['tax_service', '税务服务费', 'finance_service', 712], ['audit_evaluation', '审计评估费', 'finance_service', 713],
  ['bank_finance', '银行金融费用', 'finance_legal_expense', 720], ['bank_fee', '银行手续费', 'bank_finance', 721], ['acceptance_fee', '承兑手续费', 'bank_finance', 722], ['financing_service', '融资服务费', 'bank_finance', 723],
  ['legal_compliance', '法务合规费用', 'finance_legal_expense', 730], ['lawyer', '律师费', 'legal_compliance', 731], ['contract_review', '合同审查费', 'legal_compliance', 732],
];

export const BusinessSettingSeed = defineSeed(BusinessSettingOption, {
  externalId: 'code',
  mode: 'upsert',
  records: [
    ...paymentMethods.map((name, index) => ({ name, code: `finance_payment_${index + 1}`, scope: 'finance', setting_type: 'payment_method', description: `${name}付款方式`, enabled: true, system_record: true, sort_order: (index + 1) * 10 })),
    ...expenseCategories.map(([code, name, parent_code, sort_order]) => ({ name, code: `finance_expense_${code}`, scope: 'finance', setting_type: 'expense_category', parent_code: parent_code ? `finance_expense_${parent_code}` : null, description: `${name}分类`, enabled: true, system_record: true, sort_order })),
  ],
});
