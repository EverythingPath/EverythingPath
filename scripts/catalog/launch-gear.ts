import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';
import {
  modifierTargets,
  personalBonusTypes,
} from '../../src/lib/character-sheet.ts';
import { unmappedChangeReason } from './formula.ts';
import type { UnsupportedIssue } from './launch-class-level-slots.ts';
import type { LaunchRow } from './launch-inventory-schema.ts';
import type { LaunchMechanismProof } from './launch-mechanism-proofs.ts';
import { heldFields, knownOutputs } from './launch-source-body.ts';

/**
 * The gear family (gear S1, #782). The inventory names `Gear and Item
 * Abilities` for every item and Item Ability row (`launch-inventory-build.ts`),
 * with a conditional contract: preserve what the source supplies. A mundane
 * suit of armor supplies its armor block and category; a shield may add
 * Situational Modifiers and notes. The public saved-sheet proof
 * (`convex/characterSheetGear.integration.test.ts`) shows each part reaching
 * the sheet: the candidate conversion keeps the armor block; a worn armor's
 * bonus reaches `ac.armor` and a shield's `ac.shield`, Dexterity to AC is
 * capped at the lowest worn cap, the penalties add on Strength and Dexterity
 * skills and spell failure is summed and shown; `lightArmor`, `mediumArmor`
 * and `heavyArmor` read light, medium and heavy proficiency and `other` shield
 * proficiency, an item worn without it costing its penalty on every attack
 * line; enhancement, masterwork and highest-only stacking apply; local
 * Situational attack penalties stay out of every total, are listed in
 * `conditional` and apply on their own line only; targeted notes reach their
 * statistic and untargeted ones the entry; and an unequipped item gives
 * nothing.
 *
 * Gear S2 adds worn items and the tower shield, with the row's `Modifier …`
 * mechanisms (one per source change), which the family proves together with
 * `Gear and Item Abilities`: a record names them exactly
 * (`modifierMechanisms`) and its basis maps each to its output, since an
 * item's changes arrive partly through curation (a change a reviewed
 * replacement zeroes, its number carried by a local Situation). The second
 * public proof (`convex/characterSheetGearModifiers.integration.test.ts`)
 * shows a worn item's unconditional Modifiers reaching their totals (a
 * deflection bonus AC, touch AC, flat-footed AC and CMD; an enhancement to
 * natural armor AC and flat-footed AC only; an enhancement to each ability
 * score every statistic its modifier feeds; a competence bonus its skill; an
 * insight bonus AC; an untyped penalty every attack line), two of one type
 * not stacking and a zero changing nothing; its local Situational CMB, Craft,
 * Perform and Stealth bonuses entering no total and applying in their
 * Situation only; notes on each ability score and on Perform; the tower
 * shield's block, its −2 and tower shield proficiency (shield proficiency
 * isn't enough); and an unequipped item giving nothing.
 *
 * Gear S3 lets a record bind each import issue on its row (`issues`) by
 * exact identity (kind, path and source bytes) to the curated output that
 * delivers it: a cloak's resistance bonus on saves for an unmapped `resist`
 * change, an amulet's enhancement bonus on attack and damage with unarmed
 * strikes and natural weapons for its `nattack` and `ndamage` changes, and
 * the tower shield's note on AC for its retained Total cover action. The
 * same public proof shows each stand-in reaching the sheet once and an
 * unequipped item giving nothing. The family takes a bound issue only when
 * every binding matches an issue of its own and names a distinct output of
 * the record; any other issue still refuses the row.
 *
 * The list rule, as for the Source-body family: no structural signal says an
 * item's outputs cover its whole body (Elven Chain's block contradicts its
 * own body), so a row is proven only when it is on the reviewed list, bound
 * to its source bytes and to the exact mechanical outputs the importer gives
 * it (`gearOutputs`), every one of a proven shape. A record's `basis` quotes
 * the body and the Core Rulebook statistics and maps each clause to an
 * output or to a settled text rule (`docs/character-sheet/weapons-and-armor.md`).
 * A changed source, importer output or new importer field drops the row,
 * visibly, until it is reviewed again; a `weapon`, `magic`, `baseItemKey` or
 * `ammunition` detail is no proven shape, and any `unsupported` issue its
 * record doesn't bind refuses the row (`disqualifying: ['*']`,
 * `gearUnboundIssues`). A row joins through a list amendment in the wave
 * that admits it.
 *
 * Out of the list, with owners: Buckler until the owner answers O3 on #782
 * (`reviewedBuckler`); shields with a bash; Tower Shield, Cloaks of
 * Resistance and Amulets of Mighty Fists until an item wave lists them with
 * their bindings; spell resistance, which has no sheet statistic to stand
 * in; specific and magic armor
 * (#761, #764); weapons and ammunition (#761); Item Abilities (#764); rows
 * whose block contradicts or omits a body number (curation first: #424,
 * #457–#460); medium and heavy armor's speed (O1); gear with no sheet output
 * (O2); and every held row (gear S2 and S3 list none).
 */
