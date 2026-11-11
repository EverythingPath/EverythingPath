import type { WithoutSystemFields } from 'convex/server';
import type { Doc } from '../_generated/dataModel';

// Representative prepared-sheet Spell Effects and the Spells they name, not a
// curated Catalog Release. Pathfinder RPG Core Rulebook spell descriptions
// (Chapter 10); spell list levels cite the CRB spell lists (pp. 224–238) for
// the CRB classes only. Descriptions quote the Open Game Content of the
// removed legacy spell dataset. Page numbers follow the printed CRB layout and
// await an owner check: see "Unverified citations" in
// docs/catalog-import/prestige-and-unchained.md. Haste's and mage armor's
// Spells are already seeded (the #253 prepared Spells and the representative
// Granted Spells).

type StoredDefinition = WithoutSystemFields<Doc<'catalogEntry'>>;
type Unscoped<Definition> = Omit<
  Definition,
  'scope' | 'characterId' | 'browseOnly'
>;
type SheetDefinition = Unscoped<
  Extract<
    StoredDefinition,
    { detail: { kind: 'item' | 'spell' | 'spellEffect' | 'condition' } }
  >
>;
type SpellSeed = SheetDefinition & {
  detail: Extract<SheetDefinition['detail'], { kind: 'spell' }>;
};
type SpellEffectSeed = SheetDefinition & {
  detail: Extract<SheetDefinition['detail'], { kind: 'spellEffect' }>;
};
type Modifier = SpellEffectSeed['modifiers'][number];

const core = (pages: string) => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];
/** The prepared Haste Spell (#253 importer demonstration). */
const hasteSpellKey = 'pf1/s9amdo5398alb5p0';
const mageArmorSpellKey = 'representative-spell-mage-armor';

function spell(
  key: string,
  name: string,
  school: string,
  levels: Record<string, number>,
  pages: string,
): SpellSeed {
  return {
    name,
    ruleIdentity: `representative-spell-${key}`,
    sources: core(pages),
    stacksWithItself: false,
    modifiers: [],
    detail: { kind: 'spell', levels, school },
  };
}

export const representativeSpellEffectSpellCatalog: SpellSeed[] = [
  spell(
    'magic-weapon',
    'Magic Weapon',
    'trs',
    { cleric: 1, paladin: 1, sorcerer: 1, wizard: 1 },
    '307',
  ),
  spell(
    'greater-magic-weapon',
    'Magic Weapon, Greater',
    'trs',
    { cleric: 4, paladin: 3, sorcerer: 3, wizard: 3 },
    '307',
  ),
  spell('keen-edge', 'Keen Edge', 'trs', { sorcerer: 3, wizard: 3 }, '302'),
  spell('magic-fang', 'Magic Fang', 'trs', { druid: 1, ranger: 1 }, '306'),
  spell(
    'greater-magic-fang',
    'Magic Fang, Greater',
    'trs',
    { druid: 3, ranger: 3 },
    '306',
  ),
  spell('magic-vestment', 'Magic Vestment', 'trs', { cleric: 3 }, '307'),
  spell('align-weapon', 'Align Weapon', 'trs', { cleric: 2 }, '239'),
  spell('bless-weapon', 'Bless Weapon', 'trs', { paladin: 1 }, '249'),
  spell(
    'bulls-strength',
    "Bull's Strength",
    'trs',
    { cleric: 2, druid: 2, paladin: 2, sorcerer: 2, wizard: 2 },
    '251',
  ),
  spell(
    'bears-endurance',
    "Bear's Endurance",
    'trs',
    { cleric: 2, druid: 2, ranger: 2, sorcerer: 2, wizard: 2 },
    '246',
  ),
  spell('shield-of-faith', 'Shield of Faith', 'abj', { cleric: 1 }, '342'),
];

const onTarget = { weapon: '$target' } as const;
const greaterBonus = { formula: 'min(5, floor(@casterLevel / 4))' };
function enhancement(value: Modifier['value']): Modifier[] {
  return (['attack', 'damage'] as const).map((target) => ({
    target,
    bonusType: 'enhancement',
    value,
    condition: onTarget,
  }));
}

