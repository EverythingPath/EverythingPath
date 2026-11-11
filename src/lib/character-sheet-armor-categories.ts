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
