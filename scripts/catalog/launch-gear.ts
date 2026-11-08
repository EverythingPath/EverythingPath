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
 * The list rule, as for the Source-body family: no structural signal says an
 * item's outputs cover its whole body (Elven Chain's block contradicts its
 * own body), so a row is proven only when it is on the reviewed list, bound
 * to its source bytes and to the exact mechanical outputs the importer gives
 * it (`gearOutputs`), every one of a proven shape. A record's `basis` quotes
 * the body and the Core Rulebook statistics and maps each clause to an
 * output or to a settled text rule (`docs/character-sheet/weapons-and-armor.md`).
 * A changed source, importer output or new importer field drops the row,
 * visibly, until it is reviewed again; a `weapon`, `magic`, `baseItemKey` or
 * `ammunition` detail is no proven shape, and any `unsupported` issue refuses
 * the row (`disqualifying: ['*']`). A row joins through a list amendment in
 * the wave that admits it.
 *
 * Out of the first list, with owners: Buckler until the owner answers O3 on
 * #782 (`reviewedBuckler`); shields with a bash and Tower Shield; specific and
 * magic armor (#761, #764); weapons and ammunition (#761); Item Abilities
 * (#764); other items' Modifiers; rows whose block contradicts or omits a
 * body number (curation first: #424, #457–#460); medium and heavy armor's
 * speed (O1); gear with no sheet output (O2); and every held row.
 */
export const gearMechanism = 'Gear and Item Abilities';

/** A worn suit of armor, and a shield without a bash. */
const gearShapes = ['worn-armor', 'shield'] as const;
const shapeSlots = { 'worn-armor': 'armor', shield: 'shield' } as const;

const armorBlockSchema = z.strictObject({
  slot: z.enum(['armor', 'shield']),
  category: z.string().min(1),
  bonus: z.number().finite(),
  maxDex: z.number().finite().nullable(),
  armorCheckPenalty: z.number().finite().nonnegative(),
  asf: z.number().finite().nonnegative(),
});
const modifierSchema = z.strictObject({
  target: z.string().min(1),
  bonusType: z.string().min(1),
  value: z.number().finite(),
  condition: z.strictObject({
    situation: z.strictObject({ local: z.string().min(1) }),
  }),
});
const noteSchema = z.strictObject({
  text: z.string().min(1),
  target: z.string().min(1).optional(),
});
/** An item's mechanical outputs, as `gearOutputs` projects its entry. */
const gearOutputsSchema = z.strictObject({
  detail: z.strictObject({
    consumable: z.literal(false),
    armor: armorBlockSchema,
  }),
  modifiers: z.array(modifierSchema).nonempty().optional(),
  situationalNotes: z.array(noteSchema).nonempty().optional(),
});
type GearOutputs = z.infer<typeof gearOutputsSchema>;

const reviewedGearSchema = z.strictObject({
  key: catalogKeySchema,
  name: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** The exact mechanical outputs the importer gives the row. */
  outputs: gearOutputsSchema,
  /** The body and statistics, quoted, with each clause mapped to its delivery. */
  basis: z.string().min(1),
  shape: z.enum(gearShapes),
});

/**
 * The family's scope: each proven shape with its imported categories (read
 * through the app's alias table, `armorProficiencyCategory`), the Situational
 * Modifiers' targets and bonus types, the note targets, and the reviewed
 * list. Untargeted notes reach the entry and are always in scope.
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
          categories: z.array(z.enum(['other'])).nonempty(),
        }),
      ]),
    )
    .nonempty(),
  targets: z.array(z.enum(modifierTargets)).nonempty(),
  bonusTypes: z.array(z.enum(personalBonusTypes)).nonempty(),
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

/** The family's raw registry entry (`launchMechanismProofs`). */
export const gearProofEntry = {
  family: 'gear',
  mechanism: gearMechanism,
  kinds: ['item'],
  tests: [
    {
      path: 'convex/characterSheetGear.integration.test.ts',
      sha256:
        '991be6958b94c5a3a2eee92c21ca90349bd7d148205c35139cba06690265bb8b',
    },
  ],
  calculationIdentity:
    'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
  disqualifying: ['*'],
  gear: {
    shapes: [
      {
        shape: 'worn-armor',
        categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
      },
      { shape: 'shield', categories: ['other'] },
    ],
    targets: ['attack.melee', 'attack.ranged'],
    bonusTypes: ['untyped'],
    noteTargets: ['attack', 'ac'],
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

/**
 * The record's outputs are of a scope shape: the block's slot is the
 * record's shape's, its category one the scope proves for that shape, and
 * every Modifier and note targets a scope target with a scope bonus type.
 */
function inScope(
  scope: GearScope,
  { shape, outputs }: { shape: string; outputs: GearOutputs },
) {
  const { armor } = outputs.detail;
  const proven = scope.shapes.find((scoped) => scoped.shape === shape);
  const categories: readonly string[] = proven?.categories ?? [];
  const targets: readonly string[] = scope.targets;
  const bonusTypes: readonly string[] = scope.bonusTypes;
  const noteTargets: readonly string[] = scope.noteTargets;
  return (
    proven !== undefined &&
    armor.slot === shapeSlots[proven.shape] &&
    categories.includes(armor.category) &&
    (outputs.modifiers ?? []).every(
      ({ target, bonusType }) =>
        targets.includes(target) && bonusTypes.includes(bonusType),
    ) &&
    (outputs.situationalNotes ?? []).every(
      ({ target }) => target === undefined || noteTargets.includes(target),
    )
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'mechanisms' | 'sources'>;
type GearInput = {
  row: ProvenRow;
  /** The row's scoped build entry. */
  entry: unknown;
};

/**
 * Whether the family proves the row's `Gear and Item Abilities`: the row is
 * an item whose one mechanism it is, on the reviewed list with its bound
 * source bytes; its scoped entry is an item with exactly the reviewed
 * outputs; and they are of a scope shape, category, target and bonus type.
 */
function gearProven(scope: GearScope, { row, entry }: GearInput) {
  const reviewed = reviewedRow(scope, row);
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  const outputs = gearOutputs(entry);
  return (
    reviewed !== undefined &&
    parsed.success &&
    parsed.data.detail.kind === 'item' &&
    outputs !== undefined &&
    canonicalReleaseJson(outputs) === canonicalReleaseJson(reviewed.outputs) &&
    inScope(scope, reviewed)
  );
}

/**
 * The row's reviewed record: an item row whose one mechanism is `Gear and
 * Item Abilities`, on the list, bound to the reviewed source bytes.
 */
function reviewedRow(scope: GearScope, row: ProvenRow) {
  const reviewed = scope.reviewed.find(({ key }) => key === row.key);
  return reviewed &&
    provenRowKinds.includes(row.kind) &&
    row.mechanisms.length === 1 &&
    row.mechanisms[0]?.name === gearMechanism &&
    row.sources.some(({ rawSha256 }) => rawSha256 === reviewed.sourceSha256)
    ? reviewed
    : undefined;
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