function effect({
  key,
  name,
  spellKey,
  defaultCasterLevel,
  pages,
  description,
  modifiers = [],
  situationalNotes,
  detail = {},
  sourceKey,
}: {
  key: string;
  name: string;
  spellKey: string;
  defaultCasterLevel: number;
  pages: string;
  description: string;
  modifiers?: Modifier[];
  situationalNotes?: SpellEffectSeed['situationalNotes'];
  detail?: Omit<
    SpellEffectSeed['detail'],
    'kind' | 'lastsOverOneDay' | 'defaultCasterLevel' | 'spellKey'
  >;
  sourceKey?: string;
}): SpellEffectSeed {
  return {
    name,
    ruleIdentity: `representative-spell-effect-${key}`,
    ...(sourceKey ? { sourceKey } : {}),
    sources: core(pages),
    stacksWithItself: false,
    description,
    modifiers,
    ...(situationalNotes ? { situationalNotes } : {}),
    // Every one of these lasts a day or less: a Temporary Effect.
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel,
      spellKey,
      ...detail,
    },
  };
}

export const representativeSpellEffectCatalog: SpellEffectSeed[] = [
  effect({
    key: 'magic-weapon',
    name: 'Magic weapon',
    spellKey: 'representative-spell-magic-weapon',
    defaultCasterLevel: 1,
    pages: '307',
    description:
      "Magic weapon gives a weapon a +1 enhancement bonus on attack and damage rolls. An enhancement bonus does not stack with a masterwork weapon's +1 bonus on attack rolls. You can't cast this spell on a natural weapon, such as an unarmed strike (instead, see magic fang). A monk's unarmed strike is considered a weapon, and thus it can be enhanced by this spell.",
    modifiers: enhancement(1),
    detail: { itemTarget: 'weapon' },
  }),
  effect({
    key: 'greater-magic-weapon',
    name: 'Greater magic weapon',
    spellKey: 'representative-spell-greater-magic-weapon',
    defaultCasterLevel: 5,
    pages: '307',
    description:
      'This spell functions like magic weapon, except that it gives a weapon an enhancement bonus on attack and damage rolls of +1 per four caster levels (maximum +5). Alternatively, you can affect as many as 50 arrows, bolts, or bullets.',
    modifiers: enhancement(greaterBonus),
    detail: { itemTarget: 'weapon' },
  }),
  effect({
    key: 'keen-edge',
    name: 'Keen edge',
    spellKey: 'representative-spell-keen-edge',
    defaultCasterLevel: 5,
    pages: '302',
    description:
      "This transmutation doubles the threat range of the weapon. The spell can be cast only on piercing or slashing weapons. Multiple effects that increase a weapon's threat range (such as the keen special weapon property and the Improved Critical feat) don't stack. You can't cast this spell on a natural weapon, such as a claw.",
    detail: { itemTarget: 'weapon', doublesThreat: true },
  }),
  effect({
    key: 'magic-fang',
    name: 'Magic fang',
    spellKey: 'representative-spell-magic-fang',
    defaultCasterLevel: 1,
    pages: '306',
    description:
      'Magic fang gives one natural weapon or unarmed strike of the subject a +1 enhancement bonus on attack and damage rolls.',
    modifiers: enhancement(1),
    detail: { itemTarget: 'natural' },
  }),
  effect({
    key: 'greater-magic-fang',
    name: 'Greater magic fang',
    spellKey: 'representative-spell-greater-magic-fang',
    defaultCasterLevel: 5,
    pages: '306',
    description:
      "This spell functions like magic fang, except that the enhancement bonus on attack and damage rolls is +1 per four caster levels (maximum +5). Alternatively, you may imbue all of the creature's natural weapons with a +1 enhancement bonus (regardless of your caster level).",
    modifiers: enhancement(greaterBonus),
    detail: { itemTarget: 'natural' },
  }),
  effect({
    key: 'magic-vestment',
    name: 'Magic vestment',
    spellKey: 'representative-spell-magic-vestment',
    defaultCasterLevel: 5,
    pages: '307',
    description:
      'You imbue a suit of armor or a shield with an enhancement bonus of +1 per four caster levels (maximum +5 at 20th level).',
    modifiers: [
      {
        target: 'ac',
        bonusType: 'enhancement',
        value: greaterBonus,
        condition: onTarget,
      },
    ],
    detail: { itemTarget: 'armorOrShield' },
  }),
  effect({
    key: 'align-weapon',
    name: 'Align weapon',
    spellKey: 'representative-spell-align-weapon',
    defaultCasterLevel: 3,
    pages: '239',
    description:
      "Align weapon makes a weapon chaotic, evil, good, or lawful, as you choose. A weapon that is aligned can bypass the damage reduction of certain creatures. You can't cast this spell on a natural weapon, such as an unarmed strike.",
    situationalNotes: [
      {
        target: 'damage',
        text: 'Aligned as chosen: bypasses damage reduction of that alignment.',
        condition: onTarget,
      },
    ],
    detail: { itemTarget: 'weapon' },
  }),
  effect({
    key: 'bless-weapon',
    name: 'Bless weapon',
    spellKey: 'representative-spell-bless-weapon',
    defaultCasterLevel: 1,
    pages: '249',
    description:
      'This transmutation makes a weapon strike true against evil foes. The weapon is treated as having a +1 enhancement bonus for the purpose of bypassing the DR of evil creatures. The weapon also becomes good-aligned. All critical hit rolls against evil foes are automatically successful.',
    situationalNotes: [
      {
        target: 'attack',
        situation: 'evil',
        text: 'Every threat is a critical hit; bypasses evil creatures’ damage reduction as good and +1.',
        condition: onTarget,
      },
    ],
    detail: { itemTarget: 'weapon' },
  }),
  effect({
    key: 'bulls-strength',
    name: "Bull's strength",
    spellKey: 'representative-spell-bulls-strength',
    defaultCasterLevel: 3,
    pages: '251',
    description:
      'The subject becomes stronger. The spell grants a +4 enhancement bonus to Strength, adding the usual benefits to melee attack rolls, melee damage rolls, and other uses of the Strength modifier.',
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
  }),
  effect({
    key: 'bears-endurance',
    name: "Bear's Endurance",
    spellKey: 'representative-spell-bears-endurance',
    defaultCasterLevel: 3,
    pages: '246',
    description:
      "The affected creature gains greater vitality and stamina. The spell grants the subject a +4 enhancement bonus to Constitution, which adds the usual benefits to hit points, Fortitude saves, Constitution checks, and so forth. Hit points gained by a temporary increase in Constitution score are not temporary hit points. They go away when the subject's Constitution drops back to normal. They are not lost first as temporary hit points are.",
    modifiers: [{ target: 'ability.con', bonusType: 'enhancement', value: 4 }],
  }),
  effect({
    key: 'mage-armor',
    name: 'Mage armor',
    spellKey: mageArmorSpellKey,
    defaultCasterLevel: 1,
    pages: '306',
    description:
      'An invisible but tangible field of force surrounds the subject of a mage armor spell, providing a +4 armor bonus to AC. Unlike mundane armor, mage armor entails no armor check penalty, arcane spell failure chance, or speed reduction.',
    modifiers: [{ target: 'ac', bonusType: 'armor', value: 4 }],
  }),
  effect({
    key: 'shield-of-faith',
    name: 'Shield of faith',
    spellKey: 'representative-spell-shield-of-faith',
    defaultCasterLevel: 1,
    pages: '342',
    description:
      'The spell grants the subject a +2 deflection bonus to AC, with an additional +1 to the bonus for every six levels you have (maximum +5 deflection bonus at 18th level).',
    modifiers: [
      {
        target: 'ac',
        bonusType: 'deflection',
        value: { formula: 'min(5, 2 + floor(@casterLevel / 6))' },
      },
    ],
  }),
  // CRB p. 294; FAQ "Speed Weapons": the `haste` Source gives one extra
  // attack however many haste effects are active.
  effect({
    key: 'haste',
    name: 'Haste',
    spellKey: hasteSpellKey,
    sourceKey: 'haste',
    defaultCasterLevel: 3,
    pages: '294',
    description:
      'When making a full attack action, a hasted creature may make one extra attack with one natural or manufactured weapon. A hasted creature gains a +1 bonus on attack rolls and a +1 dodge bonus to AC and Reflex saves.',
    modifiers: [
      { target: 'attack', bonusType: 'untyped', value: 1 },
      { target: 'ac', bonusType: 'dodge', value: 1 },
      { target: 'save.ref', bonusType: 'dodge', value: 1 },
    ],
  }),
];
