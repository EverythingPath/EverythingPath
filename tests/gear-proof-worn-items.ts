// The gear family's second public proof's item fixture (gear S2,
// `convex/characterSheetGearModifiers.integration.test.ts`): worn items and a
// tower shield shaped as the imported rows they name. The gear registry entry
// binds these bytes, and `tests/catalog/launch-gear.test.ts` ties the
// family's scope to what the fixture releases. Gear S3 adds the curated
// stand-ins a reviewed record binds an import issue to (a cloak's resistance
// bonus on saves, an amulet's enhancement on unarmed and natural attacks),
// each item carrying the issues its imported row carries.
export const items = {
  // Ring of Protection +2 and a lesser ring: `ac` deflection 2 and 1.
  ring: 'pf1/gearModRing',
  lesserRing: 'pf1/gearModLesserRing',
  // Amulet of Natural Armor +2 and +1: `ac.natural` enhancement 2 and 1.
  amulet: 'pf1/gearModAmulet',
  lesserAmulet: 'pf1/gearModLesserAmulet',
  // Belt of Physical Perfection +4: Str, Dex and Con enhancement 4, with an
  // untargeted note and notes on Dexterity and Constitution; a Belt of Giant
  // Strength +2 with a note on Strength.
  belt: 'pf1/gearModBelt',
  lesserBelt: 'pf1/gearModLesserBelt',
  // Headband of Mental Superiority +4: Int, Wis and Cha enhancement 4, with
  // a note on each.
  headband: 'pf1/gearModHeadband',
  // Ring of Climbing: Climb competence 5; a lesser competence item, 2.
  climbing: 'pf1/gearModClimbing',
  lesserClimbing: 'pf1/gearModLesserClimbing',
  // Dusty Rose Prism Ioun Stone: AC insight 1, CMB insight 1 in a local
  // Situation.
  ioun: 'pf1/gearModIoun',
  // Artisan's Tools, masterwork: Craft circumstance 0, and 2 in a local
  // Situation.
  tools: 'pf1/gearModTools',
  // Musical instrument, masterwork: Perform circumstance 0, 2 in a local
  // Situation, and a note on Perform.
  instrument: 'pf1/gearModInstrument',
  // Cloak of Elvenkind: Stealth competence 0, and 5 in a local Situation.
  cloak: 'pf1/gearModCloak',
  // Tower Shield: `towerShield`, +4 shield, max Dex 2, penalty 10, 50%,
  // attack −2 untyped, and a note on AC standing in for its Total cover
  // action.
  tower: 'pf1/gearModTower',
  // Cloak of Resistance +3 and +1: `saves` resistance 3 and 1, standing in
  // for the raw change the importer leaves unmapped.
  resistance: 'pf1/gearModResistance',
  lesserResistance: 'pf1/gearModLesserResistance',
  // Amulet of Mighty Fists +2: `attack` and `damage` enhancement 2 with
  // unarmed strikes and natural weapons, standing in for its two raw
  // changes.
  fists: 'pf1/gearModFists',
} as const;
export const weapons = {
  melee: 'pf1/gearModSword',
  ranged: 'pf1/gearModJavelin',
} as const;

export const local = {
  ioun: "while the ioun stone's resonance power applies",
  tools: 'on Craft checks made with these tools',
  instrument: 'on Perform checks made to perform with the instrument',
  cloak:
    'on Stealth checks while the cloak is worn with the hood drawn up around the head',
};
/** A targeted note on each ability score its item raises. */
const abilityNote = (ability: string) =>
  `Treat this as a temporary ${ability} bonus for the first 24 hours the item is worn.`;
export const abilityNotes = {
  'ability.dex': abilityNote('Dexterity'),
  'ability.con': abilityNote('Constitution'),
  'ability.int': abilityNote('Intelligence'),
  'ability.wis': abilityNote('Wisdom'),
  'ability.cha': abilityNote('Charisma'),
} as const;
export const notes = {
  belt: 'These bonuses are chosen when the belt is created and cannot be changed.',
  lesserBelt:
    'Treat this as a temporary ability bonus for the first 24 hours the belt is worn.',
  instrument:
    "If you want to perform using a Perform skill associated with a musical instrument (keyboard, percussion, string, or wind), you must have an appropriate musical instrument; otherwise you can't use the skill.",
  tower:
    'As a standard action, however, you can use a tower shield to grant you total cover until the beginning of your next turn.',
};

type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition?:
    | { situation: { local: string } }
    | { weapon: typeof unarmedOrNatural };
};
type Note = { text: string; target?: string };
type Issue = { field: string; reason: string; value: unknown };
const modifier = (
  [target, bonusType, value]: [string, string, number],
  situation?: string,
): Modifier => ({
  target,
  bonusType,
  value,
  ...(situation ? { condition: { situation: { local: situation } } } : {}),
});
/** The weapon condition of a bonus with unarmed strikes and natural weapons. */
export const unarmedOrNatural = '$unarmedOrNatural';
const withUnarmedOrNatural = (
  target: string,
  bonusType: string,
  value: number,
): Modifier => ({
  target,
  bonusType,
  value,
  condition: { weapon: unarmedOrNatural },
});
/** A raw change the importer leaves unmapped, as its issue reports it. */
const rawChange = (target: string, formula: string, type: string): Issue => ({
  field: 'changes',
  reason:
    'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
  value: { target, formula, type },
});
const body = (
  externalKey: string,
  name: string,
  {
    modifiers,
    situationalNotes,
    detail = {},
    pack = 'items',
    unsupported = [],
  }: {
    modifiers: Modifier[];
    situationalNotes?: Note[];
    detail?: Record<string, unknown>;
    pack?: string;
    unsupported?: Issue[];
  },
) => ({
  externalKey,
  upstreamKey: externalKey,
  name,
  pack,
  description: `${name}.`,
  sources: [{ book: 'PZO1110', pages: '496' }],
  detail: { kind: 'item', consumable: false, price: 5, weight: 1, ...detail },
  modifiers,
  ...(situationalNotes ? { situationalNotes } : {}),
  unsupported,
});
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) => ({
  externalKey,
  upstreamKey: externalKey,
  name,
  pack: 'weapons-and-ammo',
  description: `${name}.`,
  sources: [{ book: 'PZO1110', pages: '142' }],
  detail: {
    kind: 'item',
    consumable: false,
    price: 15,
    weight: 3,
    weapon: { threat: 20, mult: 2, finesse: false, monk: false, ...profile },
  },
  modifiers: [],
  unsupported: [],
});

