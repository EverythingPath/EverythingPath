import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables.ts';
import { spellCollectionHeading } from '../../src/lib/character-sheet-spell-collections.ts';
import { reviewedReplacementFormulas } from './reviewed-change-replacements.ts';

/**
 * How a Spellcasting holds the Spells of its class list, as the app's
 * collection calculation decides it (`spellCollectionHeading`,
 * `calculateSpellCollections`): recorded into a spellbook, spells known, a
 * familiar or a formula book, or browsed whole and read-only with nothing
 * recorded (`whole-list`, PRD #251 D10).
 */
export const spellCollectionPaths = [
  'book',
  'known',
  'familiar',
  'formula',
  'whole-list',
] as const;
export type SpellCollectionPath = (typeof spellCollectionPaths)[number];

const headingPaths = {
  Spellbook: 'book',
  'Spells known': 'known',
  Familiar: 'familiar',
  'Formula book': 'formula',
} as const satisfies Record<
  NonNullable<ReturnType<typeof spellCollectionHeading>>,
  SpellCollectionPath
>;

/**
 * The collection path of a class a spell's `levels` names: its reviewed
 * casting's (`findReviewedClassCasting`), as the app reads it (a `none`
 * record is a read-only whole list, any other its collection heading), or
 * null for a class without one.
 */
export function classListCollectionPath(
  classTag: string,
): SpellCollectionPath | null {
  const casting = findReviewedClassCasting(classTag);
  if (!casting) return null;
  if (casting.record === 'none') return 'whole-list';
  const heading = spellCollectionHeading(casting);
  return heading ? headingPaths[heading] : null;
}

/**
 * The mechanism proof registry (content-verification design, Q2): a
 * mechanism family the public saved-sheet tests prove. An entry counts a
 * row's outstanding mechanism as proven only when the row's gate result is
 * `admitted`, the row has no `unsupported` issue the entry names, the entry's
 * calculation identity is the current one and it names at least one test
 * file, every one of which exists with its recorded bytes
 * (`currentMechanismProofs`, the projection's only way to read an entry).
 *
 * A reviewed schedule increment's and a resource's mechanisms aren't
 * outstanding: the inventory records them as `reused`
 * (`launch-inventory-build.ts`, with `tests/catalog/pcgen-schedules.test.ts`
 * as the increments' evidence). The first family is the spell class list;
 * the second, plain Modifiers, proves mechanisms named per source change
 * (`modifierMechanismPrefix`).
 */
