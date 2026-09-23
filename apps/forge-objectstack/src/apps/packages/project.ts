import { defineForgeApplicationPackage } from '../package.js';
import { projectSettingsManagerPermission } from '../../permissions/application-settings.permission.js';

export const projectApplication = defineForgeApplicationPackage('project', [
  projectSettingsManagerPermission,
]);