export const towerArmor = {
  slot: 'shield',
  category: 'towerShield',
  bonus: 4,
  maxDex: 2,
  armorCheckPenalty: 10,
  asf: 50,
};
export const outputs: Record<
  keyof typeof items,
  { modifiers: Modifier[]; situationalNotes?: Note[] }
> = {
  ring: { modifiers: [modifier(['ac', 'deflection', 2])] },
  lesserRing: { modifiers: [modifier(['ac', 'deflection', 1])] },
  amulet: { modifiers: [modifier(['ac.natural', 'enhancement', 2])] },
  lesserAmulet: { modifiers: [modifier(['ac.natural', 'enhancement', 1])] },
  belt: {
    modifiers: [
      modifier(['ability.str', 'enhancement', 4]),
      modifier(['ability.dex', 'enhancement', 4]),
      modifier(['ability.con', 'enhancement', 4]),
    ],
    situationalNotes: [
      { text: notes.belt },
      { target: 'ability.dex', text: abilityNotes['ability.dex'] },
      { target: 'ability.con', text: abilityNotes['ability.con'] },
    ],
  },
  lesserBelt: {
    modifiers: [modifier(['ability.str', 'enhancement', 2])],
    situationalNotes: [{ target: 'ability.str', text: notes.lesserBelt }],
  },
  headband: {
    modifiers: [
      modifier(['ability.int', 'enhancement', 4]),
      modifier(['ability.wis', 'enhancement', 4]),
      modifier(['ability.cha', 'enhancement', 4]),
    ],
    situationalNotes: (
      ['ability.int', 'ability.wis', 'ability.cha'] as const
    ).map((target) => ({ target, text: abilityNotes[target] })),
  },
  climbing: { modifiers: [modifier(['skill.clm', 'competence', 5])] },
  lesserClimbing: { modifiers: [modifier(['skill.clm', 'competence', 2])] },
  ioun: {
    modifiers: [
      modifier(['ac', 'insight', 1]),
      modifier(['cmb', 'insight', 1], local.ioun),
    ],
  },
  tools: {
    modifiers: [
      modifier(['skill.crf', 'circumstance', 0]),
      modifier(['skill.crf', 'circumstance', 2], local.tools),
    ],
  },
  instrument: {
    modifiers: [
      modifier(['skill.prf', 'circumstance', 0]),
      modifier(['skill.prf', 'circumstance', 2], local.instrument),
    ],
    situationalNotes: [{ target: 'skill.prf', text: notes.instrument }],
  },
  cloak: {
    modifiers: [
      modifier(['skill.ste', 'competence', 0]),
      modifier(['skill.ste', 'competence', 5], local.cloak),
    ],
  },
  tower: {
    modifiers: [modifier(['attack', 'untyped', -2])],
    situationalNotes: [{ target: 'ac', text: notes.tower }],
  },
  resistance: { modifiers: [modifier(['saves', 'resistance', 3])] },
  lesserResistance: { modifiers: [modifier(['saves', 'resistance', 1])] },
  fists: {
    modifiers: [
      withUnarmedOrNatural('attack', 'enhancement', 2),
      withUnarmedOrNatural('damage', 'enhancement', 2),
    ],
  },
};

/**
 * The issues each imported row carries beside its stand-in: the raw changes
 * the importer leaves unmapped, and the tower shield's retained action. They
 * reach the sheet as text only.
 */
export const issues: Partial<Record<keyof typeof items, Issue[]>> = {
  tower: [
    {
      field: 'gameContent',
      reason:
        'Source game-content fields retained for feature curation; only explicitly mapped detail/modifiers have an interpretation.',
      value: {
        actions: [
          {
            activation: { type: 'standard' },
            duration: { units: 'round', value: '1' },
            name: 'Grant total cover',
          },
        ],
      },
    },
  ],
  resistance: [rawChange('allSavingThrows', '3', 'resist')],
  lesserResistance: [rawChange('allSavingThrows', '1', 'resist')],
  fists: [rawChange('nattack', '2', 'enh'), rawChange('ndamage', '2', 'enh')],
};

export const bodies = [
  ...Object.entries(items).map(([name, key]) =>
    body(key, `Proof ${name}`, {
      ...outputs[name as keyof typeof items],
      unsupported: issues[name as keyof typeof items],
      ...(name === 'tower'
        ? {
            detail: { price: 30, weight: 45, armor: towerArmor },
            pack: 'armors-and-shields',
          }
        : {}),
    }),
  ),
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