export const gearMechanism = 'Gear and Item Abilities';
/**
 * The prefix of the inventory's per-change mechanism names (the registry's
 * `modifierMechanismPrefix`, which imports this module).
 */
const modifierPrefix = 'Modifier ';

const armorBlock = <Slot extends 'armor' | 'shield'>(slot: Slot) =>
  z.strictObject({
    slot: z.literal(slot),
    category: z.string().min(1),
    bonus: z.number().finite(),
    maxDex: z.number().finite().nullable(),
    armorCheckPenalty: z.number().finite().nonnegative(),
    asf: z.number().finite().nonnegative(),
  });
/**
 * A Modifier: unconditional, in a local Situation, or (gear S3) in a weapon
 * condition.
 */
const modifierSchema = z.strictObject({
  target: z.string().min(1),
  bonusType: z.string().min(1),
  value: z.number().finite(),
  condition: z
    .union([
      z.strictObject({
        situation: z.strictObject({ local: z.string().min(1) }),
      }),
      z.strictObject({ weapon: z.string().min(1) }),
    ])
    .optional(),
});
const noteSchema = z.strictObject({
  text: z.string().min(1),
  target: z.string().min(1).optional(),
});
/** A non-empty list, inferred as `[T, ...T[]]`; an empty one is refused. */
const nonEmpty = <Item extends z.ZodType>(item: Item) => z.tuple([item], item);
const modifiersSchema = nonEmpty(modifierSchema);
const notesSchema = nonEmpty(noteSchema);
/** A worn armor's or shield's outputs: its block, and any Modifiers and notes. */
const blockOutputs = <Slot extends 'armor' | 'shield'>(slot: Slot) =>
  z.strictObject({
    detail: z.strictObject({
      consumable: z.literal(false),
      armor: armorBlock(slot),
    }),
    modifiers: modifiersSchema.optional(),
    situationalNotes: notesSchema.optional(),
  });
const wornItemDetail = z.strictObject({ consumable: z.literal(false) });
/** A worn item's outputs (gear S2): no block, and a Modifier or a note. */
const wornItemOutputs = z.union([
  z.strictObject({
    detail: wornItemDetail,
    modifiers: modifiersSchema,
    situationalNotes: notesSchema.optional(),
  }),
  z.strictObject({
    detail: wornItemDetail,
    modifiers: modifiersSchema.optional(),
    situationalNotes: notesSchema,
  }),
]);

/**
 * The importer's reason for each kind of issue a record may bind (gear S3):
 * a raw change it leaves unmapped (`scripts/catalog/map.ts`, `changes`), and
 * source game content it retains for curation (`gameContent`).
 */
const boundIssueReasons = {
  unmappedChange: unmappedChangeReason,
  retainedGameContent:
    'Source game-content fields retained for feature curation; only explicitly mapped detail/modifiers have an interpretation.',
} as const;
/**
 * One import issue a record binds (gear S3), by its exact identity: its kind
 * (the importer's reason, `boundIssueReasons`), its path (the issue's
 * `field`) and its source bytes (the issue's `value`), with the curated
 * output that delivers it, which is one of the record's outputs. A raw change
 * is delivered by a Modifier, and retained game content by a note.
 */
const boundIssueSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('unmappedChange'),
    path: z.literal('changes'),
    source: z.strictObject({
      target: z.string().min(1),
      formula: z.string().min(1),
      type: z.string().min(1),
    }),
    deliveredBy: z.strictObject({ modifier: modifierSchema }),
  }),
  z.strictObject({
    kind: z.literal('retainedGameContent'),
    path: z.literal('gameContent'),
    source: z.record(z.string(), z.unknown()),
    deliveredBy: z.strictObject({ note: noteSchema }),
  }),
]);
type BoundIssue = z.infer<typeof boundIssueSchema>;

const reviewedFields = {
  key: catalogKeySchema,
  name: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * The row's `Modifier …` mechanisms, exactly, one per source change (gear
   * S2): the family proves them with `Gear and Item Abilities`, all or none,
   * and the basis maps each to its output.
   */
  modifierMechanisms: z
    .array(z.string().startsWith(modifierPrefix))
    .nonempty()
    .optional(),
  /**
   * Every import issue on the row's entry, each bound to the curated output
   * that delivers it (gear S3): the family takes these, and any other issue
   * still refuses the row.
   */
  issues: nonEmpty(boundIssueSchema).optional(),
  /** The body and statistics, quoted, with each clause mapped to its delivery. */
  basis: z.string().min(1),
};
/**
 * A reviewed record, by its shape: a worn suit of armor (its block in the
 * armor slot), a shield without a bash (its block in the shield slot), or a
 * worn item with no block (gear S2: a ring, amulet, belt, headband, cloak,
 * tool or ioun stone). `outputs` is the exact mechanical outputs the
 * importer gives the row (`gearOutputs`).
 */
const reviewedGearSchema = z.discriminatedUnion('shape', [
  z.strictObject({
    ...reviewedFields,
    shape: z.literal('worn-armor'),
    outputs: blockOutputs('armor'),
  }),
  z.strictObject({
    ...reviewedFields,
    shape: z.literal('shield'),
    outputs: blockOutputs('shield'),
  }),
  z.strictObject({
    ...reviewedFields,
    shape: z.literal('worn-item'),
    outputs: wornItemOutputs,
  }),
]);
export type ReviewedGear = z.infer<typeof reviewedGearSchema>;

/** A Modifier value's class: the scope proves each class on its own. */
const valueClasses = ['negative', 'zero', 'positive'] as const;
export function gearValueClass(value: number) {
  if (value < 0) return 'negative';
  return value === 0 ? 'zero' : 'positive';
}

/**
 * Proven Modifiers: each target with the bonus types and value classes
 * proven on it, every combination of the two by a public case (the coverage
 * tie in `tests/catalog/launch-gear.test.ts`).
 */
const provenModifiersSchema = z
  .array(
    z.strictObject({
      target: z.enum(modifierTargets),
      bonusTypes: z.array(z.enum(personalBonusTypes)).nonempty(),
      values: z.array(z.enum(valueClasses)).nonempty(),
    }),
  )
  .nonempty();

/**
 * The family's scope: each proven shape with its imported categories (read
 * through the app's alias table, `armorProficiencyCategory`), the
 * unconditional, the local Situational and the weapon-conditioned Modifiers'
 * targets each with its proven bonus types and value classes, the note
 * targets, and the reviewed list. Untargeted notes reach the entry and are
 * always in scope.
 */
