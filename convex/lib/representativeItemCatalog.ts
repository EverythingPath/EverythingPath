import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import { CHOSEN_FOE_SITUATION } from '../../src/lib/character-sheet-attack-types';

// Representative prepared-sheet equipment, Item Abilities and specific magic
// items, not a curated Catalog Release. Pathfinder RPG Core Rulebook: armor
// and shields, Table 6–6 (p. 151) and descriptions (pp. 152–153); the shield
// bash rows of Table 6–4 (p. 142); Chapter 15 armor special abilities
// (pp. 462–463), weapon special abilities (pp. 469–471), specific armor
// and shields (pp. 464–467) and specific weapons (pp. 471–478). Pages were
// recorded from the printed CRB layout; retained section URLs point at
// https://legacy.aonprd.com/coreRulebook/magicItems/ without fetching it.

type StoredDefinition = WithoutSystemFields<Doc<'catalogEntry'>>;
type Unscoped<Definition> = Omit<
  Definition,
  'scope' | 'characterId' | 'browseOnly'
>;
type ItemDetail = Extract<StoredDefinition['detail'], { kind: 'item' }>;
type ItemSeed = Unscoped<
  Extract<
    StoredDefinition,
    { detail: { kind: 'item' | 'spell' | 'spellEffect' | 'condition' } }
  >
> & { detail: ItemDetail };
type AbilitySeed = Unscoped<
  Extract<StoredDefinition, { detail: { kind: 'itemAbility' } }>
>;
type Sources = { book: string; pages: string }[];
const core = (pages: string): Sources => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];

type EquipmentSeed = ItemSeed;

