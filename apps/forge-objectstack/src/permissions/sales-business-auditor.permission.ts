import { definePermissionSet } from '@objectstack/spec';

const organizationRead = { allowRead: true, readScope: 'org' as const };

/** Organization-scoped read-only access for independent sales business reviewers. */
export const salesBusinessAuditorPermission = definePermissionSet({
  name: 'sales_business_auditor',
  label: '销售业务核验只读',
  description: '只读核验线索转化、销售报价和销售合同涉及的七类业务记录；不授予系统对象、其他业务对象或办理权限。',
  objects: {
    forge_sales_lead: organizationRead,
    forge_customer: organizationRead,
    forge_sales_opportunity: organizationRead,
    forge_quotation: organizationRead,
    forge_quotation_line: organizationRead,
    forge_sales_contract: organizationRead,
    forge_sales_contract_line: organizationRead,
  },
});