export const gearScopeSchema = z.strictObject({
  shapes: z
    .array(
      z.discriminatedUnion('shape', [
        z.strictObject({
          shape: z.literal('worn-armor'),
          categories: z
            .array(z.enum(['lightArmor', 'mediumArmor', 'heavyArmor']))
            .nonempty(),
        }),
        z.strictObject({
          shape: z.literal('shield'),
          categories: z.array(z.enum(['other', 'towerShield'])).nonempty(),
        }),
        z.strictObject({ shape: z.literal('worn-item') }),
      ]),
    )
    .nonempty(),
  modifiers: provenModifiersSchema,
  situationalModifiers: provenModifiersSchema,
  /**
   * Proven Modifiers in a weapon condition (gear S3): an enhancement bonus
   * with unarmed strikes and natural weapons.
   */
  weaponModifiers: z
    .array(
      z.strictObject({
        weapon: z.enum(['$unarmedOrNatural']),
        target: z.enum(modifierTargets),
        bonusTypes: z.array(z.enum(personalBonusTypes)).nonempty(),
        values: z.array(z.enum(valueClasses)).nonempty(),
      }),
    )
    .nonempty(),
  noteTargets: z.array(z.enum(modifierTargets)).nonempty(),
  reviewed: z.array(reviewedGearSchema),
});
type GearScope = z.infer<typeof gearScopeSchema>;

const corePcgen =
  'tests/fixtures/pinned/pcgen/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_equip_arms_armor.lst';

/**
 * The reviewed list (gear S1): Chain Shirt, read at its pin (pf1
 * `418761d2`). `drafted` until a cross-model review checks it.
 */
const reviewedGear = [
  {
    key: 'pf1/iGu21zy6QtroUZ4O',
    name: 'Chain Shirt',
    sourceSha256:
      '98425d76ca49502dd144af6c31705ae41e8c8cc5f4b164a22197c636fce5a52a',
    outputs: {
      detail: {
        consumable: false,
        armor: {
          slot: 'armor',
          category: 'lightArmor',
          bonus: 4,
          maxDex: 4,
          armorCheckPenalty: 2,
          asf: 20,
        },
      },
    },
    basis: `packs/armors-and-shields/chain-shirt.iGu21zy6QtroUZ4O.yaml: "Covering the torso, this shirt is made up of thousands of interlocking metal rings" has no number. Its statistics are the Core Rulebook row (${corePcgen}:40: TYPE Armor.Light, BONUS:COMBAT|AC|4|TYPE=Armor, MAXDEX:4, ACCHECK:-2, SPELLFAILURE:20; Foundry armor.value 4, dex 4, acp 2, spellFailure 20, no equipmentSubtype): the +4 armor bonus is bonus 4 on ac.armor; maximum Dex bonus +4 is maxDex 4; the -2 armor check penalty is armorCheckPenalty 2 on Strength and Dexterity skills and, without proficiency, on attack rolls; 20% arcane spell failure is asf 20, shown but not rolled (weapons-and-armor.md, spell failure); light armor is category lightArmor, read as light proficiency, and leaves speed unchanged. Its price (100 gp) and weight (25 lb.) hold no sheet number.`,
    shape: 'worn-armor',
  },
];

/**
 * Buckler, reviewed with the same rule but not listed: the body's "you lose
 * the buckler's AC bonus until your next turn" stays a note on AC, by analogy
 * with a bash's lost AC bonus (weapons-and-armor.md), and whether it may
 * count so is the owner's question O3 on #782. A yes adds it to the list.
 */
