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
 * the sheet when made inactive.
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
 * #779); and every creature type and held row. A trait whose entry carries
 * `prerequisites` (its "Requirements" line: a deity, region or race) has no
 * proven kind for them, so it can't be listed.
 */

/** The output kinds the public proof shows reaching the sheet. */
const sourceBodyOutputKinds = [
  'situationalModifier',
  'situationalNote',
  'countsAsRaces',
  'favoredClassCount',
] as const;
type OutputKind = (typeof sourceBodyOutputKinds)[number];

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
  detail: z.strictObject({ favoredClassCount: z.literal(2) }).optional(),
});
type BodyOutputs = z.infer<typeof bodyOutputFieldsSchema>;
/**
 * A body's mechanical outputs: only the proven kinds, each non-empty, and at
 * least one held. A field set to `undefined` holds nothing, though it is a
 * property, so the count is of held kinds (`outputKinds`), never of names.
 */
const bodyOutputsSchema = bodyOutputFieldsSchema.refine(
  (outputs) => outputKinds(outputs).length > 0,
  { message: 'A reviewed body has at least one output.' },
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

/**
 * The family's scope: the proven output kinds, the Modifier and note targets
 * and the bonus types the public proof covers, and the reviewed list.
 */
export const sourceBodyScopeSchema = z.strictObject({
  outputs: z.array(z.enum(sourceBodyOutputKinds)).nonempty(),
  targets: z.array(z.enum(modifierTargets)).nonempty(),
  bonusTypes: z.array(z.enum(personalBonusTypes)).nonempty(),
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
 * The reviewed list (body S1): 19 admitted feats and Racial Traits, each read
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
];

/** The family's raw registry entry (`launchMechanismProofs`). */
export const sourceBodyProofEntry = {
  family: 'source-body',
  mechanism: sourceBodyMechanism,
  kinds: ['feat', 'racialTrait', 'trait'],
  tests: [
    {
      path: 'convex/characterSheetSourceBody.integration.test.ts',
      sha256:
        '13ad73df0d15bb3b20dfcd7c177291c26f6f5e4ac30fb3e639f2246758ae2d9a',
    },
  ],
  calculationIdentity:
    'sha256:b77242f8f7303edc4ea6095f473aa4a755301fa5f6da4f731a54b74d77405c11',
  disqualifying: ['*'],
  body: {
    outputs: [...sourceBodyOutputKinds],
    targets: [
      'saves',
      'ac',
      'cmd',
      'skill.apr',
      'skill.per',
      'skill.spl',
      'attack',
      'attack.ranged',
      'damage.ranged',
      'casterLevel',
      'concentration',
      // body-ext: CMB, the three saves, the skills its rows name and spell DC.
      'cmb',
      'save.fort',
      'save.ref',
      'save.will',
      'skill.blf',
      'skill.crf',
      'skill.dev',
      'skill.dip',
      'skill.esc',
      'skill.kpl',
      'skill.pro',
      'skill.sen',
      'skill.slt',
      'skill.sur',
      'spellDC',
    ],
    bonusTypes: ['racial', 'dodge', 'untyped', 'trait'],
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
  };
  return sourceBodyOutputKinds.filter((kind) => !empty(held[kind]));
}

/**
 * The outputs hold at least one kind, every one of the scope's kinds, and
 * every Modifier and note targets a scope target with a scope bonus type.
 */
function inScope(scope: SourceBodyScope, outputs: BodyOutputs) {
  const targets: readonly string[] = scope.targets;
  const bonusTypes: readonly string[] = scope.bonusTypes;
  const kinds = outputKinds(outputs);
  return (
    kinds.length > 0 &&
    kinds.every((kind) => scope.outputs.includes(kind)) &&
    (outputs.modifiers ?? []).every(
      ({ target, bonusType }) =>
        targets.includes(target) && bonusTypes.includes(bonusType),
    ) &&
    (outputs.situationalNotes ?? []).every(
      ({ target }) => target === undefined || targets.includes(target),
    )
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'mechanisms' | 'sources'>;
type SourceBodyInput = {
  row: ProvenRow;
  /** The row's scoped build entry. */
  entry: unknown;
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
  { row, entry }: SourceBodyInput,
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
    inScope(scope, reviewed.outputs)
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
