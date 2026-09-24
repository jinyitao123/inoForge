import { definePermissionSet } from '@objectstack/spec';

const organizationRead = { allowRead: true, readScope: 'org' as const };

/** Read-only access for independent reviewers of the three MVP1 business scenes. */
export const mvp1SceneOrganizationAuditorPermission = definePermissionSet({
  name: 'mvp1_scene_organization_auditor',
  label: 'MVP1 场景组织内核验只读',
  description: '仅只读核验线索转化、销售报价和销售合同涉及的七类业务记录；不授予系统对象、其他业务对象或办理权限。',
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
