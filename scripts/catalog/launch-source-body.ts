import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';
import {
  normalizePrerequisiteAtom,
  type Prerequisite,
  prerequisiteSchema,
} from '../../src/lib/character-sheet-prerequisite-schema.ts';
import {
  modifierTargets,
  personalBonusTypes,
} from '../../src/lib/character-sheet.ts';
import type { LaunchRow } from './launch-inventory-schema.ts';
import type { LaunchMechanismProof } from './launch-mechanism-proofs.ts';
import { sourceBodyMechanism } from './launch-prose-categories.ts';

/**
 * The Source-body family (body S1, #778). The inventory names `Source body
 * mechanics` for a row with no other mechanism (`launch-inventory-build.ts`):
 * no source change, no Prerequisites paragraph, no class association. Its
 * contract is the whole source body, so any Modifier the entry carries comes
 * from curation, never from a raw change. The public saved-sheet proof
 * (`convex/characterSheetSourceBody.integration.test.ts`) shows each output
 * kind reaching the sheet: Situational Modifiers on the scope's targets and
 * bonus types stay out of every total, are listed in `conditional` with
 * their Situation and apply in it (one entry's Situations never stacking, a
 * dodge bonus reaching touch AC and CMD but not flat-footed AC, caster level
 * only against spell resistance), on routine lines too; untargeted notes
 * reach the entry and targeted ones their statistic; `countsAsRaces` meets a
 * race prerequisite while the trait is active; and `favoredClassCount: 2`
 * allows two favored classes. body-ext adds CMB (never CMD), each save
 * target on its own save only, ten skills (Craft and Profession among them),
 * spell DC, the `trait` bonus type (highest only among traits, stacking with
 * a racial bonus) and the `trait` kind, chosen as a Selection and leaving
 * the sheet when made inactive. A released Wizard shows spell DC on its real
 * slot DCs, and caster level and concentration on its Spellcasting's own,
 * each only in its Situation (body-ext fix r1). body-ext-2 adds damage
 * (every routine line) and melee damage (melee lines only), with notes on
 * each, and the `circumstance` bonus type (stacking across sources) and the
 * `competence` type (highest only across sources; a `stacksWithinEntry`
 * increment adds to its entry's own bonus, on the Spellcasting's own
 * concentration too). body-ext-3 adds `replaces`, list-bound like every
 * output: an alternate Racial Trait's record names the standard traits it
 * replaces, equal to its entry's `detail.replaces` (stable keys, in the
 * importer's order); chosen, the alternate takes them off the sheet (dormant,
 * replaced, none of their outputs left) and its own body proves. Fix r1:
 * the alternate has one race and each replaced key is a standard Racial
 * Trait of it in the scoped build (`replacementsCertified`), at most
 * `mostReplaced` of them; the public proof exercises one, two and three, from
 * the fixture `tests/source-body-proof-alternates.ts` the entry binds, and
 * the catalog test's coverage tie keeps every certified shape exercised. An
 * entry whose replacement the importer left unresolved
 * (`unresolvedReplacements`) has no proven kind for it. sb-tie certifies
 * Modifiers and notes word by word (`certifiedSourceBodyWords`): a
 * Situational Modifier's Situation kind, target, bonus type and value class,
 * and a note's target and Situation kind. Each word is one a listed row, an
 * RT2 or TR1 candidate or another body row of the next-met sweep uses, and
 * the public word fixture (`tests/source-body-proof-words.ts`, bound beside
 * the proof) releases one body for it, which the proof asserts alike: listed
 * on exactly the statistics its target reaches, no total changed outside its
 * Situation, and the value added inside it. The catalog test's word tie
 * fails when the scope certifies a word no case releases.
 *
 * The list rule: no structural signal says an entry's outputs cover its
 * whole body (Low-Light Vision carries only its description note, the
 * metamagic feats nothing), so a row is proven only when it is on the
 * reviewed list, bound to its source bytes and to the exact mechanical
 * outputs the importer gives it, every one of a proven kind. A record's
 * `basis` quotes the body and maps each clause to an output, to a #228
 * situational note for a clause with no number (R4), or to the Unchained
 * stamina line for an appended Combat Trick (R5). A record with no outputs
 * (every output field absent, `undefined`, `null` or empty: `outputKinds`)
 * is refused, so a body is never listed as "nothing to compute". A changed
 * source, importer output or new importer field drops the row, visibly,
 * until it is reviewed again. A row joins through a list amendment in the
 * wave that admits it; a later contract joins as an output kind with a case
 * in the public proof.
 *
 * Out of the first list, with owners: the five Weapon Familiarity traits
 * ("treat X weapons as martial" and the composite bows aren't curated:
 * #740, #720; then a `proficiencies` kind); Improved Unarmed Strike (its
 * lines key the hand-written identity: #719/#720); Spell Focus (its school
 * choice is unstructured: #331); generic Skill Focus (no chosen skill: owner
 * question O3); the 17 bodies whose only promise has no sheet statistic
 * (Low-Light Vision, Languages, six metamagic feats, Eschew Materials, Orc
 * Ferocity: owner question O1); the three #237 text feats (prose cases,
 * #779); and every creature type and held row. trait-reqs-b adds
 * `prerequisites`, list-bound too: a trait's record names the clauses of its
 * "Requirements" line, equal to its entry's `prerequisites` (each clause,
 * its kind and atoms, in the importer's order), beside at least one other
 * output, since a requirement is no body mechanic. Each clause is an atom
 * with its kind recorded, of a kind the scope certifies (race and deity),
 * each a word the word fixture releases, which the proof asserts alike: the
 * trait refused (its clause unmet, with a warning) while the requirement is
 * unmet, accepted once it is met; and each race a race clause names is a
 * race of the scoped build (`requirementsCertified`). An `unchecked` clause
 * never resolves, so no scope can certify one: the nine unstructured deity
 * names and the three regions stay out (routes C and D).
 */

/** The output kinds the public proof shows reaching the sheet. */
const sourceBodyOutputKinds = [
  'situationalModifier',
  'situationalNote',
  'countsAsRaces',
  'favoredClassCount',
  'replaces',
  'prerequisites',
] as const;
type OutputKind = (typeof sourceBodyOutputKinds)[number];

/**
 * The requirement clause kinds the app checks on a saved sheet: every atom
 * kind but `unchecked`, which never resolves (`anyOf` is no atom). A scope
 * certifies some of them, each one a word the public word fixture releases.
 */
export const checkedPrerequisiteKinds = [
  'ability',
  'bab',
  'skillRanks',
  'feat',
  'classFeature',
  'racialTrait',
  'classLevel',
  'characterLevel',
  'race',
  'alignment',
  'deity',
  'proficiency',
  'casterLevel',
  'canCast',
  'castsSpell',
] as const;

/** How a reviewed body is delivered. */
const sourceBodyClasses = [
  /** Situational Modifiers, with notes for numberless clauses. */
  'situational-modifiers',
  /** Racial facts: counting as another race, two favored classes. */
  'racial-facts',
] as const;

const situationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1) }),
]);
const modifierSchema = z.strictObject({
  target: z.string().min(1),
  bonusType: z.string().min(1),
  value: z.number().finite(),
  condition: z.strictObject({ situation: situationSchema }),
  stacksWithinEntry: z.literal(true).optional(),
});
const noteSchema = z.strictObject({
  text: z.string().min(1),
  target: z.string().min(1).optional(),
  situation: situationSchema.optional(),
});
/** A body's output fields, as `bodyOutputs` projects an entry. */
const bodyOutputFieldsSchema = z.strictObject({
  modifiers: z.array(modifierSchema).nonempty().optional(),
  situationalNotes: z.array(noteSchema).nonempty().optional(),
  countsAsRaces: z.array(catalogKeySchema).nonempty().optional(),
  detail: z
    .strictObject({
      favoredClassCount: z.literal(2).optional(),
      /**
       * The standard traits an alternate Racial Trait replaces, as its
       * entry's `detail.replaces` names them (stable keys, in its order).
       */
      replaces: z.array(catalogKeySchema).nonempty().optional(),
    })
    .optional(),
  /**
   * A trait's "Requirements" line, as its entry's `prerequisites` holds it
   * (trait-reqs-b): each clause, its kind and atoms, in the importer's
   * order.
   */
  prerequisites: z.array(prerequisiteSchema).nonempty().optional(),
});
type BodyOutputs = z.infer<typeof bodyOutputFieldsSchema>;
/**
 * A body's mechanical outputs: only the proven kinds, each non-empty, and at
 * least one held besides a requirement, which is no body mechanic. A field
 * set to `undefined` holds nothing, though it is a property, so the count is
 * of held kinds (`outputKinds`), never of names.
 */
const bodyOutputsSchema = bodyOutputFieldsSchema.refine(
  (outputs) => outputKinds(outputs).some((kind) => kind !== 'prerequisites'),
  { message: 'A reviewed body has at least one output besides a requirement.' },
);

const reviewedSourceBodySchema = z.strictObject({
  key: catalogKeySchema,
  name: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** The exact mechanical outputs the importer gives the row. */
  outputs: bodyOutputsSchema,
  /** The body, quoted, with each clause mapped to its delivery. */
  basis: z.string().min(1),
  body: z.enum(sourceBodyClasses),
});

/** A Modifier value's class: the scope proves each class on its own. */
const valueClasses = ['negative', 'zero', 'positive'] as const;
const valueClass = (value: number) =>
  value < 0 ? 'negative' : value === 0 ? 'zero' : 'positive';
/** A Situational Modifier's Situation: a shared key, or its entry's own. */
const modifierSituations = ['shared', 'local'] as const;
/** A note's Situation: none, a shared key, or its entry's own. */
const noteSituations = ['none', ...modifierSituations] as const;
const situationKind = (
  situation: z.infer<typeof situationSchema> | undefined,
) =>
  situation === undefined
    ? 'none'
    : typeof situation === 'string'
      ? 'shared'
      : 'local';

/**
 * The family's scope: the proven output kinds; the Situational Modifiers,
 * each target with the Situation kinds, bonus types and value classes proven
 * on it; the notes, each target (or none) with its Situation kinds; and the
 * reviewed list. Every combination a list item names is a word
 * (`certifiedSourceBodyWords`) the public word fixture releases
 * (`tests/source-body-proof-words.ts`; the catalog test's word tie).
 */
export const sourceBodyScopeSchema = z.strictObject({
  outputs: z.array(z.enum(sourceBodyOutputKinds)).nonempty(),
  modifiers: z
    .array(
      z.strictObject({
        target: z.enum(modifierTargets),
        situations: z.array(z.enum(modifierSituations)).nonempty(),
        bonusTypes: z.array(z.enum(personalBonusTypes)).nonempty(),
        values: z.array(z.enum(valueClasses)).nonempty(),
      }),
    )
    .nonempty(),
  notes: z
    .array(
      z.strictObject({
        /** Absent: an untargeted note, which reaches the entry. */
        target: z.enum(modifierTargets).optional(),
        situations: z.array(z.enum(noteSituations)).nonempty(),
      }),
    )
    .nonempty(),
  /**
   * The most standard traits one alternate's `replaces` may name: each
   * count up to it is one the public replacement fixture exercises
   * (`tests/source-body-proof-alternates.ts`; the catalog test's coverage
   * tie).
   */
  mostReplaced: z.number().int().positive(),
  /**
   * The requirement clause kinds a trait's record may hold (trait-reqs-b):
   * each a word the public word fixture releases (the word tie).
   */
  prerequisites: z.array(z.enum(checkedPrerequisiteKinds)).nonempty(),
  reviewed: z.array(reviewedSourceBodySchema),
});
type SourceBodyScope = z.infer<typeof sourceBodyScopeSchema>;

const elf = 'pf1/NgIhxRI0axrf3fcO';
const human = 'pf1/e6IaBxKgMxy1yKlr';
const orc = 'pf1/JOuAdPAOTat7d5v6';
/** A Situational Modifier: `<target> <bonus type> <value>` in a Situation. */
const situational = (
  [target, bonusType, value]: [string, string, number],
  situation: string | { local: string },
) => ({ target, bonusType, value, condition: { situation } });
/** The description note many traits carry: the body, repeated. */
const described = (race: string, text: string) => ({
  text: `Race: ${race}\n${text}`,
});
const descriptionNote =
  'Its description note repeats the body and changes no number.';
const sleepClause =
  '"immune to magic sleep effects" has no number: a #228 situational note (R4).';

/**
 * The reviewed list (body S1): 19 admitted feats and Racial Traits, and the 11
 * alternate Racial Traits racial-trait wave RT2 admits, each read
 * at its pin (pf1 `418761d2`, pf1-content `02f4ab0d`). The granting race need
 * not be admitted (R2). `drafted` until a cross-model review checks it.
 *
 * Two curation nits change no total: Hatred (Dwarf) is curated `racial` where
 * the body says "+1 bonus" (Hatred (Gnome) is `untyped`), and both types
 * stack (`docs/character-sheet/stacking.md`); Fearless carries
 * `stacksWithinEntry`, which its one Modifier makes inert.
 */