/** Base Items for armor, shields and their bash attacks. */
export const representativeEquipmentCatalog: EquipmentSeed[] = [
  {
    name: 'Chain shirt',
    ruleIdentity: 'chain-shirt',
    sources: core('151–152'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 4,
        armorCheckPenalty: 2,
        asf: 20,
      },
    },
  },
  {
    name: 'Breastplate',
    ruleIdentity: 'breastplate',
    sources: core('151–152'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'medium',
        bonus: 6,
        maxDex: 3,
        armorCheckPenalty: 4,
        asf: 25,
      },
    },
  },
  {
    name: 'Full plate',
    ruleIdentity: 'full-plate',
    sources: core('151–152'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'heavy',
        bonus: 9,
        maxDex: 1,
        armorCheckPenalty: 6,
        asf: 35,
      },
    },
  },
  {
    name: 'Buckler',
    ruleIdentity: 'buckler',
    sources: core('151–152'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'buckler',
        bonus: 1,
        maxDex: null,
        armorCheckPenalty: 1,
        asf: 5,
      },
    },
  },
  {
    name: 'Light steel shield',
    ruleIdentity: 'light-steel-shield',
    sources: core('142, 151–153'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'lightShield',
        bonus: 1,
        maxDex: null,
        armorCheckPenalty: 1,
        asf: 5,
      },
      // CRB p. 152: a light shield's bash is a light martial weapon.
      weapon: {
        baseType: 'light shield',
        proficiency: 'martial',
        handedness: 'light',
        attackType: 'melee',
        dice: '1d3',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  {
    name: 'Heavy steel shield',
    ruleIdentity: 'heavy-steel-shield',
    sources: core('142, 151–153'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'heavyShield',
        bonus: 2,
        maxDex: null,
        armorCheckPenalty: 2,
        asf: 15,
      },
      // CRB p. 152: a heavy shield's bash is a one-handed martial weapon.
      weapon: {
        baseType: 'heavy shield',
        proficiency: 'martial',
        handedness: 'oneHanded',
        attackType: 'melee',
        dice: '1d4',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  {
    name: 'Heavy wooden shield',
    ruleIdentity: 'heavy-wooden-shield',
    sources: core('142, 151–153'),
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'heavyShield',
        bonus: 2,
        maxDex: null,
        armorCheckPenalty: 2,
        asf: 15,
      },
      weapon: {
        baseType: 'heavy shield',
        proficiency: 'martial',
        handedness: 'oneHanded',
        attackType: 'melee',
        dice: '1d4',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
];

/**
 * Wondrous items whose Modifiers the sheet calculates. CRB p. 496: an
 * amulet of mighty fists' enhancement bonus on attack and damage rolls with
 * unarmed attacks and natural weapons, one row per printed bonus.
 */
export const representativeWondrousItemCatalog: ItemSeed[] = [
  1, 2, 3, 4, 5,
].map((enhancement) => ({
  name: `Amulet of mighty fists +${enhancement}`,
  ruleIdentity: `amulet-of-mighty-fists-${enhancement}`,
  sources: core('496'),
  description:
    'This amulet grants an enhancement bonus of +1 to +5 on attack and damage rolls with unarmed attacks and natural weapons.',
  modifiers: (['attack', 'damage'] as const).map((target) => ({
    target,
    bonusType: 'enhancement' as const,
    value: enhancement,
    condition: { weapon: '$unarmedOrNatural' as const },
  })),
  stacksWithItself: false,
  detail: { kind: 'item', consumable: false },
}));

/** Checked CRB Item Abilities: dice, threat doubling, bane and notes. */
export const representativeItemAbilityCatalog: AbilitySeed[] = [
  {
    name: 'Flaming',
    ruleIdentity: 'flaming',
    sources: core('469'),
    stacksWithItself: false,
    description:
      'Upon command, a flaming weapon is sheathed in fire that deals an extra 1d6 points of fire damage on a successful hit.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ dice: '1d6', damageType: 'fire', on: 'hit' }],
    },
  },
  {
    name: 'Flaming burst',
    ruleIdentity: 'flaming-burst',
    sources: core('469'),
    stacksWithItself: false,
    description:
      'A flaming burst weapon functions as a flaming weapon that also explodes with flame upon striking a successful critical hit: an extra 1d10 points of fire damage, 2d10 with a ×3 critical multiplier and 3d10 with ×4.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 2,
      damageDice: [
        { dice: '1d6', damageType: 'fire', on: 'hit' },
        { dice: '1d10', damageType: 'fire', on: 'crit' },
      ],
    },
  },
  {
    name: 'Frost',
    ruleIdentity: 'frost',
    sources: core('469'),
    stacksWithItself: false,
    description:
      'Upon command, a frost weapon is sheathed in a terrible, icy chill that deals an extra 1d6 points of cold damage on a successful hit.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ dice: '1d6', damageType: 'cold', on: 'hit' }],
    },
  },
  {
    name: 'Shock',
    ruleIdentity: 'shock',
    sources: core('470'),
    stacksWithItself: false,
    description:
      'Upon command, a shock weapon is sheathed in crackling electricity that deals an extra 1d6 points of electricity damage on a successful hit.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ dice: '1d6', damageType: 'electricity', on: 'hit' }],
    },
  },
  {
    name: 'Thundering',
    ruleIdentity: 'thundering',
    sources: core('471'),
    stacksWithItself: false,
    description:
      'A thundering weapon creates a cacophonous roar on a successful critical hit: an extra 1d8 points of sonic damage, 2d8 with a ×3 critical multiplier and 3d8 with ×4. A creature struck must succeed on a DC 14 Fortitude save or be deafened permanently.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ dice: '1d8', damageType: 'sonic', on: 'crit' }],
    },
  },
  {
    name: 'Keen',
    ruleIdentity: 'keen',
    sources: core('470'),
    stacksWithItself: false,
    description:
      'This special ability doubles the threat range of a weapon. Only piercing or slashing melee weapons can be keen. This benefit doesn’t stack with any other effects that expand the threat range of a weapon.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'melee',
      bonusEquivalent: 1,
      doublesThreat: true,
      weaponDamageTypes: ['piercing', 'slashing'],
    },
  },
  {
    name: 'Holy',
    ruleIdentity: 'holy',
    sources: core('470'),
    stacksWithItself: false,
    description:
      'A holy weapon is imbued with holy power. It is good-aligned and deals an extra 2d6 points of damage against all creatures of evil alignment. It bestows one permanent negative level on any evil creature attempting to wield it.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 2,
      damageDice: [{ dice: '2d6', on: 'hit', situation: 'evil' }],
    },
  },
  {
    name: 'Bane',
    ruleIdentity: 'bane',
    sources: core('469'),
    stacksWithItself: false,
    description:
      'A bane weapon excels at attacking one type or subtype of creature. Against its designated foe, its effective enhancement bonus is +2 better than its actual bonus, and it deals an extra 2d6 points of damage against the foe.',
    modifiers: [],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      choice: 'creatureType',
      foeEnhancement: 2,
      damageDice: [{ dice: '2d6', on: 'hit', situation: CHOSEN_FOE_SITUATION }],
    },
  },
  {
    name: 'Defending',
    ruleIdentity: 'defending',
    sources: core('469'),
    stacksWithItself: false,
    description:
      'A defending weapon allows the wielder to transfer some or all of the weapon’s enhancement bonus to his AC as a bonus that stacks with all others.',
    modifiers: [],
    situationalNotes: [
      {
        text: 'Defending: transfer some or all of this weapon’s enhancement bonus to AC until your next turn.',
      },
    ],
    detail: { kind: 'itemAbility', appliesTo: 'melee', bonusEquivalent: 1 },
  },
  {
    name: 'Light fortification',
    ruleIdentity: 'light-fortification',
    sources: core('462'),
    stacksWithItself: false,
    description:
      'This suit of armor or shield produces a magical force that protects vital areas: a 25% chance that a critical hit or sneak attack is negated and damage is instead rolled normally.',
    modifiers: [],
    situationalNotes: [
      {
        text: 'Light fortification: 25% chance to negate a critical hit or sneak attack.',
      },
    ],
    detail: {
      kind: 'itemAbility',
      appliesTo: 'armorOrShield',
      bonusEquivalent: 1,
    },
  },
  {
    name: 'Shadow',
    ruleIdentity: 'shadow',
    sources: core('463'),
    stacksWithItself: false,
    description:
      'This armor blurs the wearer whenever she tries to hide, granting a +5 competence bonus on Stealth checks. The armor’s armor check penalty still applies normally.',
    modifiers: [{ target: 'skill.ste', bonusType: 'competence', value: 5 }],
    // A flat price (3,750 gp): no bonus equivalent.
    detail: { kind: 'itemAbility', appliesTo: 'armor', bonusEquivalent: 0 },
  },
];

