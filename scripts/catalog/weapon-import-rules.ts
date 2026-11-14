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

/**
 * A shield's Bash action (#424 "Shield bash fallbacks"): Foundry gives it no
 * weapon proficiency (subType `shield`) and no handedness, so each pinned
 * shield needs a reviewed rule. `mapped` takes both from pinned PCGen rows
 * (the pinned PRD capture holds no equipment pages); `held` keeps today's
 * legacy fallback, which the candidate adapter refuses, because the pinned
 * sources do not settle it. A shield with a Bash and no rule stays held too.
 */
type ShieldBashRule =
  | {
      kind: 'mapped';
      key: string;
      proficiency: 'martial' | 'exotic';
      handedness: 'light' | 'oneHanded';
      evidence: string;
    }
  | { kind: 'held'; key: string; reason: string };

// CRB p.152 shield bash: "Shieldbash (Light Shield)" Martial, WIELD:Light and
// "Shieldbash (Heavy Shield)" Martial, WIELD:OneHanded (pinned
// cr_equip_arms_armor.lst:293-294; cr_profs_weapon.lst:16 Martial). A shield
// row typed ShieldBash bashes through these.
const crbLightBash =
  'CRB cr_equip_arms_armor.lst:293 Shieldbash (Light Shield): Martial, WIELD:Light';
const crbHeavyBash =
  'CRB cr_equip_arms_armor.lst:294 Shieldbash (Heavy Shield): Martial, WIELD:OneHanded';
const shieldBashRules: readonly ShieldBashRule[] = [
  {
    kind: 'mapped',
    key: 'pf1/l1qNkx4xGXelq6yY',
    proficiency: 'martial',
    handedness: 'light',
    evidence: `Light Wooden Shield: cr_equip_arms_armor.lst:110 Shield.Light ShieldBash, WIELD:Light; ${crbLightBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/iRB7ACzHf14VIk4M',
    proficiency: 'martial',
    handedness: 'light',
    evidence: `Light Steel Shield: cr_equip_arms_armor.lst:111 Shield.Light ShieldBash, WIELD:Light; ${crbLightBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/6zjwZeZmhqmAFC82',
    proficiency: 'martial',
    handedness: 'oneHanded',
    evidence: `Heavy Wooden Shield: cr_equip_arms_armor.lst:112 Shield.Heavy ShieldBash, WIELD:OneHanded; ${crbHeavyBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/2fK608aSYU9QDmzw',
    proficiency: 'martial',
    handedness: 'oneHanded',
    evidence: `Heavy Steel Shield: cr_equip_arms_armor.lst:113 Shield.Heavy ShieldBash, WIELD:OneHanded; ${crbHeavyBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/mcDNhbR4RQ5Z1ckQ',
    proficiency: 'martial',
    handedness: 'light',
    evidence: `Quickdraw light wooden shield: APG apg_equip_arms_armor.lst:53 Shield.Light, WIELD:Light, and :58 ShieldBash; ${crbLightBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/z5iAeUTo3r6qlEfd',
    proficiency: 'martial',
    handedness: 'light',
    evidence: `Quickdraw light steel shield: APG apg_equip_arms_armor.lst:54 Shield.Light, WIELD:Light, and :59 ShieldBash; ${crbLightBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/OZHfmAh4i6Bkoun3',
    proficiency: 'martial',
    handedness: 'oneHanded',
    evidence: `Wooden Snarlshield: aa2_equip_arms_armor.lst:32 Shield.Heavy ShieldBash, WIELD:OneHanded (gnog_equip_arms_armor.lst:11 WIELD:OneHanded); ${crbHeavyBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/Lq7YjIXW1SfV4EKr',
    proficiency: 'martial',
    handedness: 'oneHanded',
    evidence: `Steel Snarlshield: aa2_equip_arms_armor.lst:31 Shield.Heavy ShieldBash, WIELD:OneHanded (gnog_equip_arms_armor.lst:10 WIELD:OneHanded); ${crbHeavyBash}.`,
  },
  {
    kind: 'mapped',
    key: 'pf1/kc4ZuOEIEx1ZlXgJ',
    proficiency: 'exotic',
    handedness: 'light',
    evidence:
      'Leather Madu as a weapon: UC uc_equip_arms_armor.lst:86 PROFICIENCY:WEAPON|Madu, Exotic, 1d4 piercing, WIELD:Light; uc_profs_weapon.lst:121 Exotic.Light; lofpg_equip_general.lst:8 Exotic.',
  },
  {
    kind: 'mapped',
    key: 'pf1/h8Jq6rEHJ8xc4SIn',
    proficiency: 'exotic',
    handedness: 'light',
    evidence:
      'Steel Madu as a weapon: UC uc_equip_arms_armor.lst:87 PROFICIENCY:WEAPON|Madu, Exotic, 1d4 piercing, WIELD:Light; uc_profs_weapon.lst:121 Exotic.Light; lofpg_equip_general.lst:8 Exotic.',
  },
  {
    kind: 'mapped',
    key: 'pf1/inF1zaK0XoeTdBIc',
    proficiency: 'exotic',
    handedness: 'light',
    evidence:
      'Dwarven War-Shield as a weapon (the native Bash is its 1d6 piercing and slashing): aa2_equip_arms_armor.lst:48 Exotic, 1d6, WIELD:Light; aa2_profs_weapon.lst:20 Exotic.Light.',
  },
  {
    kind: 'held',
    key: 'pf1/mDqCTp8wMKbSOo1x',
    reason:
      'Klar: PCGen types its weapon use martial but disagrees on handedness: WIELD:Light at cotctpg_equip_arms_armor.lst:14 and vbol_equip_arms_armor.lst:17, OneHanded at iswg_equip_arms_armor.lst:11, aa_equip_arms_armor.lst:54 and ue_profs_weapon.lst:38.',
  },
  {
    kind: 'held',
    key: 'pf1/alQVMlHc89hMxK2M',
    reason:
      'Hard light shield: tg_equip.lst:41 types it a heavy shield with no bash weapon row, proficiency or WIELD; no pinned source settles its bash.',
  },
];

export function findShieldBashRule(key: string) {
  return shieldBashRules.find((rule) => rule.key === key);
}
