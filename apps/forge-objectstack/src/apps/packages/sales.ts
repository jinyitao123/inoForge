import { salesContractOperatorPermission, salesContractReviewerPermission } from '../../permissions/sales-contract.permission.js';
import { salesLeadConversionPermission, salesLeadOwnerPermission } from '../../permissions/sales-lead-conversion.permission.js';
import { salesQuotationAdjustmentPermission } from '../../permissions/sales-quotation.permission.js';
import { mvp1SceneOrganizationAuditorPermission } from '../../permissions/mvp1-scene-auditor.permission.js';
import {
  salesReferenceReaderPermission,
  salesCustomerFollowUpOperatorPermission,
  salesSettingsManagerPermission,
} from '../../permissions/application-settings.permission.js';
import { defineForgeApplicationPackage } from '../package.js';

export const salesApplication = defineForgeApplicationPackage('sales', [
  salesContractOperatorPermission,
  salesContractReviewerPermission,
  salesLeadOwnerPermission,
  salesLeadConversionPermission,
  salesQuotationAdjustmentPermission,
  mvp1SceneOrganizationAuditorPermission,
  salesReferenceReaderPermission,
  salesCustomerFollowUpOperatorPermission,
  salesSettingsManagerPermission,
]);