export const reviewedBuckler = {
  key: 'pf1/gsE0PAOmCwivue5A',
  name: 'Buckler',
  sourceSha256:
    'c1c445925eff90a7a043ccfdba4800700d8645100b89e84f89d8064fb976c285',
  outputs: {
    detail: {
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'other',
        bonus: 1,
        maxDex: null,
        armorCheckPenalty: 1,
        asf: 5,
      },
    },
    modifiers: [
      {
        target: 'attack.melee',
        bonusType: 'untyped',
        value: -1,
        condition: {
          situation: {
            local:
              'while your buckler arm wields a melee weapon (an off-hand weapon, or helping to wield a two-handed weapon)',
          },
        },
      },
      {
        target: 'attack.ranged',
        bonusType: 'untyped',
        value: -1,
        condition: {
          situation: {
            local:
              'while your buckler arm wields a ranged weapon other than a bow or crossbow',
          },
        },
      },
    ],
    situationalNotes: [
      {
        target: 'attack',
        text: 'You can use a bow or crossbow without penalty while carrying it.',
      },
      {
        target: 'ac',
        text: 'In any case, if you use a weapon in your off hand, you lose the buckler’s AC bonus until your next turn. You can cast a spell with somatic components using your shield arm, but you lose the buckler’s AC bonus until your next turn. You can’t make a shield bash with a buckler.',
      },
    ],
  },
  basis: `packs/armors-and-shields/buckler.gsE0PAOmCwivue5A.yaml, with the Core Rulebook row (${corePcgen}:109: TYPE Shield.Buckler, BONUS:COMBAT|AC|1|TYPE=Shield, ACCHECK:-1, SPELLFAILURE:5, no MAXDEX; Foundry armor.value 1, acp 1, spellFailure 5, equipmentSubtype other): the +1 shield bonus is bonus 1 on ac.shield; no maximum Dex bonus is maxDex null; the -1 armor check penalty is armorCheckPenalty 1; 5% arcane spell failure is asf 5, shown but not rolled; category other is read as shield proficiency. "You can use a bow or crossbow without penalty while carrying it": a note on attack, and the ranged penalty's Situation leaves bows and crossbows out. "You can also use your shield arm to wield a weapon (whether you are using an off-hand weapon or using your off hand to help wield a two-handed weapon), but you take a –1 penalty on attack rolls while doing so": attack.melee and attack.ranged -1 untyped, each in its local Situation, applied on its own line only. "This penalty stacks with those that may apply for fighting with your off hand and for fighting with two weapons": untyped, so it stacks. "In any case, if you use a weapon in your off hand, you lose the buckler's AC bonus until your next turn. You can cast a spell with somatic components using your shield arm, but you lose the buckler's AC bonus until your next turn": play-time state, a note on AC; the sheet keeps the bonus (O3). "You can't make a shield bash with a buckler": no weapon detail, and the same note. Its price (5 gp) and weight (5 lb.) hold no sheet number. #424's checked mechanics review records the same outputs (scripts/catalog/legal/armors-and-shields-424.json).`,
  shape: 'shield',
} as const;

const abilityTargets = [
  'ability.str',
  'ability.dex',
  'ability.con',
  'ability.int',
  'ability.wis',
  'ability.cha',
] as const;