const proofFields = {
  /** A short family name, such as `spell-class-list`. */
  family: z.string().min(1),
  /** The row kinds the family covers. */
  kinds: z.array(z.string().min(1)).nonempty(),
  /**
   * The public saved-sheet tests that prove it, with their bytes' SHA-256:
   * at least one, since a proof without a test proves nothing.
   */
  tests: z
    .array(
      z.strictObject({
        path: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .nonempty(),
  calculationIdentity: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  /**
   * `unsupported` fields that disqualify a row: an issue whose field is one of
   * these, or starts with one followed by `.`; `*` names every field. An issue
   * D7's recorded archetype proficiency reason (`isArchetypeProficiencyProse`)
   * never disqualifies.
   */
  disqualifying: z.array(z.string().min(1)),
};

/**
 * The prefix of the inventory's per-change mechanism names,
 * `Modifier <source target> <source formula>` (`launch-inventory-build.ts`).
 */
export const modifierMechanismPrefix = 'Modifier ';

const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const pairSource = z.string().min(1);
const bonusTypes = z.array(z.string().min(1)).nonempty();
/**
 * A proven (source target, formula shape) pair, with what the importer emits
 * for it. A `constant` is a positive integer n: a Modifier of value n, or n
 * feat slots. An `ability-modifier` is `@abilities.<ability>.mod` for one of
 * the proven abilities: a Modifier of formula `@ability.<ability>.mod`.
 * `hit-dice` is `@attributes.hd.total`: one bonus skill rank per level. A
 * Modifier's bonus type must be one the proof covers for the pair.
 */
const modifierPairSchema = z.union([
  z.strictObject({
    source: pairSource,
    formula: z.literal('constant'),
    target: z.string().min(1),
    bonusTypes,
  }),
  z.strictObject({
    source: pairSource,
    formula: z.literal('ability-modifier'),
    abilities: z.array(z.enum(abilityKeys)).nonempty(),
    target: z.string().min(1),
    bonusTypes,
  }),
  z.strictObject({
    source: pairSource,
    formula: z.literal('constant'),
    grants: z.literal('feat-slot'),
  }),
  z.strictObject({
    source: pairSource,
    formula: z.literal('hit-dice'),
    grants: z.literal('skill-rank-per-level'),
  }),
]);
export type ModifierPair = z.infer<typeof modifierPairSchema>;

/**
 * The plain-Modifiers family: it proves a row's `Modifier …` mechanisms all
 * together or none (`provenModifierMechanisms`).
 */
const modifierProofSchema = z.strictObject({
  ...proofFields,
  mechanismPrefix: z.literal(modifierMechanismPrefix),
  modifiers: z.array(modifierPairSchema).nonempty(),
});
export type ModifierMechanismProof = z.infer<typeof modifierProofSchema>;

const provenLevels = z.array(z.number().int().min(1).max(9)).nonempty();
const namedProofSchema = z.strictObject({
  ...proofFields,
  /** The exact inventory mechanism name the family proves. */
  mechanism: z.string().min(1),
  /**
   * What the row's scoped build entry must record for the family to cover it:
   * its detail kind, the detail fields that must hold at least one value and
   * those that must hold none. A row outside the scope, or without a scoped
   * entry, keeps the mechanism outstanding. Without a scope, the family covers
   * every row of its kinds.
   */
  scope: z
    .strictObject({
      detailKind: z.string().min(1),
      nonEmpty: z.array(z.string().min(1)),
      empty: z.array(z.string().min(1)),
      /**
       * A spell family's proven (collection path, spell level) pairs: every
       * class and level the scoped spell entry's `levels` names must hold
       * the Spell by a path (`classListCollectionPath`) at a level the
       * family's tests prove for that path. A class without a reviewed
       * casting, another path or an unproven level on its path puts the row
       * outside the scope.
       */
      collections: z
        .array(
          z.strictObject({
            path: z.enum(spellCollectionPaths),
            levels: z.array(z.number().int().min(0).max(9)).nonempty(),
          }),
        )
        .nonempty()
        .optional(),
      /**
       * A granted-levels family's proven routes. Every (kind, name, level)
       * pair the scoped spell entry's `grantedLevels` names must be granted
       * at that level by the class feature a checked granted-spell record
       * names for the pair (`granted-spells.ts`): a required row the gate
       * admits whose scoped entry grants this Spell at that level by a
       * route here: a domain's slot with the domain slot, or a sorcerer
       * bloodline's schedule, each at its proven levels.
       * The pairs must equal the records' inverse: a record granting the
       * Spell for a pair the Spell doesn't name, or at another level, puts
       * it outside the scope. Its class levels must pass `collections`.
       */
      grantedLevels: z
        .array(
          z.discriminatedUnion('style', [
            z.strictObject({
              optionKind: z.literal('domain'),
              style: z.literal('slot'),
              extraSlot: z.literal('domain'),
              levels: provenLevels,
            }),
            z.strictObject({
              optionKind: z.literal('bloodline'),
              style: z.literal('schedule'),
              /** `sorcerer`: spell level N at class level 2N + 1, every row. */
              schedule: z.literal('sorcerer'),
              levels: provenLevels,
            }),
          ]),
        )
        .nonempty()
        .optional(),
    })
    .optional(),
});
export type NamedMechanismProof = z.infer<typeof namedProofSchema>;
export type GrantedLevelsRoute = NonNullable<
  NonNullable<NamedMechanismProof['scope']>['grantedLevels']
>[number];

/** A registry entry: a family proving one named mechanism, or plain Modifiers. */
export const launchMechanismProofSchema = z.union([
  namedProofSchema,
  modifierProofSchema,
]);
export type LaunchMechanismProof = z.infer<typeof launchMechanismProofSchema>;

/** A `Modifier <target> <formula>` mechanism's source target and formula. */
export function parseModifierMechanism(name: string) {
  if (!name.startsWith(modifierMechanismPrefix)) return undefined;
  const rest = name.slice(modifierMechanismPrefix.length);
  const space = rest.indexOf(' ');
  const target = rest.slice(0, space);
  const formula = rest.slice(space + 1);
  return space > 0 && formula ? { target, formula } : undefined;
}

/** What a proven pair imports a source change as. */
type PairOutput =
  | {
      kind: 'modifier';
      target: string;
      bonusTypes: readonly string[];
      value: number | string;
    }
  | { kind: 'feat-slot'; count: number }
  | { kind: 'skill-rank-per-level' };

/**
 * A change's effective formula: the one reviewed replacement for the row's
 * change of this target and formula (#726), or its own. Several distinct
 * replacements give none. A replacement the importer does not apply (one for
 * another bonus type) leaves the entry without the expected output, so the
 * row stays outstanding.
 */
function effectiveFormula(
  key: string,
  change: { target: string; formula: string },
) {
  const replacements = reviewedReplacementFormulas(key, change);
  return replacements.length > 1
    ? undefined
    : (replacements[0] ?? change.formula);
}

/** The output a pair gives a formula of its shape, or none. */
function shapedOutput(
  pair: ModifierPair,
  formula: string,
): PairOutput | undefined {
  if (pair.formula === 'hit-dice')
    return formula === '@attributes.hd.total'
      ? { kind: 'skill-rank-per-level' }
      : undefined;
  if (pair.formula === 'ability-modifier') {
    const ability = /^@abilities\.([a-z]+)\.mod$/.exec(formula)?.[1];
    return pair.abilities.some((proven) => proven === ability)
      ? {
          kind: 'modifier',
          target: pair.target,
          bonusTypes: pair.bonusTypes,
          value: `@ability.${ability}.mod`,
        }
      : undefined;
  }
  if (!/^[1-9][0-9]*$/.test(formula)) return undefined;
  return 'grants' in pair
    ? { kind: 'feat-slot', count: Number(formula) }
    : {
        kind: 'modifier',
        target: pair.target,
        bonusTypes: pair.bonusTypes,
        value: Number(formula),
      };
}

/** The output a source change imports as, when it is a proven pair. */
function pairOutput(
  proof: ModifierMechanismProof,
  key: string,
  name: string,
): PairOutput | undefined {
  const change = parseModifierMechanism(name);
  const formula = change && effectiveFormula(key, change);
  if (!change || formula === undefined) return undefined;
  for (const pair of proof.modifiers) {
    const output =
      pair.source === change.target ? shapedOutput(pair, formula) : undefined;
    if (output) return output;
  }
  return undefined;
}

/**
 * Whether the family proves a mechanism of this name on the row with this
 * key, judged by the name alone (for a plain Modifier, its pair).
 */
export function proofNamesMechanism(
  proof: LaunchMechanismProof,
  key: string,
  name: string,
) {
  if ('mechanism' in proof) return proof.mechanism === name;
  return pairOutput(proof, key, name) !== undefined;
}

/** Takes the first item matching, or reports none. */
function take<T>(items: T[], matches: (item: T) => boolean) {
  const index = items.findIndex(matches);
  if (index < 0) return false;
  items.splice(index, 1);
  return true;
}

/**
 * The outputs of a scoped entry of this kind that the family reads: its
 * Modifiers, feat slots and bonus skill ranks per level. Each pair's output
 * is taken from them once (`takeOutput`).
 */
function modifierOutputs(entry: unknown, kind: string) {
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  if (!parsed.success || parsed.data.detail.kind !== kind) return undefined;
  const { detail, modifiers, grantsSlots = [] } = parsed.data;
  return {
    modifiers: [...modifiers],
    slots: [...grantsSlots],
    ranks: detail.kind === 'racialTrait' ? detail.bonusSkillRanksPerLevel : 0,
  };
}
type ModifierOutputs = NonNullable<ReturnType<typeof modifierOutputs>>;

/**
 * Takes a pair's output from the entry's: an unconditional Modifier of its
 * target, value and a proven bonus type; a feat slot of its count without
 * feat types (one listing its only feats included); or a bonus skill rank.
 */
function takeOutput(outputs: ModifierOutputs, output: PairOutput) {
  if (output.kind === 'skill-rank-per-level') {
    outputs.ranks -= 1;
    return outputs.ranks >= 0;
  }
  if (output.kind === 'feat-slot')
    return take(
      outputs.slots,
      (slot) =>
        slot.kind === 'feat' && slot.count === output.count && !slot.featTypes,
    );
  return take(
    outputs.modifiers,
    ({ target, bonusType, value, condition, stacksWithinEntry }) =>
      target === output.target &&
      output.bonusTypes.includes(bonusType) &&
      (typeof value === 'number'
        ? value === output.value
        : value.formula === output.value) &&
      condition === undefined &&
      stacksWithinEntry === undefined,
  );
}

/**
 * The row's `Modifier …` mechanisms when the family proves every one: each is
 * a proven pair, and the row's scoped entry, of the row's own kind, carries
 * exactly the outputs they import as, each once: unconditional Modifiers of
 * the pair's target, value and a proven bonus type; feat slots of that count
 * without feat types (a slot listing its only feats included); and one bonus
 * skill rank per level for each hit-dice pair. Any other Modifier, feat slot
 * or bonus rank on the entry, or any change outside the pairs, proves none of
 * them. Descriptive notes are not Modifiers.
 */
export function provenModifierMechanisms(
  proof: ModifierMechanismProof,
  {
    key,
    kind,
    names,
    entry,
  }: {
    key: string;
    kind: string;
    names: readonly string[];
    entry: unknown;
  },
): string[] {
  const modifierNames = names.filter((name) =>
    name.startsWith(proof.mechanismPrefix),
  );
  const outputs = modifierOutputs(entry, kind);
  if (!modifierNames.length || !outputs) return [];
  const taken = modifierNames.every((name) => {
    const output = pairOutput(proof, key, name);
    return output !== undefined && takeOutput(outputs, output);
  });
  return taken &&
    !outputs.modifiers.length &&
    !outputs.slots.length &&
    outputs.ranks === 0
    ? [...new Set(modifierNames)]
    : [];
}

/** The registry, refused whole when any entry is malformed. */
export function parseLaunchMechanismProofs(
  value: unknown,
): readonly LaunchMechanismProof[] {
  return z.array(launchMechanismProofSchema).parse(value);
}

/**
 * The registry. Each entry's calculation identity and test hashes are
 * recorded literally, so a calculation or test change leaves it stale until
 * reviewed again.
 *
 * `spell-class-list` (root's first family, content-verification research
 * Q5 item 7): a Spell learned from a class list is browsed for each casting
 * class at that class's list level, level 0 included, with that level's DC,
 * through public saved-sheet reads and writes, and recorded in that class's
 * book, known, familiar or formula collection, or, for a whole-list caster,
 * browsed read-only with nothing recorded (PRD #251 D10). Those five paths
 * are every path a reviewed casting uses. The scope names each path's proven
 * levels: levels 1 to 9 on every path, which share one browsing and
 * recording path with a per-level DC, proven at a level of 1 or more on each;
 * and level 0 on the four paths the proof casts at level 0. Level 0 on the
 * formula path is unproven (extracts have no level 0), so a Spell an
 * Alchemist or Investigator lists at level 0 stays outstanding, as does one
 * on the list of a class without a reviewed casting.
 * Its scope is plain class-list membership: a Spell with granted (domain,
 * subdomain, bloodline or other non-class) levels keeps the mechanism's
 * granted-spell rules outstanding, and so does an issue on its class levels
 * or learned-at record. `gameContent` (source fields retained for curation)
 * and `curation.mechanics` (running-effect notes, which the mechanism's
 * contract keeps as distinct Spell Effect entries) say nothing about the
 * lists.
 *
 * `spell-granted-levels` (granted-levels design §3, slice S1): a released
 * class feature's Granted Spells, named by spell key and resolved to Spell
 * Catalog Entries at release, reach the saved sheet through public reads and
 * writes: a slot-style domain grants its Spell and the domain slot at each
 * castable level 1 to 9, tags a Spell off the class list "domain slot only"
 * and one on it not, and grants neither through an Inquisitor's Domain
 * (`optionGrantsSpells: false`, its text granting powers only); a sorcerer
 * bloodline grants spell level N at sorcerer 2N + 1, never at 2N, for each
 * level 1 to 9; a missing, duplicated or non-Spell key refuses the release
 * candidate. Its scope adds those two routes to the class-list scope (whose
 * test it also names): every granted pair must be a checked granted-spell
 * record's feature, required and admitted, granting the Spell at that level
 * by a proven route (`grantedLevels`). Subdomain and bloodrager routes are
 * unproven, so a Spell naming one stays outstanding. Until the map has
 * records (S1b) no Spell is in its scope.
 *
 * `plain-modifiers` (next-met-levers research, lever 3): a selected feat's
 * and a race's standard Racial Traits' imported outputs reach their totals
 * through a Catalog Release and public saved-sheet reads and writes: the
 * Perception, Intimidate, Acrobatics and Climb totals, each save,
 * initiative, the bonus feat budget (an open slot and a slot listing its only
 * feats) and the skill ranks per level, and an Intimidate formula on the
 * Strength modifier, a penalty included. The pairs are the targets and
 * shapes the proof covers, each with the bonus type it proves; a pair holds
 * whichever covered kind carries it. A row with a `changes` issue (a change
 * that contributes nothing), any curation issue or a reviewed Racial Trait
 * rule that no longer matches keeps its Modifiers outstanding. `gameContent`
 * (source fields retained for curation) says nothing about the changes.
 */
const castingLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const classListCollections = [
  { path: 'book', levels: [0, ...castingLevels] },
  { path: 'known', levels: [0, ...castingLevels] },
  { path: 'familiar', levels: [0, ...castingLevels] },
  { path: 'formula', levels: castingLevels },
  { path: 'whole-list', levels: [0, ...castingLevels] },
];
const constantPair = (
  source: string,
  target: string,
  bonusType: 'untyped' | 'racial',
) => ({ source, formula: 'constant', target, bonusTypes: [bonusType] });
export const launchMechanismProofs = parseLaunchMechanismProofs([
  {
    family: 'spell-class-list',
    mechanism: 'Class-list and granted-spell metadata',
    kinds: ['spell'],
    tests: [
      {
        path: 'convex/characterSheetSpellClassList.integration.test.ts',
        sha256:
          '1b952d1103088d9eb7106b8819c8288b99147e48a3623b517929670c9c35055a',
      },
    ],
    calculationIdentity:
      'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
    disqualifying: ['levels', 'grantedLevels', 'learnedAt'],
    scope: {
      detailKind: 'spell',
      nonEmpty: ['levels'],
      empty: ['grantedLevels'],
      collections: classListCollections,
    },
  },
  {
    family: 'spell-granted-levels',
    mechanism: 'Class-list and granted-spell metadata',
    kinds: ['spell'],
    tests: [
      {
        path: 'convex/characterSheetGrantedSpells.integration.test.ts',
        sha256:
          '71e1e679e10b153c7a1d99cbde63e0cb5f7a16d6588cf9fcb39e7913538cdcf1',
      },
      {
        path: 'convex/characterSheetSpellClassList.integration.test.ts',
        sha256:
          '1b952d1103088d9eb7106b8819c8288b99147e48a3623b517929670c9c35055a',
      },
    ],
    calculationIdentity:
      'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
    disqualifying: ['levels', 'grantedLevels', 'learnedAt'],
    scope: {
      detailKind: 'spell',
      nonEmpty: ['grantedLevels'],
      empty: [],
      collections: classListCollections,
      grantedLevels: [
        {
          optionKind: 'domain',
          style: 'slot',
          extraSlot: 'domain',
          levels: castingLevels,
        },
        {
          optionKind: 'bloodline',
          style: 'schedule',
          schedule: 'sorcerer',
          levels: castingLevels,
        },
      ],
    },
  },
  {
    family: 'plain-modifiers',
    mechanismPrefix: modifierMechanismPrefix,
    kinds: ['feat', 'racialTrait'],
    tests: [
      {
        path: 'convex/characterSheetModifiers.integration.test.ts',
        sha256:
          '4cb1fdb7c154fdb84b780ab341acb6aee2220a59d4c540acee012b4df8ff7d6a',
      },
    ],
    calculationIdentity:
      'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
    disqualifying: ['changes', 'curation', 'racialTraitRule'],
    modifiers: [
      constantPair('will', 'save.will', 'untyped'),
      constantPair('fort', 'save.fort', 'untyped'),
      constantPair('ref', 'save.ref', 'untyped'),
      constantPair('init', 'init', 'untyped'),
      constantPair('allSavingThrows', 'saves', 'racial'),
      constantPair('skill.per', 'skill.per', 'racial'),
      constantPair('skill.int', 'skill.int', 'racial'),
      constantPair('skill.acr', 'skill.acr', 'racial'),
      constantPair('skill.clm', 'skill.clm', 'racial'),
      {
        source: 'skill.int',
        formula: 'ability-modifier',
        abilities: ['str'],
        target: 'skill.int',
        bonusTypes: ['untyped'],
      },
      { source: 'bonusFeats', formula: 'constant', grants: 'feat-slot' },
      {
        source: 'bonusSkillRanks',
        formula: 'hit-dice',
        grants: 'skill-rank-per-level',
      },
    ],
  },
]);