type MagicItemSeed = {
  name: string;
  ruleIdentity: string;
  sources: Sources;
  description: string;
  /** The Base Item's rule identity. */
  baseItem: string;
  material?: string;
  armor?: ItemDetail['armor'];
  consumable?: boolean;
  ammunition?: boolean;
  magic?: {
    enhancement?: number;
    /** Item Abilities by rule identity. */
    abilities?: string[];
  };
};

/** Official specific items: their Base Item supplies the weapon or armor. */
export const representativeMagicItemCatalog: MagicItemSeed[] = [
  {
    name: 'Flame tongue',
    ruleIdentity: 'flame-tongue',
    sources: core('473'),
    description:
      'This is a +1 flaming burst longsword. Once per day, the sword can blast forth a fiery ray at any target within 30 feet as a ranged touch attack, dealing 4d6 points of fire damage.',
    baseItem: 'longsword',
    magic: { enhancement: 1, abilities: ['flaming-burst'] },
  },
  {
    name: 'Frost brand',
    ruleIdentity: 'frost-brand',
    sources: core('473'),
    description:
      'This +3 frost greatsword sheds light as a torch when the temperature drops below 0° F. It provides fire resistance 10 to its wielder and can extinguish fires.',
    baseItem: 'greatsword',
    magic: { enhancement: 3, abilities: ['frost'] },
  },
  {
    name: 'Screaming bolt',
    ruleIdentity: 'screaming-bolt',
    sources: core('476'),
    description:
      'These +2 bolts scream when fired, forcing all enemies of the wielder within 20 feet of the path of the bolt to succeed on a DC 14 Will save or become shaken.',
    baseItem: 'bolts',
    consumable: true,
    ammunition: true,
    magic: { enhancement: 2 },
  },
  {
    name: 'Mithral shirt',
    ruleIdentity: 'mithral-shirt',
    sources: core('464–465'),
    description:
      'This extremely light chainmail shirt is made of very fine mithral links. Its numbers already include the mithral.',
    baseItem: 'chain-shirt',
    material: 'mithral',
    armor: {
      slot: 'armor',
      category: 'light',
      bonus: 4,
      maxDex: 6,
      armorCheckPenalty: 0,
      asf: 10,
    },
  },
  {
    name: 'Dwarven plate',
    ruleIdentity: 'dwarven-plate',
    sources: core('464–465'),
    description:
      'This full plate is made of adamantine, giving its wearer damage reduction 3/—.',
    baseItem: 'full-plate',
    material: 'adamantine',
  },
  {
    name: 'Darkwood shield',
    ruleIdentity: 'darkwood-shield',
    sources: core('466–467'),
    description:
      'This heavy wooden shield is made of darkwood; its numbers already include the material.',
    baseItem: 'heavy-wooden-shield',
    material: 'darkwood',
    armor: {
      slot: 'shield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 0,
      asf: 15,
    },
  },
];

/** A specific item's stored definition once its references have IDs. */
export function materializeRepresentativeMagicItem(
  seed: MagicItemSeed,
  idForRuleIdentity: (ruleIdentity: string) => Id<'catalogEntry'>,
): ItemSeed {
  return {
    name: seed.name,
    ruleIdentity: seed.ruleIdentity,
    sources: seed.sources.map((source) => ({ ...source })),
    description: seed.description,
    modifiers: [],
    stacksWithItself: false,
    detail: {
      kind: 'item',
      consumable: seed.consumable ?? false,
      ...(seed.ammunition ? { ammunition: true } : {}),
      baseItem: idForRuleIdentity(seed.baseItem),
      ...(seed.material ? { material: seed.material } : {}),
      ...(seed.armor ? { armor: { ...seed.armor } } : {}),
      ...(seed.magic
        ? {
            magic: {
              ...(seed.magic.enhancement !== undefined
                ? { enhancement: seed.magic.enhancement }
                : {}),
              ...(seed.magic.abilities
                ? {
                    abilities: seed.magic.abilities.map((ability) => ({
                      catalogEntryId: idForRuleIdentity(ability),
                    })),
                  }
                : {}),
            },
          }
        : {}),
    },
  };
}