const reviewedSourceBodies = [
  {
    key: 'pf1-content/iBCPIWFExt679Zhh',
    name: 'Defensive Training (Dwarf)',
    sourceSha256:
      'f20beb0a5e0b54e2e7edebc58fc453f57903ea192522d38dd3d68f74b25f9e27',
    outputs: {
      modifiers: [situational(['ac', 'dodge', 4], 'giants')],
      situationalNotes: [
        described(
          'Dwarf',
          'Dwarves get a +4 dodge bonus to their AC against monsters of the giant subtype.',
        ),
      ],
    },
    basis: `"Dwarves get a +4 dodge bonus to their AC against monsters of the giant subtype": ac +4 dodge in giants. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/IQ5vHUbNbGqVaVV5',
    name: 'Defensive Training (Gnome)',
    sourceSha256:
      'a64336fe7d6b7baf17d2019568dc69e56cc6c27b31876bcbdae4e7ae6263917e',
    outputs: {
      modifiers: [situational(['ac', 'dodge', 4], 'giants')],
      situationalNotes: [
        described(
          'Gnome',
          'Gnomes get a +4 dodge bonus to their AC against monsters of the giant type.',
        ),
      ],
    },
    basis: `"Gnomes get a +4 dodge bonus to their AC against monsters of the giant type": ac +4 dodge in giants. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/yQvZ03xcsuM8b595',
    name: 'Elven Immunities (Elf)',
    sourceSha256:
      '5046182819828a5228fb6b40b391a38449acca568ab08b172bd278b5c1bec1bf',
    outputs: {
      modifiers: [situational(['saves', 'racial', 2], 'enchantment')],
      situationalNotes: [{ text: 'Immune to magic sleep effects.' }],
    },
    basis: `"Elves are immune to magic sleep effects and get a +2 racial bonus on saving throws against enchantment spells and effects": saves +2 racial in enchantment; ${sleepClause}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/oTQL4P3IdoJQAkOB',
    name: 'Elven Immunities (Half-Elf)',
    sourceSha256:
      '91159a4e79a7e970af46f267e7df82848fa7404393bfddaf20066c773bc1c8e2',
    outputs: {
      modifiers: [situational(['saves', 'racial', 2], 'enchantment')],
      situationalNotes: [{ text: 'Immune to magic sleep effects.' }],
    },
    basis: `"Half-elves are immune to magic sleep effects and get a +2 racial bonus on saving throws against enchantment spells and effects": saves +2 racial in enchantment; ${sleepClause}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/bRO90tmeaH1tFi2g',
    name: 'Elven Magic (Elf)',
    sourceSha256:
      '80b8ae66a9ca34a47156c56109d1a3c3464c195f197bba932d7fe4989aceeee4',
    outputs: {
      modifiers: [
        situational(['skill.spl', 'racial', 2], 'identifyMagicItems'),
        situational(['casterLevel', 'racial', 2], 'spellResistance'),
      ],
      situationalNotes: [
        described(
          'Elf',
          'Elves receive a +2 racial bonus on caster level checks made to overcome spell resistance. In addition, elves receive a +2 racial bonus on Spellcraft checks made to identify the properties of magic items.',
        ),
      ],
    },
    basis: `"Elves receive a +2 racial bonus on caster level checks made to overcome spell resistance": casterLevel +2 racial in spellResistance, the check only, never the caster level used elsewhere. "In addition, elves receive a +2 racial bonus on Spellcraft checks made to identify the properties of magic items": skill.spl +2 racial in identifyMagicItems. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/qoCLqjadKmJEN9R7',
    name: 'Fearless (Halfling)',
    sourceSha256:
      '3d3aba164bf4f34a7045cba559d69630de4440b0e05083fae67c10af4570866d',
    outputs: {
      modifiers: [
        {
          ...situational(['saves', 'racial', 2], 'fear'),
          stacksWithinEntry: true,
        },
      ],
    },
    basis:
      '"Halflings receive a +2 racial bonus on all saving throws against fear": saves +2 racial in fear. "This bonus stacks with the bonus granted by halfling luck": separate Racial Traits, and racial bonuses stack (docs/character-sheet/stacking.md). Curation nit: `stacksWithinEntry` is inert on its one Modifier.',
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/2F4IRW8AAicQ3VYc',
    name: 'Greed (Dwarf)',
    sourceSha256:
      'fa0f7f31646969bf7dc5133f82ba9411c39515d3b47d65b4b6af69de4eccaa6b',
    outputs: {
      modifiers: [
        situational(['skill.apr', 'racial', 2], {
          local:
            'to determine the price of nonmagical goods containing precious metals or gemstones',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Dwarves receive a +2 racial bonus on Appraise checks made to determine the price of nonmagical goods that contain precious metals or gemstones.',
        ),
      ],
    },
    basis: `"Dwarves receive a +2 racial bonus on Appraise checks made to determine the price of nonmagical goods that contain precious metals or gemstones": skill.apr +2 racial in that local Situation. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/AO5nhhUfI1b4M37H',
    name: 'Hardy',
    sourceSha256:
      '425ffd841cd8e89fb464692687d956d8a199b05ab39e140c04b68b91998e73b5',
    outputs: {
      modifiers: ['poison', 'spells', 'spellLike'].map((situation) =>
        situational(['saves', 'racial', 2], situation),
      ),
      situationalNotes: [
        described(
          'Dwarf',
          'Dwarves receive a +2 racial bonus on saving throws against poison, spells, and spell-like abilities.',
        ),
      ],
    },
    basis: `"Dwarves receive a +2 racial bonus on saving throws against poison, spells, and spell-like abilities": saves +2 racial in poison, spells and spellLike, one bonus, since one entry's Situations never stack. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/JtJKg8vV58UJ6m1m',
    name: 'Hatred (Dwarf)',
    sourceSha256:
      '74c831b32afd8f4cf540e937de9f6cc41f40f41a80a96cd068ee32161b654eb7',
    outputs: {
      modifiers: [
        situational(['attack', 'racial', 1], {
          local: 'vs. humanoids of the orc subtype',
        }),
        situational(['attack', 'racial', 1], {
          local: 'vs. humanoids of the goblinoid subtype',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Dwarves receive a +1 bonus on attack rolls against humanoid creatures of the orc and goblinoid subtypes because of their special training against these hated foes.',
        ),
      ],
    },
    basis: `"Dwarves receive a +1 bonus on attack rolls against humanoid creatures of the orc and goblinoid subtypes": attack +1 in two local Situations, on every routine line. Curation nit: curated racial where the body's bonus is untyped; both stack, so no total differs. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/FD2SILZXcIMjauvr',
    name: 'Hatred (Gnome)',
    sourceSha256:
      '89a3961827bfe13ed1c24982bd2f1c2a2652aa82b0ffd26e7913ba9f25a25a93',
    outputs: {
      modifiers: [
        situational(['attack', 'untyped', 1], {
          local: 'vs. humanoids of the reptilian subtype',
        }),
        situational(['attack', 'untyped', 1], {
          local: 'vs. humanoids of the goblinoid subtype',
        }),
      ],
      situationalNotes: [
        described(
          'Gnome',
          'Gnomes receive a +1 bonus on attack rolls against humanoid creatures of the reptilian and goblinoid subtypes because of their special training against these hated foes.',
        ),
      ],
    },
    basis: `"Gnomes receive a +1 bonus on attack rolls against humanoid creatures of the reptilian and goblinoid subtypes": attack +1 untyped in two local Situations, on every routine line. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/YHwpeek5IHtcZNDF',
    name: 'Illusion Resistance',
    sourceSha256:
      '16f5a10e47bd630b8e1e0ae1313ed62de1f8d9e97ae63e8a9dd17bbae2354144',
    outputs: {
      modifiers: [situational(['saves', 'racial', 2], 'illusions')],
      situationalNotes: [
        described(
          'Gnome',
          'Gnomes get a +2 racial bonus on saving throws against illusion spells or effects.',
        ),
      ],
    },
    basis: `"Gnomes get a +2 racial bonus on saving throws against illusion spells or effects": saves +2 racial in illusions. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/T4PaZ33R29gTAFaT',
    name: 'Stability (Dwarf)',
    sourceSha256:
      'f53983969ae3329139192380bd3d761a03facf024ad13bb6eeb4677640eb9da2',
    outputs: {
      modifiers: ['bullRushGround', 'tripGround'].map((situation) =>
        situational(['cmd', 'racial', 4], situation),
      ),
      situationalNotes: [
        described(
          'Dwarf',
          'Dwarves receive a +4 racial bonus to their Combat Maneuver Defense when resisting a bull rush or trip attempt while standing on the ground.',
        ),
      ],
    },
    basis: `"Dwarves receive a +4 racial bonus to their Combat Maneuver Defense when resisting a bull rush or trip attempt while standing on the ground": cmd +4 racial in bullRushGround and tripGround. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/6JCG0ei0s0ossrtx',
    name: 'Stonecunning (Dwarf)',
    sourceSha256:
      '12daad670c5440fcbb3d5976d8a681a5790031d35e009b4825ed2907d44aff5c',
    outputs: {
      modifiers: [
        situational(['skill.per', 'untyped', 2], {
          local: 'to notice unusual stonework',
        }),
      ],
      situationalNotes: [
        {
          text: 'Receive a Perception check to notice unusual stonework whenever passing within 10 feet, even without actively looking.',
        },
        described(
          'Dwarf',
          'Dwarves receive a +2 bonus on Perception checks to potentially notice unusual stonework, such as traps and hidden doors located in stone walls or floors. They receive a check to notice any such features that they pass within 10 feet of, whether or not they are actively looking.',
        ),
      ],
    },
    basis: `"Dwarves receive a +2 bonus on Perception checks to potentially notice unusual stonework, such as traps and hidden doors located in stone walls or floors": skill.per +2 untyped in that local Situation. "They receive a check to notice any such features that they pass within 10 ft. of, whether or not they are actively looking" has no number: a #228 situational note (R4). ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1/u7rGDZUL296QIuA0',
    name: 'Combat Casting',
    sourceSha256:
      'c32e3f89fe879abcbb96e1f7865baa777d53b359cd0b1279071f8b7d1512d7dc',
    outputs: {
      modifiers: [
        situational(['concentration', 'untyped', 4], {
          local: 'casting defensively or while grappled',
        }),
      ],
    },
    basis:
      'Benefits: "You get a +4 bonus on concentration checks made to cast a spell or use a spell-like ability when casting on the defensive or while grappled": concentration +4 untyped in that local Situation.',
    body: 'situational-modifiers',
  },
  {
    key: 'pf1/nWFr8SNcjcMqsXSH',
    name: 'Spell Penetration',
    sourceSha256:
      '041745d6939bbe40badb85d3a7ac8338c4e4e2dc34a61eca0405380835a15614',
    outputs: {
      modifiers: [
        situational(['casterLevel', 'untyped', 2], 'spellResistance'),
      ],
    },
    basis:
      'Benefits: "You get a +2 bonus on caster level checks (1d20 + caster level) made to overcome a creature\'s spell resistance": casterLevel +2 untyped in spellResistance, the check only, never the caster level used elsewhere.',
    body: 'situational-modifiers',
  },
  {
    key: 'pf1/8rsFtye3PwM6CKli',
    name: 'Point-Blank Shot',
    sourceSha256:
      '56cd2dca2763a0884f8ad5e45c37bfd9af7bff27f3c0de4a95a867a89ce5d31a',
    outputs: {
      modifiers: [
        situational(['attack.ranged', 'untyped', 1], 'within30ft'),
        situational(['damage.ranged', 'untyped', 1], 'within30ft'),
      ],
    },
    basis:
      'Benefits: "You get a +1 bonus on attack and damage rolls with ranged weapons at ranges of up to 30 feet": attack.ranged and damage.ranged +1 untyped in within30ft, ordinary Modifiers, not a hand-written identity rule (docs/attack-calculation.md). Its appended Combat Trick spends stamina only under the Pathfinder Unchained stamina rules, an alternate system the app keeps as prose with no stamina pool (docs/character-sheet/unchained-classes.md:5; R5).',
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/rzYk40R1rWSfay4a',
    name: 'Elf Blood',
    sourceSha256:
      'b9b49f36fc62af8d349a8250b239cfe4faed7dafc5dfd9bdd464159f498dd02b',
    outputs: { countsAsRaces: [elf, human] },
    basis:
      '"Half-elves count as both elves and humans for any effect related to race": countsAsRaces Elf and Human, which race prerequisites and other races\' trait checks read.',
    body: 'racial-facts',
  },
  {
    key: 'pf1-content/JWzMBJeAQYDav9gw',
    name: 'Orc Blood',
    sourceSha256:
      'a6013d0525923ca4ded0068ce08ccf3bceaa8c8ac0f5c72df890a5ac99d941af',
    outputs: {
      countsAsRaces: [orc, human],
      situationalNotes: [
        described(
          'Half-Orc',
          'Half-orcs count as both humans and orcs for any effect related to race.',
        ),
      ],
    },
    basis: `"Half-orcs count as both humans and orcs for any effect related to race": countsAsRaces Orc and Human, which race prerequisites and other races' trait checks read. ${descriptionNote}`,
    body: 'racial-facts',
  },
  {
    key: 'pf1-content/srOpqbXesXBuvTqe',
    name: 'Multitalented',
    sourceSha256:
      '746c338b63aadd2563053106a14188e2798ba0a7abfb0c05266ff6d2fd96ae2b',
    outputs: { detail: { favoredClassCount: 2 } },
    basis:
      '"Half-elves choose two favored classes at 1st level": favoredClassCount 2. "and gain 1 additional hit point or skill point whenever they take a level in either one of those classes": each Class Level\'s own favored class bonus, hp or skill, counted on either favored class.',
    body: 'racial-facts',
  },
  // Racial-trait wave RT2 (#388-#401): 11 alternate Racial Traits it admits, each
  // replacing its race's standard traits (`replaces`, body-ext-3), read at the
  // same pins against their PCGen race-ability rows (cur388rt2).
  {
    key: 'pf1-content/QdzlzrqWtgfjE4Fs',
    name: 'Ancient Enmity',
    sourceSha256:
      '0cbd7b0f9699085b7aaabfaf4c266132a5b56cfcea829a1901e370d49c10e70a',
    outputs: {
      modifiers: [
        situational(['attack', 'untyped', 1], {
          local: 'against humanoid creatures of the elf subtype',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Replaced Trait(s): Hatred\nDwarves have long been in conflict with elves, especially the hated drow. Dwarves with this racial trait receive a +1 bonus on attack rolls against humanoid creatures of the elf subtype. This racial trait replaces the hatred racial trait.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/JtJKg8vV58UJ6m1m' /* Hatred (Dwarf) */],
      },
    },
    basis: `"receive a +1 bonus on attack rolls against humanoid creatures of the elf subtype": attack +1 untyped in that local Situation, on every routine line. Replacement: "This racial trait replaces the hatred racial trait": \`replaces\` Hatred (Dwarf) (body-ext-3), each a standard Racial Trait of the Dwarf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/HFKHorjMw2dERwBo',
    name: 'Craftsman',
    sourceSha256:
      '58ee603b3403b011981c54f57920a1e75fe890542aa93a89d956322bc985f2a6',
    outputs: {
      modifiers: [
        situational(['skill.crf', 'racial', 2], {
          local: 'to create objects from metal or stone',
        }),
        situational(['skill.pro', 'racial', 2], {
          local: 'to create objects from metal or stone',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Replaced Trait(s): Greed\nDwarves are known for their superior craftsmanship when it comes to metal and stone works. Dwarves with this racial trait receive a +2 racial bonus on all Craft or Profession checks that create objects from metal or stone. This racial trait replaces the greed racial trait.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/2F4IRW8AAicQ3VYc' /* Greed (Dwarf) */],
      },
    },
    basis: `"receive a +2 racial bonus on all Craft or Profession checks that create objects from metal or stone": skill.crf and skill.pro +2 racial in that local Situation, one bonus per check. Replacement: "This racial trait replaces the greed racial trait": \`replaces\` Greed (Dwarf) (body-ext-3), each a standard Racial Trait of the Dwarf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/7LSKyC0eM1uQgBvm',
    name: 'Deep Warrior',
    sourceSha256:
      '18d05542c7269bbba93ca750ce3590e7d2999da6cb58a97bd0525bf7a812656f',
    outputs: {
      modifiers: [
        situational(['ac', 'dodge', 2], {
          local: 'against monsters of the aberration type',
        }),
        situational(['cmb', 'racial', 2], {
          local:
            'on combat maneuver checks to grapple aberrations or to continue a grapple with one',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Replaced Trait(s): Defensive Training\nDwarves with this racial trait grew up facing the abominations that live deep beneath the surface. They receive a +2 dodge bonus to AC against monsters of the aberration type and a +2 racial bonus to their CMB on attempts made to grapple such creatures (or to continue a grapple). This racial trait replaces the defensive training racial trait.',
        ),
      ],
      detail: {
        replaces: [
          'pf1-content/iBCPIWFExt679Zhh' /* Defensive Training (Dwarf) */,
        ],
      },
    },
    basis: `"They receive a +2 dodge bonus to AC against monsters of the aberration type": ac +2 dodge in that local Situation (touch AC and CMD, never flat-footed AC). "a +2 racial bonus to their CMB on attempts made to grapple such creatures (or to continue a grapple)": cmb +2 racial in that local Situation (CMB, never CMD). Replacement: "This racial trait replaces the defensive training racial trait": \`replaces\` Defensive Training (Dwarf) (body-ext-3), each a standard Racial Trait of the Dwarf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/StOjhD9mqHZqSELy',
    name: 'Desert Runner',
    sourceSha256:
      '143d6aeee246c0ccb297f38a9d3e04b4f697a824dcb99710abd24eba9d619414',
    outputs: {
      modifiers: [
        situational(['save.fort', 'racial', 4], {
          local:
            'to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments',
        }),
      ],
      situationalNotes: [
        described(
          'Elf',
          'Replaced Trait(s): Elven Magic\nSome elves thrive in the deepest deserts, forever roaming across burned and parched lands. Elves with this racial trait receive a +4 racial bonus on Constitution checks and Fortitude saves to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments. This racial trait replaces the elven magic racial trait.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/bRO90tmeaH1tFi2g' /* Elven Magic (Elf) */],
      },
    },
    basis: `"receive a +4 racial bonus on Constitution checks and Fortitude saves to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments": save.fort +4 racial in that local Situation. The same bonus on Constitution checks names an ability check, which the sheet has no statistic for: the description note carries it, shown with the entry (docs/character-sheet/modifiers.md:95). Replacement: "This racial trait replaces the elven magic racial trait": \`replaces\` Elven Magic (Elf) (body-ext-3), each a standard Racial Trait of the Elf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/O4c045wJE5lLweg3',
    name: 'Eternal Grudge',
    sourceSha256:
      'a6b764ad35798d0365d4059f4a099f7f74d526368c847dd0991152976d80579e',
    outputs: {
      modifiers: [
        situational(['attack', 'untyped', 1], {
          local: 'against humanoids of the dwarf and orc subtypes',
        }),
      ],
      situationalNotes: [
        described(
          'Elf',
          'Replaced Trait(s): Elven Magic\nElves with this racial trait grew up in secluded, isolationist communities where generations-old slights and quarrels linger as eternal blood feuds. They receive a +1 bonus on attack rolls against humanoids of the dwarf and orc subtypes due to special training against these hated foes. This racial trait replaces the elven magic racial trait.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/bRO90tmeaH1tFi2g' /* Elven Magic (Elf) */],
      },
    },
    basis: `"They receive a +1 bonus on attack rolls against humanoids of the dwarf and orc subtypes": attack +1 untyped in that local Situation, on every routine line. Replacement: "This racial trait replaces the elven magic racial trait": \`replaces\` Elven Magic (Elf) (body-ext-3), each a standard Racial Trait of the Elf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/NApPIjNkVNBxzQS3',
    name: 'Gatecrasher',
    sourceSha256:
      '13a6552645b9691a203057ca6219d63279bad8fe52e5f5355053fbfcafb9bb12',
    outputs: {
      modifiers: [situational(['cmb', 'untyped', 2], 'sunder')],
      situationalNotes: [
        { text: 'You gain a +2 bonus on Strength checks to break objects.' },
        described(
          'Half-Orc',
          'Replaced Trait(s): Orc Ferocity\nMany half-orcs revel in acts of wanton destruction. Half-orcs with this racial trait gain a +2 bonus on Strength checks to break objects and a +2 bonus on sunder attempts. This racial trait replaces the orc ferocity racial trait.',
        ),
      ],
      detail: { replaces: ['pf1-content/OyIvyI3x7V5HIzZL' /* Orc Ferocity */] },
    },
    basis: `"gain a +2 bonus on Strength checks to break objects": an ability check, which the sheet has no statistic for: its untargeted note, shown with the entry (docs/character-sheet/modifiers.md:95). "a +2 bonus on sunder attempts": cmb +2 untyped in sunder (CMB, never CMD). Replacement: "This racial trait replaces the orc ferocity racial trait": \`replaces\` Orc Ferocity (body-ext-3), each a standard Racial Trait of the Half-Orc. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/o8YypRycSCackHdm',
    name: 'Plagueborn',
    sourceSha256:
      '2c2d92a08db8c50d998ec874f2df52627f2c53b75fdf526599b3d43636131620',
    outputs: {
      modifiers: [
        situational(['saves', 'racial', 2], { local: 'against disease' }),
        situational(['saves', 'racial', 2], {
          local: 'against ingested poisons',
        }),
        situational(['saves', 'racial', 2], {
          local: 'against becoming nauseated or sickened',
        }),
      ],
      situationalNotes: [
        described(
          'Half-Orc',
          'Replaced Trait(s): Intimidating, Orc Ferocity\nHalf-orcs are sometimes forced to live on the rancid and unsanitary margins of society, becoming inured to all manner of sickness. Half-orcs with this racial trait gain a +2 racial bonus on saving throws against disease, ingested poisons, and becoming nauseated or sickened. This racial trait replaces the intimidating and orc ferocity racial traits.',
        ),
      ],
      detail: {
        replaces: [
          'pf1-content/OyIvyI3x7V5HIzZL' /* Orc Ferocity */,
          'pf1-content/UawXK40Ix4vmfMkY' /* Intimidating */,
        ],
      },
    },
    basis: `"gain a +2 racial bonus on saving throws against disease, ingested poisons, and becoming nauseated or sickened": saves +2 racial in three local Situations, one bonus, since one entry's Situations never stack. Replacement: "This racial trait replaces the intimidating and orc ferocity racial traits": \`replaces\` Orc Ferocity and Intimidating (body-ext-3), each a standard Racial Trait of the Half-Orc. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/HzKBmWjSHjYSNsU9',
    name: 'Relentless',
    sourceSha256:
      'd5b3a09040cfd27f193c22ad46e6e5cc4fe46d62a1b924270caa367b73461496',
    outputs: {
      modifiers: [
        situational(['cmb', 'untyped', 2], {
          local:
            'to bull rush an opponent while both you and it are standing on the ground',
        }),
        situational(['cmb', 'untyped', 2], {
          local:
            'to overrun an opponent while both you and it are standing on the ground',
        }),
      ],
      situationalNotes: [
        described(
          'Dwarf',
          'Replaced Trait(s): Stability\nDwarves are skilled at pushing their way through a battlefield, tossing aside lesser foes with ease. Dwarves with this racial trait receive a +2 bonus on combat maneuver checks made to bull rush or overrun an opponent. This bonus only applies while both the dwarf and his opponent are standing on the ground. This racial trait replaces stability.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/T4PaZ33R29gTAFaT' /* Stability (Dwarf) */],
      },
    },
    basis: `"receive a +2 bonus on combat maneuver checks made to bull rush or overrun an opponent. This bonus only applies while both the dwarf and his opponent are standing on the ground": cmb +2 untyped in two local Situations (bull rush, overrun, each on the ground), one bonus. Replacement: "This racial trait replaces stability": \`replaces\` Stability (Dwarf) (body-ext-3), each a standard Racial Trait of the Dwarf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/eew9hWENxwAiLP8S',
    name: 'Stubborn',
    sourceSha256:
      '136ec08f504ad38ce33038079332b44d01ab3a4d54700ac428a92b6a78c16143',
    outputs: {
      modifiers: [
        situational(['save.will', 'racial', 2], {
          local:
            'vs. spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools',
        }),
      ],
      situationalNotes: [
        {
          target: 'save.will',
          text: "If you fail such a save, you receive another save 1 round later to prematurely end the effect (assuming it has a duration greater than 1 round), at the same DC. With a similar ability from another source (such as a rogue's slippery mind), you can use only one of them per round.",
        },
        described(
          'Dwarf',
          "Replaced Trait(s): Hardy\nDwarves are renowned for being stubborn. Dwarves with this racial trait receive a +2 racial bonus on Will saves to resist spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools. In addition, if they fail such a save, they receive another save 1 round later to prematurely end the effect (assuming it has a duration greater than 1 round). This second save is made at the same DC as the first. If the dwarf has a similar ability from another source (such as a rogue's slippery mind), he can only use one of these abilities per round, but can try one on the second round if the first reroll ability fails). This racial trait replaces the hardy racial trait.",
        ),
      ],
      detail: { replaces: ['pf1-content/AO5nhhUfI1b4M37H' /* Hardy */] },
    },
    basis: `"receive a +2 racial bonus on Will saves to resist spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools": save.will +2 racial in that local Situation. "if they fail such a save, they receive another save 1 round later to prematurely end the effect": has no number: its save.will note, a #228 situational note (R4), which also carries the second save's DC and the one-reroll-per-round rule. Replacement: "This racial trait replaces the hardy racial trait": \`replaces\` Hardy (body-ext-3), each a standard Racial Trait of the Dwarf. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/iSHRZjOWa5TnYKXe',
    name: 'Underfoot',
    sourceSha256:
      'f67af8d9421e8a3bb947316e1fa229f3a3f559d4b56852c4ef1831a96df4b8a0',
    outputs: {
      modifiers: [
        situational(['ac', 'dodge', 1], {
          local: 'against foes larger than you',
        }),
        situational(['save.ref', 'untyped', 1], {
          local: 'to avoid trample attacks',
        }),
      ],
      situationalNotes: [
        described(
          'Halfling',
          'Replaced Trait(s): Halfling Luck\nHalflings must train hard to effectively fight bigger opponents. Halflings with this racial trait gain a +1 dodge bonus to AC against foes larger than themselves and a +1 bonus on Reflex saving throws to avoid trample attacks. This racial trait replaces the halfling luck racial trait.',
        ),
      ],
      detail: {
        replaces: ['pf1-content/HVI7FNwj2ng10qtj' /* Halfling Luck */],
      },
    },
    basis: `"gain a +1 dodge bonus to AC against foes larger than themselves": ac +1 dodge in that local Situation (touch AC and CMD, never flat-footed AC). "a +1 bonus on Reflex saving throws to avoid trample attacks": save.ref +1 untyped in that local Situation. Replacement: "This racial trait replaces the halfling luck racial trait": \`replaces\` Halfling Luck (body-ext-3), each a standard Racial Trait of the Halfling. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
  {
    key: 'pf1-content/f9g94BzVWjntaNQg',
    name: 'Warden of Nature',
    sourceSha256:
      '0b1671d26483240058256431ab7005c56433de8ba037c65a57d84376543dd303',
    outputs: {
      modifiers: [
        situational(['ac', 'dodge', 2], {
          local: 'against aberrations, oozes, and vermin',
        }),
        situational(['attack', 'untyped', 1], {
          local: 'against aberrations, oozes, and vermin',
        }),
      ],
      situationalNotes: [
        described(
          'Gnome',
          'Replaced Trait(s): Defensive Training, Hatred\nGnomes must often protect their homes against unnatural or pestilential infestations. Gnomes with this racial trait get a +2 dodge bonus to AC against aberrations, oozes, and vermin, and a +1 bonus on attack rolls against them because of their special training. This racial trait replaces the defensive training and hatred racial traits.',
        ),
      ],
      detail: {
        replaces: [
          'pf1-content/FD2SILZXcIMjauvr' /* Hatred (Gnome) */,
          'pf1-content/IQ5vHUbNbGqVaVV5' /* Defensive Training (Gnome) */,
        ],
      },
    },
    basis: `"get a +2 dodge bonus to AC against aberrations, oozes, and vermin": ac +2 dodge in that local Situation. "a +1 bonus on attack rolls against them": attack +1 untyped in the same Situation, on every routine line. Replacement: "This racial trait replaces the defensive training and hatred racial traits": \`replaces\` Hatred (Gnome) and Defensive Training (Gnome) (body-ext-3), each a standard Racial Trait of the Gnome. ${descriptionNote}`,
    body: 'situational-modifiers',
  },
];

/** The value class every certified Modifier word has. */
const positive: ['positive'] = ['positive'];

/** The family's raw registry entry (`launchMechanismProofs`). */
export const sourceBodyProofEntry = {
  family: 'source-body',
  mechanism: sourceBodyMechanism,
  kinds: ['feat', 'racialTrait', 'trait'],
  tests: [
    {
      path: 'convex/characterSheetSourceBody.integration.test.ts',
      sha256:
        '95b5d24e4c6c23ccb1539710bfa804e92d120fb510f51e8ec28994cd31eb0e29',
    },
    // The public replacement fixture, bound by bytes as the proof is: the
    // coverage tie reads the `replaces` shapes it exercises.
    {
      path: 'tests/source-body-proof-alternates.ts',
      sha256:
        'f7bf3d0f06c443c059ab3f4c153222cb66ab7bcf926dad577c2f8b2ea1fb238a',
    },
    // The public word fixture, bound the same way: the word tie reads the
    // words it releases (sb-tie).
    {
      path: 'tests/source-body-proof-words.ts',
      sha256:
        '0c4c496105ef1bfef0a53a73ecf7d4af7ff28a48e05df16a87c339888bdb13c4',
    },
  ],
  calculationIdentity:
    'sha256:7b391eb1b9753eb4f82879ef5ede0794c0ad5866c186cba61604c898b66c82cf',
  disqualifying: ['*'],
  body: {
    outputs: [...sourceBodyOutputKinds],
    // sb-tie: the words a listed row, an RT2 or TR1 candidate, another body
    // row of the next-met sweep or a casting alternate (Arcane Focus) uses,
    // each released by the word fixture; positive values only, since no such
    // row carries a penalty.
    modifiers: [
      {
        target: 'saves',
        situations: ['shared', 'local'],
        bonusTypes: ['racial', 'trait'],
        values: positive,
      },
      {
        target: 'save.fort',
        situations: ['local'],
        bonusTypes: ['racial'],
        values: positive,
      },
      {
        target: 'save.ref',
        situations: ['local'],
        bonusTypes: ['untyped'],
        values: positive,
      },
      {
        target: 'save.will',
        situations: ['local'],
        bonusTypes: ['racial', 'trait'],
        values: positive,
      },
      {
        target: 'ac',
        situations: ['shared', 'local'],
        bonusTypes: ['dodge'],
        values: positive,
      },
      {
        target: 'cmb',
        situations: ['shared'],
        bonusTypes: ['untyped'],
        values: positive,
      },
      {
        target: 'cmb',
        situations: ['local'],
        bonusTypes: ['racial', 'untyped', 'competence'],
        values: positive,
      },
      {
        target: 'cmd',
        situations: ['shared'],
        bonusTypes: ['racial'],
        values: positive,
      },
      {
        target: 'cmd',
        situations: ['local'],
        bonusTypes: ['competence'],
        values: positive,
      },
      {
        target: 'attack',
        situations: ['local'],
        bonusTypes: ['racial', 'untyped', 'trait', 'circumstance'],
        values: positive,
      },
      {
        target: 'attack.ranged',
        situations: ['shared'],
        bonusTypes: ['untyped'],
        values: positive,
      },
      {
        target: 'damage',
        situations: ['local'],
        bonusTypes: ['trait'],
        values: positive,
      },
      {
        target: 'damage.melee',
        situations: ['local'],
        bonusTypes: ['trait'],
        values: positive,
      },
      {
        target: 'damage.ranged',
        situations: ['shared'],
        bonusTypes: ['untyped'],
        values: positive,
      },
      {
        target: 'casterLevel',
        situations: ['shared', 'local'],
        bonusTypes: ['racial', 'untyped'],
        values: positive,
      },
      {
        target: 'concentration',
        situations: ['local'],
        bonusTypes: ['racial', 'untyped', 'competence'],
        values: positive,
      },
      {
        target: 'spellDC',
        situations: ['local'],
        bonusTypes: ['untyped', 'trait'],
        values: positive,
      },
      {
        target: 'skill.apr',
        situations: ['local'],
        bonusTypes: ['racial'],
        values: positive,
      },
      {
        target: 'skill.blf',
        situations: ['local'],
        bonusTypes: ['trait'],
        values: positive,
      },
      ...(['skill.crf', 'skill.pro'] as const).map((target) => ({
        target,
        situations: ['local' as const],
        bonusTypes: ['racial' as const],
        values: positive,
      })),
      ...(
        [
          'skill.dev',
          'skill.dip',
          'skill.esc',
          'skill.kpl',
          'skill.sen',
          'skill.slt',
          'skill.sur',
        ] as const
      ).map((target) => ({
        target,
        situations: ['local' as const],
        bonusTypes: ['trait' as const],
        values: positive,
      })),
      {
        target: 'skill.per',
        situations: ['local'],
        bonusTypes: ['untyped', 'trait'],
        values: positive,
      },
      {
        target: 'skill.spl',
        situations: ['shared'],
        bonusTypes: ['racial', 'trait'],
        values: positive,
      },
    ],
    notes: [
      { situations: ['none'] },
      { target: 'saves', situations: ['shared'] },
      { target: 'ac', situations: ['none', 'local'] },
      { target: 'attack', situations: ['none', 'local'] },
      { target: 'attack.ranged', situations: ['none'] },
      { target: 'save.will', situations: ['none'] },
      { target: 'skill.dip', situations: ['none'] },
      { target: 'skill.sur', situations: ['none'] },
      { target: 'damage', situations: ['none'] },
      { target: 'damage.melee', situations: ['none'] },
    ],
    // body-ext-3 fix r1: Sky Sentinel's three, the most the fixture
    // exercises.
    mostReplaced: 3,
    // trait-reqs-b: the race and deity clauses of the checked trait
    // Requirements lines (Undead Slayer (Dhampir), Failed Apprentice
    // (Half-Elf), Divine Warrior (Iomedae)), each released by the word
    // fixture.
    prerequisites: ['race', 'deity'],
    reviewed: reviewedSourceBodies,
  },
};

/** The kinds the family proves, whatever its registry entry names. */
const provenRowKinds = ['feat', 'racialTrait', 'trait'];
/** Entry fields that hold no sheet mechanic. */
const textFields = new Set([
  'externalKey',
  'upstreamKey',
  'pack',
  'name',
  'description',
  'guidanceText',
  'prerequisiteText',
  'sources',
  'provenance',
  'attributionFrom',
  'sourceKey',
  'unsupported',
]);
/** Entry fields that hold mechanics. */
const outputFields = new Set([
  'modifiers',
  'situationalNotes',
  'countsAsRaces',
  'proficiencies',
  'grantsSlots',
  'prerequisites',
]);
/** Each proven kind's detail fields: those holding no mechanic, and the rest. */
const detailFields: Record<string, { text: string[]; outputs: string[] }> = {
  feat: {
    text: ['kind', 'featTypes', 'repeatable'],
    outputs: ['additionalTraits'],
  },
  trait: { text: ['kind', 'traitType'], outputs: [] },
  racialTrait: {
    text: ['kind', 'raceKeys', 'standard'],
    outputs: [
      'abilityChoiceCount',
      'size',
      'bonusSkillRanksPerLevel',
      'replaces',
      'unresolvedReplacements',
      'favoredClassCount',
    ],
  },
};

/** A value that holds nothing: absent, empty or zero. */
function empty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 0 ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

/** The fields of an object that hold a value, or none for a non-object. */
export function heldFields(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.entries(value).filter(([, held]) => !empty(held))
    : undefined;
}

/**
 * An entry's mechanical outputs: its Modifiers, notes, race equivalence,
 * proficiencies, slots and prerequisites, and its detail's mechanical
 * fields, each that holds a value. A field the projection doesn't know, on
 * the entry or its detail, gives none, so a new importer field drops a
 * listed row until it is reviewed.
 */
export function bodyOutputs(entry: unknown) {
  const fields = heldFields(entry);
  const detail = heldFields(entryDetail(entry));
  const known = detail && detailFieldsOf(detail);
  if (!fields || !detail || !known) return undefined;
  const outputs = knownOutputs(
    fields.filter(([field]) => field !== 'detail' && !textFields.has(field)),
    [...outputFields],
  );
  const detailOutputs = knownOutputs(
    detail.filter(([field]) => !known.text.includes(field)),
    known.outputs,
  );
  if (!outputs || !detailOutputs) return undefined;
  return {
    ...outputs,
    ...(Object.keys(detailOutputs).length ? { detail: detailOutputs } : {}),
  };
}

/** An entry's `detail`, read without trusting its shape. */
function entryDetail(entry: unknown): unknown {
  if (typeof entry !== 'object' || entry === null || !('detail' in entry))
    return undefined;
  const { detail }: { detail: unknown } = entry;
  return detail;
}

/** The detail fields known for a held detail's kind, or none. */
function detailFieldsOf(detail: readonly [string, unknown][]) {
  const kind = detail.find(([field]) => field === 'kind')?.[1];
  return typeof kind === 'string' ? detailFields[kind] : undefined;
}

/** The fields as an object when each is a known output, or none. */
export function knownOutputs(
  fields: readonly [string, unknown][],
  known: readonly string[],
) {
  return fields.every(([field]) => known.includes(field))
    ? Object.fromEntries(fields)
    : undefined;
}

/**
 * The proven kinds a reviewed record's outputs hold: each output field the
 * family reads, counted only when it holds a value, so an absent,
 * `undefined`, `null` or empty field is no kind.
 */
function outputKinds(outputs: BodyOutputs): OutputKind[] {
  const held: Record<OutputKind, unknown> = {
    situationalModifier: outputs.modifiers?.length,
    situationalNote: outputs.situationalNotes?.length,
    countsAsRaces: outputs.countsAsRaces?.length,
    favoredClassCount: outputs.detail?.favoredClassCount,
    replaces: outputs.detail?.replaces?.length,
    prerequisites: outputs.prerequisites?.length,
  };
  return sourceBodyOutputKinds.filter((kind) => !empty(held[kind]));
}

/** A requirement clause's kind: its atom's, or `anyOf` for an alternative. */
const clauseKind = (clause: Prerequisite) =>
  'anyOf' in clause ? 'anyOf' : normalizePrerequisiteAtom(clause).kind;

/**
 * A body's Modifiers, notes and requirement clauses as words: `modifier
 * <situation> <target> <bonus type> <value class>`, `note <target or
 * untargeted> <situation>` and `prerequisite <clause kind>`.
 */
export function sourceBodyOutputWords({
  modifiers = [],
  situationalNotes = [],
  prerequisites = [],
}: Pick<BodyOutputs, 'modifiers' | 'situationalNotes' | 'prerequisites'>) {
  return [
    ...modifiers.map(
      ({ target, bonusType, value, condition }) =>
        `modifier ${situationKind(condition.situation)} ${target} ${bonusType} ${valueClass(value)}`,
    ),
    ...situationalNotes.map(
      ({ target, situation }) =>
        `note ${target ?? 'untargeted'} ${situationKind(situation)}`,
    ),
    ...prerequisites.map((clause) => `prerequisite ${clauseKind(clause)}`),
  ];
}

/** The words a scope certifies: every combination each list item names. */
export function certifiedSourceBodyWords(
  scope: Pick<SourceBodyScope, 'modifiers' | 'notes' | 'prerequisites'>,
) {
  return [
    ...scope.modifiers.flatMap(({ target, situations, bonusTypes, values }) =>
      situations.flatMap((situation) =>
        bonusTypes.flatMap((bonusType) =>
          values.map(
            (value) => `modifier ${situation} ${target} ${bonusType} ${value}`,
          ),
        ),
      ),
    ),
    ...scope.notes.flatMap(({ target, situations }) =>
      situations.map(
        (situation) => `note ${target ?? 'untargeted'} ${situation}`,
      ),
    ),
    ...scope.prerequisites.map((kind) => `prerequisite ${kind}`),
  ];
}

/**
 * The outputs hold at least one kind, every one of the scope's kinds, and
 * every Modifier, note and requirement clause is a word the scope certifies.
 */
function inScope(scope: SourceBodyScope, outputs: BodyOutputs) {
  const certified = new Set(certifiedSourceBodyWords(scope));
  const kinds = outputKinds(outputs);
  return (
    kinds.length > 0 &&
    kinds.every((kind) => scope.outputs.includes(kind)) &&
    sourceBodyOutputWords(outputs).every((word) => certified.has(word))
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'mechanisms' | 'sources'>;
type SourceBodyInput = {
  row: ProvenRow;
  /** The row's scoped build entry. */
  entry: unknown;
  /** Another scoped build entry, by its key. */
  entryOf: (key: string) => unknown;
};

/**
 * Whether the family proves the row's `Source body mechanics`: the row is a
 * feat or Racial Trait whose one mechanism it is, on the reviewed list with
 * its bound source bytes; its scoped entry, of the row's kind, has exactly
 * the reviewed outputs; and they hold at least one kind, all of the scope's
 * kinds, targets and bonus types.
 */
function sourceBodyProven(
  scope: SourceBodyScope,
  { row, entry, entryOf }: SourceBodyInput,
) {
  const reviewed = reviewedRow(scope, row);
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  const outputs = bodyOutputs(entry);
  return (
    reviewed !== undefined &&
    parsed.success &&
    parsed.data.detail.kind === row.kind &&
    outputs !== undefined &&
    canonicalReleaseJson(outputs) === canonicalReleaseJson(reviewed.outputs) &&
    inScope(scope, reviewed.outputs) &&
    replacementsCertified(scope, parsed.data.detail, entryOf) &&
    requirementsCertified(reviewed.outputs, parsed.data.detail, entryOf)
  );
}

/**
 * A requirement is a shape the public proof exercises (trait-reqs-b): it is
 * a trait's, and each clause is an atom with its kind recorded, each race a
 * race clause names a race of the scoped build. Its kinds are the scope's
 * words (`inScope`). An entry with no requirement passes.
 */
function requirementsCertified(
  { prerequisites = [] }: BodyOutputs,
  detail: z.infer<typeof importedCatalogEntrySchema>['detail'],
  entryOf: (key: string) => unknown,
) {
  if (!prerequisites.length) return true;
  return (
    detail.kind === 'trait' &&
    prerequisites.every(
      (clause) =>
        !('anyOf' in clause) &&
        clause.kind === normalizePrerequisiteAtom(clause).kind &&
        (!('race' in clause) ||
          clause.race.every((key) => {
            const race = importedCatalogEntrySchema.safeParse(entryOf(key));
            return race.success && race.data.detail.kind === 'race';
          })),
    )
  );
}

/**
 * An alternate's `replaces` is a shape the public proof exercises (body-ext-3
 * fix r1): the alternate has one race, it names at most `mostReplaced`
 * traits, and each is a standard Racial Trait of that race in the scoped
 * build. A foreign race's trait, an alternate trait or one missing from the
 * build is refused. An entry that replaces nothing passes.
 */
function replacementsCertified(
  scope: SourceBodyScope,
  detail: z.infer<typeof importedCatalogEntrySchema>['detail'],
  entryOf: (key: string) => unknown,
) {
  if (detail.kind !== 'racialTrait' || !detail.replaces?.length) return true;
  const [race, ...others] = detail.raceKeys ?? [];
  return (
    race !== undefined &&
    !others.length &&
    detail.replaces.length <= scope.mostReplaced &&
    detail.replaces.every((key) => {
      const replaced = importedCatalogEntrySchema.safeParse(entryOf(key));
      return (
        replaced.success &&
        replaced.data.detail.kind === 'racialTrait' &&
        replaced.data.detail.standard === true &&
        (replaced.data.detail.raceKeys ?? []).includes(race)
      );
    })
  );
}

/**
 * The row's reviewed record: a feat or Racial Trait row whose one mechanism
 * is `Source body mechanics`, on the list, bound to the reviewed source
 * bytes.
 */
function reviewedRow(scope: SourceBodyScope, row: ProvenRow) {
  const reviewed = scope.reviewed.find(({ key }) => key === row.key);
  return reviewed &&
    provenRowKinds.includes(row.kind) &&
    row.mechanisms.length === 1 &&
    row.mechanisms[0]?.name === sourceBodyMechanism &&
    row.sources.some(({ rawSha256 }) => rawSha256 === reviewed.sourceSha256)
    ? reviewed
    : undefined;
}

/**
 * The projection's gate for one registry entry and row: this family's entry
 * proves only through `sourceBodyProven`; any other entry naming `Source
 * body mechanics`, with a scope or without, proves nothing; every other
 * entry passes.
 */
export function sourceBodyGate(
  proof: LaunchMechanismProof,
  input: SourceBodyInput,
) {
  if ('body' in proof) return sourceBodyProven(proof.body, input);
  return !('mechanism' in proof && proof.mechanism === sourceBodyMechanism);
}
