import legacyNavigation from './legacy-navigation.json';
import type { NavigationItemInput, ObjectStackDefinitionInput } from '@objectstack/spec';

type CollectionItem<Collection> =
  Collection extends readonly (infer Item)[]
    ? Item
    : Collection extends Record<string, infer Item>
      ? Item
      : never;

type AppInput = CollectionItem<NonNullable<ObjectStackDefinitionInput['apps']>>;
export type ForgeAppDefinition = {
  name: string;
  label: string;
  icon?: string;
  active?: boolean;
  isDefault?: boolean;
  areas?: NonNullable<AppInput['areas']>;
};
export type ForgeAppArea = NonNullable<AppInput['areas']>[number];
export type ForgeNavigationItem = NavigationItemInput;

const navigationData = legacyNavigation as {
  migrationSourceCommit: string;
  sourceAppName: string;
  areas: ForgeAppArea[];
};

export const navigationMigrationSource = {
  commit: navigationData.migrationSourceCommit,
  appName: navigationData.sourceAppName,
} as const;

export const legacyAreas = Object.fromEntries(
  navigationData.areas.map((area) => [area.id, area]),
) as Record<string, ForgeAppArea>;

export const legacySettingsArea = legacyAreas.business_settings;

export function group(
  id: string,
  label: string,
  children: ForgeNavigationItem[],
  icon?: string,
): ForgeNavigationItem {
  return {
    id,
    type: 'group',
    label,
    children,
    expanded: true,
    ...(icon ? { icon } : {}),
  };
}

export function flattenNavigation(items: ForgeNavigationItem[]): ForgeNavigationItem[] {
  return items.flatMap((item) =>
    item.type === 'group'
      ? flattenNavigation(item.children ?? [])
      : [item],
  );
}