/** The family's raw registry entry (`launchMechanismProofs`). */
export const gearProofEntry = {
  family: 'gear',
  mechanism: gearMechanism,
  kinds: ['item'],
  tests: [
    {
      path: 'convex/characterSheetGear.integration.test.ts',
      sha256:
        'bc41927f5163e8df74d9308e65c99048436b49e246fbbc1ecdcb51dceada4520',
    },
    {
      path: 'convex/characterSheetGearModifiers.integration.test.ts',
      sha256:
        '18f2fc464737db904f1d88a802a898561a8abeac04d717209ba1feadebc2b3c3',
    },
    // The public tests' item fixtures, bound as the tests are: the coverage
    // tie reads what they release.
    {
      path: 'tests/gear-proof-armor.ts',
      sha256:
        '5b5f6ebe62030e216e57c2c546d14148c1a3859143c43db7d78c90c802e6c76f',
    },
    {
      path: 'tests/gear-proof-worn-items.ts',
      sha256:
        'fa8929d49f7be3c8d5648e50cc487c6ded405af5c83bcd62f3943f396bd0cb4d',
    },
  ],
  calculationIdentity:
    'sha256:7b391eb1b9753eb4f82879ef5ede0794c0ad5866c186cba61604c898b66c82cf',
  disqualifying: ['*'],
  gear: {
    shapes: [
      {
        shape: 'worn-armor',
        categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
      },
      { shape: 'shield', categories: ['other', 'towerShield'] },
      { shape: 'worn-item' },
    ],
    modifiers: [
      {
        target: 'ac',
        bonusTypes: ['deflection', 'insight'],
        values: ['positive'],
      },
      {
        target: 'ac.natural',
        bonusTypes: ['enhancement'],
        values: ['positive'],
      },
      ...abilityTargets.map((target) => ({
        target,
        bonusTypes: ['enhancement' as const],
        values: ['positive' as const],
      })),
      { target: 'skill.clm', bonusTypes: ['competence'], values: ['positive'] },
      // A change a reviewed replacement zeroes, its number carried by a
      // local Situation: only zero is proven unconditional here, so an
      // unzeroed record is refused.
      { target: 'skill.crf', bonusTypes: ['circumstance'], values: ['zero'] },
      { target: 'skill.prf', bonusTypes: ['circumstance'], values: ['zero'] },
      { target: 'skill.ste', bonusTypes: ['competence'], values: ['zero'] },
      { target: 'attack', bonusTypes: ['untyped'], values: ['negative'] },
      // Gear S3: the stand-in for a cloak's unmapped `resist` change.
      { target: 'saves', bonusTypes: ['resistance'], values: ['positive'] },
    ],
    situationalModifiers: [
      { target: 'attack.melee', bonusTypes: ['untyped'], values: ['negative'] },
      {
        target: 'attack.ranged',
        bonusTypes: ['untyped'],
        values: ['negative'],
      },
      { target: 'cmb', bonusTypes: ['insight'], values: ['positive'] },
      {
        target: 'skill.crf',
        bonusTypes: ['circumstance'],
        values: ['positive'],
      },
      {
        target: 'skill.prf',
        bonusTypes: ['circumstance'],
        values: ['positive'],
      },
      { target: 'skill.ste', bonusTypes: ['competence'], values: ['positive'] },
    ],
    // Gear S3: the stand-ins for an amulet's unmapped `nattack` and
    // `ndamage` changes.
    weaponModifiers: [
      {
        weapon: '$unarmedOrNatural',
        target: 'attack',
        bonusTypes: ['enhancement'],
        values: ['positive'],
      },
      {
        weapon: '$unarmedOrNatural',
        target: 'damage',
        bonusTypes: ['enhancement'],
        values: ['positive'],
      },
    ],
    noteTargets: ['attack', 'ac', ...abilityTargets, 'skill.prf'],
    reviewed: reviewedGear,
  },
};

/** The kinds the family proves, whatever its registry entry names. */
const provenRowKinds = ['item'];
/** Entry fields that hold no sheet mechanic. */
const textFields = new Set([
  'externalKey',
  'upstreamKey',
  'pack',
  'name',
  'description',
  'guidanceText',
  'sources',
  'provenance',
  'attributionFrom',
  'unsupported',
]);
/** Entry fields that hold the proven mechanics. */
const outputFields = ['modifiers', 'situationalNotes'];
/** An item detail's fields: those holding no sheet number, and the outputs. */
const detailText = ['kind', 'price', 'weight'];
const detailOutputs = ['consumable', 'armor'];

/**
 * An item entry's mechanical outputs: its Modifiers and notes, and its
 * detail's `consumable` and armor block, each that holds a value. A field the
 * projection doesn't know, on the entry or its detail (a `weapon`, `magic`,
 * `baseItemKey` or `ammunition` detail, `proficiencies`, `sourceKey` or a new
 * importer field), gives none, so it drops a listed row until it is
 * reviewed. An entry whose detail isn't an item's gives none.
 */
export function gearOutputs(entry: unknown) {
  const fields = heldFields(entry);
  const detail = heldFields(fields?.find(([field]) => field === 'detail')?.[1]);
  if (
    !fields ||
    !detail?.some(([field, kind]) => field === 'kind' && kind === 'item')
  )
    return undefined;
  const outputs = knownOutputs(
    fields.filter(([field]) => field !== 'detail' && !textFields.has(field)),
    outputFields,
  );
  const held = knownOutputs(
    detail.filter(([field]) => !detailText.includes(field)),
    detailOutputs,
  );
  return outputs && held ? { ...outputs, detail: held } : undefined;
}

