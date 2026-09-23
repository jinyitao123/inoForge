import { settingMigrations, type ForgeApplicationKey } from './settings-migration.js';
import { flattenNavigation, group, legacyAreas, legacySettingsArea, type ForgeAppDefinition, type ForgeNavigationItem } from './legacy-navigation.js';

const applicationInfo: Record<ForgeApplicationKey, { name: string; label: string; icon: string }> = {
  supply_chain: { name: 'forge_supply_chain', label: '供应链', icon: 'boxes' },
  sales: { name: 'forge_sales', label: '销售', icon: 'badge-dollar-sign' },
  production: { name: 'forge_production', label: '生产', icon: 'factory' },
  project: { name: 'forge_project', label: '项目', icon: 'briefcase-business' },
  administration: { name: 'forge_administration', label: '行政', icon: 'building' },
  finance: { name: 'forge_finance', label: '财务', icon: 'landmark' },
  reports: { name: 'forge_reports', label: '报表', icon: 'chart-no-axes-combined' },
};

const sourceAreaByApplication: Record<ForgeApplicationKey, string> = {
  supply_chain: 'supply_chain',
  sales: 'sales',
  production: 'production',
  project: 'project',
  administration: 'administration',
  finance: 'finance',
  reports: 'reports',
};

function sourceSettingGroupsFor(application: ForgeApplicationKey): ForgeNavigationItem[] {
  const migrationByNavId = new Map(settingMigrations.map((migration) => [migration.id, migration]));

  return (legacySettingsArea.navigation ?? []).flatMap((sourceGroup) => {
    if (sourceGroup.type !== 'group') return [];
    const children = (sourceGroup.children ?? []).filter((child) =>
      typeof child.id === 'string'
      && migrationByNavId.get(child.id)?.targetApplications.includes(application),
    );
    if (children.length === 0) return [];

    if (sourceGroup.id === 'purchase_sales_settings') {
      return [
        group(
          application === 'finance' ? 'settlement_condition_settings' : 'sales_contract_settings',
          application === 'finance' ? '结算条件' : '报价与合同',
          children,
        ),
      ];
    }

    return [{ ...sourceGroup, children }];
  });
}

function applicationArea(application: ForgeApplicationKey): ForgeAppDefinition['areas'] {
  const sourceArea = legacyAreas[sourceAreaByApplication[application] ?? ''];
  if (!sourceArea) throw new Error('Missing source navigation area for ' + application);

  const navigation = [...(sourceArea.navigation ?? [])];
  const firstGroup = navigation.find((item) => item.type === 'group');
  const home = firstGroup?.type === 'group' ? firstGroup.children?.[0] : undefined;
  const remainingNavigation = navigation.map((item) => {
    if (item !== firstGroup || item.type !== 'group' || !home) return item;
    return { ...item, children: item.children?.slice(1) ?? [] };
  });

  const settingsChildren = sourceSettingGroupsFor(application);
  const settingsGroup = group('business_settings', '业务设置', settingsChildren);

  return [{
    ...sourceArea,
    // ObjectStack 17 resolves an app landing page from its first navigation
    // item. Promote an existing, role-relevant entry without changing its
    // identity or adding a second link to the same page.
    navigation: [
      ...(home ? [home] : []),
      ...remainingNavigation,
      settingsGroup,
    ],
  }];
}

export const forgeApplicationDefinitions: Record<ForgeApplicationKey, ForgeAppDefinition> =
  Object.fromEntries(
    (Object.keys(applicationInfo) as ForgeApplicationKey[]).map((application) => {
      const info = applicationInfo[application];
      return [application, {
        name: info.name,
        label: info.label,
        icon: info.icon,
        active: true,
        isDefault: false,
        areas: applicationArea(application),
      }];
    }),
  ) as Record<ForgeApplicationKey, ForgeAppDefinition>;

export function flattenApplicationNavigation() {
  return (Object.keys(forgeApplicationDefinitions) as ForgeApplicationKey[]).flatMap((application) => {
    const app = forgeApplicationDefinitions[application];
    return (app.areas ?? []).flatMap((area) =>
      flattenNavigation(area.navigation ?? []).map((item) => ({
          application,
          appName: app.name,
          areaId: area.id,
          id: item.id,
          label: 'label' in item ? item.label : undefined,
          type: item.type,
          target: item.type === 'page'
            ? item.pageName
            : item.type === 'object'
              ? item.objectName
              : item.type === 'url'
                ? item.url
                : undefined,
        })),
    );
  });
}

export { applicationInfo };
