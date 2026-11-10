/** Source-bound interpretations; these do not confer content or notice approval.
 * Locators refer to pinned PCGen CRB/APG equipment and the native weapon YAML.
 */
type WeaponCriticalPolicy =
  | { kind: 'noCritical' }
  | { kind: 'sourceConflict' }
  | { kind: 'keenInclusive' };

type WeaponImportRule = {
  key: string;
  evidence: string;
  handedness?: 'light' | 'oneHanded' | 'twoHanded';
  thrownRangeIncrement?: number;
  criticalPolicy?: WeaponCriticalPolicy;
  strengthDamageHold?: string;
  baseItemKey?: string;
};

const weaponImportRules: readonly WeaponImportRule[] = [
  {
    key: 'pf1/J0zfGICU57qryKxj',
    evidence:
      'Native reaver-s-scythe.J0zfGICU57qryKxj.yaml (APG p.325): +2 keen unholy scythe, critRange=19 includes keen. Refuse until property non-stacking is represented.',
    criticalPolicy: { kind: 'keenInclusive' },
  },
  {
    key: 'pf1/7zvBqNNlc5i5EtFd',
    evidence:
      'APG apg_equip_arms_armor.lst:64 (p.177): Ranged.Thrown, RANGE:10; native melee range.value=10.',
    thrownRangeIncrement: 10,
  },
  {
    key: 'pf1/mCwwHo32SU7kjGyu',
    evidence: 'CRB cr_equip_arms_armor.lst:303: WIELD:Light, SIZE:M.',
    handedness: 'light',
  },
  {
    key: 'pf1/42M7kFLkyccrj1uf',
    evidence: 'CRB cr_equip_arms_armor.lst:315: WIELD:Light, SIZE:M.',
    handedness: 'light',
  },
  {
    key: 'pf1/ZBnZt4RlEg7ckoKE',
    evidence:
      'CRB cr_equip_arms_armor.lst:316 (p.148) and native description: fire with one hand, load with two. PCGen SIZE:S explains 1d6 vs native Medium 1d8; hands=2 describes loading.',
    handedness: 'oneHanded',
  },
  {
    key: 'pf1/BgTqaNqyS3tnLGAg',
    evidence: 'CRB cr_equip_arms_armor.lst:311: WIELD:Light.',
    handedness: 'light',
  },
  {
    key: 'pf1/CUFJ4SDh7TKSrjx0',
    evidence: 'CRB cr_equip_arms_armor.lst:300: WIELD:TwoHandsOnly.',
    strengthDamageHold:
      'Native Blowgun adds Strength but the PCGen projectile profile does not; Strength behavior remains held for source review.',
    handedness: 'twoHanded',
  },
  {
    key: 'pf1/c2cwyWi0Jn5PMggb',
    evidence:
      'APG apg_equip_arms_armor.lst:78: CRITMULT:-; native critMult=1 represents the same absence of extra critical damage. Stored threat/mult cannot express no critical.',
    criticalPolicy: { kind: 'noCritical' },
  },
  {
    key: 'pf1/OPTlPwKg2NyQAjhe',
    evidence:
      'Native Whip critRange:null disables criticals (action.mjs); conflicts with CRB row. Keep launch dependency unresolved.',
    criticalPolicy: { kind: 'sourceConflict' },
  },
  {
    key: 'pf1/oAb9EXEzaLRGfYxL',
    evidence:
      'Native Sickle critRange:null disables criticals (action.mjs); conflicts with CRB row. Keep launch dependency unresolved.',
    criticalPolicy: { kind: 'sourceConflict' },
  },
  {
    key: 'pf1/TXd09UXUUNBWPk4Q',
    evidence:
      'Native Frost Brand and CRB p.471: +3 greatsword; inherit the stable Greatsword identity.',
    baseItemKey: 'pf1/oyUApQSVsAqzyjdz',
  },
];

export function findWeaponImportRule(key: string) {
  return weaponImportRules.find((rule) => rule.key === key);
}

// CRB pp.145–149, pinned cr_equip_arms_armor.lst:301–313.
const crossbowReloads = new Map<string, 'move' | 'fullRound' | 'free'>([
  ['Hand Crossbow', 'move'],
  ['Light Crossbow', 'move'],
  ['Heavy Crossbow', 'fullRound'],
  ['Repeating Light Crossbow', 'free'],
  ['Repeating Heavy Crossbow', 'free'],
]);
export function weaponReloadRule(baseType: string) {
  return crossbowReloads.get(baseType);
}

// CRB pp.145–149, pinned cr_equip_arms_armor.lst:305,316.
// These reviewed profiles share projectile Strength and move-action loading;
// other sling variants require their own source/model decisions.
const slingRule = {
  strengthDamage: 'sling',
  reload: 'move',
  thrown: false,
} as const;
const slingWeaponRules = new Map([
  ['Sling', slingRule],
  ['Halfling Sling Staff', slingRule],
]);
export function findSlingWeaponRule(baseType: string) {
  return slingWeaponRules.get(baseType);
}