type ReviewedModifier = z.infer<typeof modifierSchema>;

/**
 * The scope's list for the Modifier's condition (unconditional, local
 * Situational, or this weapon condition) covers its target with its bonus
 * type and value class.
 */
function covers(
  scope: GearScope,
  { target, bonusType, value, condition }: ReviewedModifier,
) {
  const proven: readonly {
    target: string;
    bonusTypes: readonly string[];
    values: readonly string[];
  }[] = !condition
    ? scope.modifiers
    : 'situation' in condition
      ? scope.situationalModifiers
      : scope.weaponModifiers.filter(
          ({ weapon }) => weapon === condition.weapon,
        );
  return proven.some(
    (scoped) =>
      scoped.target === target &&
      scoped.bonusTypes.includes(bonusType) &&
      scoped.values.includes(gearValueClass(value)),
  );
}

/**
 * The scope proves the record's shape and, for a worn armor or shield, its
 * block's category for that shape (the record's shape fixes the block's
 * slot, and a worn item has none).
 */
function shapeInScope(scope: GearScope, record: ReviewedGear) {
  const proven = scope.shapes.find((scoped) => scoped.shape === record.shape);
  if (!proven || record.shape === 'worn-item') return proven !== undefined;
  const categories: readonly string[] =
    'categories' in proven ? proven.categories : [];
  return categories.includes(record.outputs.detail.armor.category);
}

/**
 * The record's outputs are of a scope shape and category; every Modifier,
 * unconditional, in a local Situation or in a weapon condition, has a target
 * its list proves with that bonus type and value class; and every targeted
 * note has a scope note target. A bound issue's stand-in is one of these
 * outputs, so it is proven as they are.
 */
