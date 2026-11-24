import type { CharacterSheetCatalogEntry } from './character-sheet';
import { ruleKeyMatches } from './character-sheet-rule-keys';

export const armorCategories = [
  'light',
  'medium',
  'heavy',
  'buckler',
  'lightShield',
  'heavyShield',
  'tower',
  'lightArmor',
  'mediumArmor',
  'heavyArmor',
  'towerShield',
  'other',
] as const;

export type ArmorCategory = (typeof armorCategories)[number];

export const armorCategoryAliases = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  buckler: 'buckler',
  lightShield: 'lightShield',
  heavyShield: 'heavyShield',
  tower: 'towerShield',
  lightArmor: 'light',
  mediumArmor: 'medium',
  heavyArmor: 'heavy',
  towerShield: 'towerShield',
  other: 'other',
} as const satisfies Record<ArmorCategory, ArmorCategory>;

type CanonicalArmorCategory = (typeof armorCategoryAliases)[ArmorCategory];

export function armorCategory(category?: string | null) {
  const knownCategory = armorCategories.find((value) => value === category);
  return knownCategory ? armorCategoryAliases[knownCategory] : undefined;
}

export function armorProficiencyCategory(category: ArmorCategory) {
  const canonical = armorCategoryAliases[category];
  if (canonical === 'light' || canonical === 'medium' || canonical === 'heavy')
    return canonical;
  return canonical === 'towerShield' ? 'towerShield' : 'shield';
}

/**
 * Whether an armor or shield definition is a buckler: the one decision every
 * reader asks (the other hand's reload, the category shown on the sheet). A
 * shield recorded in the buckler category is one, as a one-off the form
 * creates. A shield recorded as `other` or with no category is one by the
 * Buckler's rule identity (the imported one or the seeded `buckler`), which a
 * Catalog Copy keeps: the import keeps Foundry's shield subtype `other`, which
 * the Buckler shares with shields that are not bucklers (the Dwarven
 * War-Shield), so the category alone cannot tell. A shield recorded in another
 * known category is that shield.
 */
export function isBuckler(
  definition:
    | Pick<CharacterSheetCatalogEntry, 'ruleIdentity' | 'detail'>
    | undefined,
) {
  const detail = definition?.detail;
  const armor = detail?.kind === 'item' ? detail.armor : undefined;
  if (armor?.slot !== 'shield') return false;
  const category = armorCategory(armor.category);
  if (category === 'buckler') return true;
  return (
    (category === undefined || category === 'other') &&
    ruleKeyMatches(definition?.ruleIdentity, 'buckler')
  );
}

const canonicalLabels: Record<CanonicalArmorCategory, string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  buckler: 'Buckler',
  lightShield: 'Light shield',
  heavyShield: 'Heavy shield',
  towerShield: 'Tower shield',
  other: 'Shield',
};

// Safe cast: built from every armor category.
export const armorCategoryLabels = Object.fromEntries(
  armorCategories.map((category) => [
    category,
    canonicalLabels[armorCategoryAliases[category]],
  ]),
) as Record<ArmorCategory, string>;
