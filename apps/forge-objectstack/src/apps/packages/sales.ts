import { salesContractOperatorPermission, salesContractReviewerPermission } from '../../permissions/sales-contract.permission.js';
import {
  salesCustomerFollowUpOperatorPermission,
  salesSettingsManagerPermission,
} from '../../permissions/application-settings.permission.js';
import { defineForgeApplicationPackage } from '../package.js';

export const salesApplication = defineForgeApplicationPackage('sales', [
  salesContractOperatorPermission,
  salesContractReviewerPermission,
  salesCustomerFollowUpOperatorPermission,
  salesSettingsManagerPermission,
]);