function inScope(scope: GearScope, record: ReviewedGear) {
  const noteTargets: readonly string[] = scope.noteTargets;
  const { modifiers = [], situationalNotes = [] } = record.outputs;
  return (
    shapeInScope(scope, record) &&
    modifiers.every((modifier) => covers(scope, modifier)) &&
    situationalNotes.every(
      ({ target }) => target === undefined || noteTargets.includes(target),
    )
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'mechanisms' | 'sources'>;
type GearInput = {
  row: ProvenRow;
  /** The row's scoped build entry. */
  entry: unknown;
  /** The row's `unsupported` issues. */
  issues: readonly UnsupportedIssue[];
};

/** An issue's exact identity: its reason, field and value, as bytes. */
const issueIdentity = ({ field, reason, value }: UnsupportedIssue) =>
  canonicalReleaseJson({ field, reason, value });
const boundIdentity = (bound: BoundIssue) =>
  issueIdentity({
    field: bound.path,
    reason: boundIssueReasons[bound.kind],
    value: bound.source,
  });

/**
 * The row's issues its listed record leaves unbound (gear S3): each binding
 * takes an issue of its own by exact identity, and the rest are left.
 * Undefined when a binding matches none. A row with no binding record binds
 * none.
 */
function unboundIssues(
  scope: GearScope,
  key: string,
  issues: readonly UnsupportedIssue[],
) {
  const left = [...issues];
  const record = scope.reviewed.find((reviewed) => reviewed.key === key);
  for (const binding of record?.issues ?? []) {
    const index = left.findIndex(
      (issue) => issueIdentity(issue) === boundIdentity(binding),
    );
    if (index < 0) return undefined;
    left.splice(index, 1);
  }
  return left;
}

/**
 * The issues that still refuse the row under this registry entry: for the
 * gear family, those its listed record doesn't bind (all of them when a
 * binding matches none); for any other entry, every one.
 */
export function gearUnboundIssues(
  proof: LaunchMechanismProof,
  key: string,
  issues: readonly UnsupportedIssue[],
) {
  if (!('gear' in proof)) return issues;
  return unboundIssues(proof.gear, key, issues) ?? issues;
}

/**
 * Each binding's stand-in is an output of the record, a distinct one for
 * each binding, and a raw change's Modifier carries the change's formula as
 * its value.
 */
function standInsDelivered(record: ReviewedGear) {
  const { modifiers = [], situationalNotes = [] } = record.outputs;
  const outputs = [...modifiers, ...situationalNotes].map(canonicalReleaseJson);
  const bindings = record.issues ?? [];
  const standIns = bindings.map((bound) =>
    canonicalReleaseJson(
      bound.kind === 'unmappedChange'
        ? bound.deliveredBy.modifier
        : bound.deliveredBy.note,
    ),
  );
  return (
    new Set(standIns).size === standIns.length &&
    standIns.every((standIn) => outputs.includes(standIn)) &&
    bindings.every(
      (bound) =>
        bound.kind !== 'unmappedChange' ||
        bound.source.formula === String(bound.deliveredBy.modifier.value),
    )
  );
}

/**
 * Whether the family proves the row's `Gear and Item Abilities` and its
 * `Modifier …` mechanisms: the row is an item whose mechanisms are exactly
 * those the record names, on the reviewed list with its bound source bytes;
 * its scoped entry is an item with exactly the reviewed outputs; they are of
 * a scope shape, category, target and bonus type; and every binding of the
 * record matches an issue of the row, delivered by its own stand-in (gear
 * S3). The issues the record binds no longer refuse the row
 * (`gearUnboundIssues`); every other one still does.
 */
function gearProven(scope: GearScope, { row, entry, issues }: GearInput) {
  const reviewed = reviewedRow(scope, row);
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  const outputs = gearOutputs(entry);
  return (
    reviewed !== undefined &&
    unboundIssues(scope, row.key, issues) !== undefined &&
    standInsDelivered(reviewed) &&
    parsed.success &&
    parsed.data.detail.kind === 'item' &&
    outputs !== undefined &&
    canonicalReleaseJson(outputs) === canonicalReleaseJson(reviewed.outputs) &&
    inScope(scope, reviewed)
  );
}

/** Names as a sorted list, so two multisets compare equal. */
const sorted = (names: readonly string[]) => JSON.stringify([...names].sort());

/**
 * The row's reviewed record: an item row whose mechanisms are `Gear and Item
 * Abilities` once and exactly the record's `Modifier …` mechanisms, on the
 * list, bound to the reviewed source bytes.
 */
function reviewedRow(scope: GearScope, row: ProvenRow) {
  const reviewed = scope.reviewed.find(({ key }) => key === row.key);
  const names = row.mechanisms.map(({ name }) => name);
  return reviewed &&
    provenRowKinds.includes(row.kind) &&
    names.filter((name) => name === gearMechanism).length === 1 &&
    sorted(names.filter((name) => name !== gearMechanism)) ===
      sorted(reviewed.modifierMechanisms ?? []) &&
    row.sources.some(({ rawSha256 }) => rawSha256 === reviewed.sourceSha256)
    ? reviewed
    : undefined;
}

/**
 * Whether the family names this mechanism for the row with this key, judged
 * by the name alone: `Gear and Item Abilities`, and a listed record's
 * `Modifier …` mechanisms. It proves them only together, through `gearGate`.
 */
export function gearNamesMechanism(
  scope: GearScope,
  key: string,
  name: string,
) {
  return (
    name === gearMechanism ||
    scope.reviewed.some(
      (record) =>
        record.key === key && (record.modifierMechanisms ?? []).includes(name),
    )
  );
}

/**
 * The projection's gate for one registry entry and row: this family's entry
 * proves only through `gearProven`; any other entry naming `Gear and Item
 * Abilities`, with a scope or without, proves nothing; every other entry
 * passes.
 */
export function gearGate(proof: LaunchMechanismProof, input: GearInput) {
  if ('gear' in proof) return gearProven(proof.gear, input);
  return !('mechanism' in proof && proof.mechanism === gearMechanism);
}
