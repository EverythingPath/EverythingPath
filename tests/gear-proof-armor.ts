// The gear family's first public proof's item fixture (gear S1,
// `convex/characterSheetGear.integration.test.ts`): worn armor, shields and
// weapons shaped as the imported rows they name. The gear registry entry
// binds these bytes, and `tests/catalog/launch-gear.test.ts` ties the
// family's scope to what the fixture releases.
export const items = {
  // Chain Shirt: light, +4 armor, max Dex 4, penalty 2, 20%.
  shirt: 'pf1/gearProofShirt',
  // Buckler: `other`, +1 shield, no max Dex, penalty 1, 5%, two local attack
  // penalties and two targeted notes.
  buckler: 'pf1/gearProofBuckler',
  // A leather-shaped light armor: +2 armor, max Dex 3, penalty 1, 10%.
  leather: 'pf1/gearProofLeather',
  // A Quilted-Cloth-shaped light armor with an untargeted note.
  quilted: 'pf1/gearProofQuilted',
  // A medium and a heavy armor (the optional category cases).
  medium: 'pf1/gearProofMedium',
  heavy: 'pf1/gearProofHeavy',
} as const;
export const weapons = {
  melee: 'pf1/gearProofSword',
  ranged: 'pf1/gearProofJavelin',
} as const;

export const local = {
  melee:
    'while your buckler arm wields a melee weapon (an off-hand weapon, or helping to wield a two-handed weapon)',
  ranged:
    'while your buckler arm wields a ranged weapon other than a bow or crossbow',
};
export const bowNote =
  'You can use a bow or crossbow without penalty while carrying it.';
export const acNote =
  'In any case, if you use a weapon in your off hand, you lose the buckler’s AC bonus until your next turn. You can cast a spell with somatic components using your shield arm, but you lose the buckler’s AC bonus until your next turn. You can’t make a shield bash with a buckler.';
export const quiltedNote =
  'Proof quilted cloth grants DR 3/— against nonlethal damage.';

type Armor = {
  slot: 'armor' | 'shield';
  category: string;
  bonus: number;
  maxDex: number | null;
  armorCheckPenalty: number;
  asf: number;
};
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition: { situation: { local: string } };
};
type Note = { text: string; target?: string };
type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: Modifier[];
  situationalNotes?: Note[];
};
const body = ({ externalKey, modifiers = [], ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  description: `${rest.name}.`,
  sources: [{ book: 'PZO1110', pages: '150, 151' }],
  modifiers,
  unsupported: [],
  ...rest,
});
const armorBody = (
  externalKey: string,
  name: string,
  {
    armor,
    ...change
  }: { armor: Armor } & Pick<Body, 'modifiers' | 'situationalNotes'>,
) =>
  body({
    externalKey,
    name,
    pack: 'armors-and-shields',
    detail: { kind: 'item', consumable: false, price: 5, weight: 5, armor },
    ...change,
  });
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'weapons-and-ammo',
    detail: {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 3,
      weapon: {
        threat: 20,
        mult: 2,
        finesse: false,
        monk: false,
        ...profile,
      },
    },
  });

export const armors: Record<keyof typeof items, Armor> = {
  shirt: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 4,
    maxDex: 4,
    armorCheckPenalty: 2,
    asf: 20,
  },
  buckler: {
    slot: 'shield',
    category: 'other',
    bonus: 1,
    maxDex: null,
    armorCheckPenalty: 1,
    asf: 5,
  },
  leather: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 2,
    maxDex: 3,
    armorCheckPenalty: 1,
    asf: 10,
  },
  quilted: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 1,
    maxDex: 8,
    armorCheckPenalty: 0,
    asf: 10,
  },
  medium: {
    slot: 'armor',
    category: 'mediumArmor',
    bonus: 5,
    maxDex: 3,
    armorCheckPenalty: 4,
    asf: 25,
  },
  heavy: {
    slot: 'armor',
    category: 'heavyArmor',
    bonus: 7,
    maxDex: 1,
    armorCheckPenalty: 6,
    asf: 35,
  },
};
const bucklerModifiers: Modifier[] = [
  {
    target: 'attack.melee',
    bonusType: 'untyped',
    value: -1,
    condition: { situation: { local: local.melee } },
  },
  {
    target: 'attack.ranged',
    bonusType: 'untyped',
    value: -1,
    condition: { situation: { local: local.ranged } },
  },
];

export const bodies = [
  armorBody(items.shirt, 'Proof Chain Shirt', { armor: armors.shirt }),
  armorBody(items.buckler, 'Proof Buckler', {
    armor: armors.buckler,
    modifiers: bucklerModifiers,
    situationalNotes: [
      { target: 'attack', text: bowNote },
      { target: 'ac', text: acNote },
    ],
  }),
  armorBody(items.leather, 'Proof Leather', { armor: armors.leather }),
  armorBody(items.quilted, 'Proof Quilted Cloth', {
    armor: armors.quilted,
    situationalNotes: [{ text: quiltedNote }],
  }),
  armorBody(items.medium, 'Proof Medium Armor', { armor: armors.medium }),
  armorBody(items.heavy, 'Proof Heavy Armor', { armor: armors.heavy }),
  weapon(weapons.melee, 'Proof Sword', {
    baseType: 'Longsword',
    proficiency: 'martial',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    thrown: false,
    strengthDamage: 'melee',
  }),
  weapon(weapons.ranged, 'Proof Javelin', {
    baseType: 'Javelin',
    proficiency: 'simple',
    groups: ['spears', 'thrown'],
    handedness: 'oneHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    thrown: true,
    rangeIncrement: 30,
    strengthDamage: 'thrown',
  }),
];
