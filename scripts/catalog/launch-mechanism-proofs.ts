import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables.ts';
import { spellCollectionHeading } from '../../src/lib/character-sheet-spell-collections.ts';
import { unmappedChangeReason } from './formula.ts';
import { reviewedReplacementFormulas } from './reviewed-change-replacements.ts';
import {
  sourcePrerequisitesProofEntry,
  sourcePrerequisitesScopeSchema,
} from './launch-source-prerequisites.ts';
import {
  sourceBodyMechanism,
  sourcePrerequisitesMechanism,
} from './launch-prose-categories.ts';
import {
  sourceBodyProofEntry,
  sourceBodyScopeSchema,
} from './launch-source-body.ts';
import {
  gearMechanism,
  gearProofEntry,
  gearScopeSchema,
} from './launch-gear.ts';

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
 * `rank-threshold` is a skill's rank threshold at one of the proven
 * thresholds: #724's reviewed Modifier stands in for the raw change
 * (`rankThresholdOutput`). A Modifier's bonus type must be one the proof
 * covers for the pair.
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
  z.strictObject({
    source: pairSource,
    formula: z.literal('rank-threshold'),
    target: z.string().min(1),
    bonusTypes,
    /** `below`, or `from` with `ranks` or more ranks in the source skill. */
    thresholds: z
      .array(
        z.strictObject({
          below: z.number().int().positive(),
          from: z.number().int().positive(),
          ranks: z.number().int().positive(),
        }),
      )
      .nonempty(),
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
  /**
   * `curation` issues reviewed as saying nothing about the row's Modifiers,
   * each with its row key, field and exact reason, and why. A family that
   * does not disqualify `curation` proves a row only when each of its
   * curation issues is one of these.
   */
  reviewedDiagnostics: z
    .array(
      z.strictObject({
        key: z.string().min(1),
        field: z.string().min(1),
        reason: z.string().min(1),
        basis: z.string().min(1),
      }),
    )
    .optional(),
});
export type ModifierMechanismProof = z.infer<typeof modifierProofSchema>;

const provenLevels = z.array(z.number().int().min(1).max(9)).nonempty();
/**
 * A reviewed level-grant row: its key and name, the pinned source sentence
 * showing that gaining it makes no saved choice and grants nothing beyond its
 * level increments, and the numbers its body promises that the inventory
 * names no mechanism for (owner question O1), with whether one is a sheet
 * number.
 */
const reviewedLevelGrantSchema = z.strictObject({
  key: catalogKeySchema,
  name: z.string().min(1),
  basis: z.string().min(1),
  bodyNumbersNotNamedAsMechanism: z.string().min(1),
  unmodelledNumber: z.boolean(),
});
export type ReviewedLevelGrant = z.infer<typeof reviewedLevelGrantSchema>;
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
      /**
       * A class-feature level-grant family's reviewed rows (#775). Every
       * admitted parent's imported entry has the same empty detail, so no
       * data rule tells a plain level grant from a chosen option; only a row
       * on this list, by its manifest key, can be in the scope, and it must
       * also pass the projection's structural checks
       * (`featureGrantProven`). A classFeature row is in a named family's
       * scope only through this field.
       */
      featureGrants: z
        .strictObject({
          shape: z.literal('level-grant'),
          reviewed: z.array(reviewedLevelGrantSchema),
        })
        .optional(),
    })
    .optional(),
});
export type NamedMechanismProof = z.infer<typeof namedProofSchema>;
export type GrantedLevelsRoute = NonNullable<
  NonNullable<NamedMechanismProof['scope']>['grantedLevels']
>[number];

/**
 * The feat Source-prerequisites family: `Source prerequisites` on a reviewed
 * feat only (`launch-source-prerequisites.ts`).
 */
const sourcePrerequisitesProofSchema = z.strictObject({
  ...proofFields,
  mechanism: z.literal(sourcePrerequisitesMechanism),
  prerequisites: sourcePrerequisitesScopeSchema,
});

/**
 * The Source-body family: `Source body mechanics` on a reviewed feat or
 * Racial Trait only (`launch-source-body.ts`).
 */
const sourceBodyProofSchema = z.strictObject({
  ...proofFields,
  mechanism: z.literal(sourceBodyMechanism),
  body: sourceBodyScopeSchema,
});

/**
 * The gear family: `Gear and Item Abilities` on a reviewed armor or shield
 * item only (`launch-gear.ts`).
 */
const gearProofSchema = z.strictObject({
  ...proofFields,
  mechanism: z.literal(gearMechanism),
  gear: gearScopeSchema,
});

/**
 * A registry entry: a family proving one named mechanism, plain Modifiers,
 * the reviewed feats' Source prerequisites, the reviewed bodies' Source body
 * mechanics, or the reviewed armor and shields' Gear and Item Abilities.
 */
export const launchMechanismProofSchema = z.union([
  namedProofSchema,
  modifierProofSchema,
  sourcePrerequisitesProofSchema,
  sourceBodyProofSchema,
  gearProofSchema,
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

/**
 * What a proven pair imports a source change as. A reviewed output stands in
 * for a raw change the importer cannot map (`rawChange`): that change's
 * `changes` issue must be on the row.
 */
type PairOutput =
  | {
      kind: 'modifier';
      target: string;
      bonusTypes: readonly string[];
      value: number | string;
      rawChange?: { target: string; formula: string };
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

/** Category skills, whose Foundry ranks are per sub-skill (`skill.crf`). */
const categorySkills = new Set(['crf', 'prf', 'pro']);
const rankNumber = String.raw`\s*([1-9][0-9]*)\s*`;

/**
 * A raw rank-threshold formula's threshold, in one of Foundry's two shapes:
 * `ifelse(gte(@skills.<s>.rank,N),H,L)` and `L + if(gte(@skills.<s>.rank, N),
 * H − L)`, with `<s>` the pair's own skill (a category skill's first
 * sub-skill, `@skills.crf.subSkills.crf1.rank`, included: the app's one Craft
 * skill is its own key, #724). Any other shape, variable or spelling gives
 * none.
 */
function rankThreshold(skill: string, formula: string) {
  const own = categorySkills.has(skill)
    ? `${skill}(?:\\.subSkills\\.${skill}1)?`
    : skill;
  const variable = String.raw`\s*@skills\.${own}\.rank\s*`;
  const gte = String.raw`gte\(${variable},${rankNumber}\)`;
  const choice = new RegExp(
    String.raw`^ifelse\(\s*${gte}\s*,${rankNumber},${rankNumber}\)$`,
  ).exec(formula);
  if (choice)
    return {
      ranks: Number(choice[1]),
      from: Number(choice[2]),
      below: Number(choice[3]),
    };
  const added = new RegExp(
    String.raw`^${rankNumber}\+\s*if\(\s*${gte}\s*,${rankNumber}\)$`,
  ).exec(formula);
  return added
    ? {
        below: Number(added[1]),
        ranks: Number(added[2]),
        from: Number(added[1]) + Number(added[3]),
      }
    : undefined;
}

/**
 * A `rank-threshold` pair's output for a raw change at a proven threshold:
 * #724's reviewed Modifier, `L + (H − L) * min(1, floor(@skillRanks.<s> /
 * N))`, which is L below N recorded ranks and H from N (recorded ranks are
 * non-negative integers), standing in for the raw change.
 */
function rankThresholdOutput(
  pair: Extract<ModifierPair, { formula: 'rank-threshold' }>,
  change: { target: string; formula: string },
  formula: string,
): PairOutput | undefined {
  const skill = /^skill\.([a-z]+)$/.exec(pair.source)?.[1];
  const found = skill ? rankThreshold(skill, formula) : undefined;
  if (
    !skill ||
    !found ||
    found.from <= found.below ||
    !pair.thresholds.some(
      ({ below, from, ranks }) =>
        below === found.below && from === found.from && ranks === found.ranks,
    )
  )
    return undefined;
  return {
    kind: 'modifier',
    target: pair.target,
    bonusTypes: pair.bonusTypes,
    value: `${found.below} + ${found.from - found.below} * min(1, floor(@skillRanks.${skill} / ${found.ranks}))`,
    rawChange: change,
  };
}

/** The output a pair gives a change of its shape, or none. */
function shapedOutput(
  pair: ModifierPair,
  change: { target: string; formula: string },
  formula: string,
): PairOutput | undefined {
  if (pair.formula === 'rank-threshold')
    return rankThresholdOutput(pair, change, formula);
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
      pair.source === change.target
        ? shapedOutput(pair, change, formula)
        : undefined;
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

/** The issue field is `name` or one of its sub-fields (`name.<part>`). */
const isField = (field: string, name: string) =>
  field === name || field.startsWith(`${name}.`);

/** An `unsupported` issue as the projection reads it. */
type UnsupportedIssue = { field: string; reason?: string; value?: unknown };

/**
 * Takes the `changes` issue for a reviewed output's raw change: the
 * importer's own, with its generic reason, no `operator`, the raw target and
 * formula and a bonus type the pair covers. Returns that bonus type.
 */
function takeRawIssue(
  issues: UnsupportedIssue[],
  output: Extract<PairOutput, { kind: 'modifier' }>,
) {
  const { rawChange } = output;
  if (!rawChange) return undefined;
  let type: string | undefined;
  const taken = take(issues, ({ reason, value }) => {
    if (reason !== unmappedChangeReason || !value || typeof value !== 'object')
      return false;
    const fields: Record<string, unknown> = { ...value };
    const matches =
      Object.keys(fields).sort().join() === 'formula,target,type' &&
      fields.target === rawChange.target &&
      fields.formula === rawChange.formula &&
      typeof fields.type === 'string' &&
      output.bonusTypes.includes(fields.type);
    if (matches && typeof fields.type === 'string') type = fields.type;
    return matches;
  });
  return taken ? type : undefined;
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
 *
 * The row's issues (`issues`, those no disqualifier dropped): its `changes`
 * issues must be exactly the raw changes reviewed outputs stand in for, each
 * once (`takeRawIssue`), and the output must carry that raw change's bonus
 * type; so the raw change adds nothing and the reviewed output adds it once.
 * Each `curation` issue must be one of the family's reviewed diagnostics for
 * the row. For plain-Modifiers, whose disqualifiers drop every `changes` and
 * `curation` issue, both rules hold of every row it reads.
 */
export function provenModifierMechanisms(
  proof: ModifierMechanismProof,
  {
    key,
    kind,
    names,
    entry,
    issues = [],
  }: {
    key: string;
    kind: string;
    names: readonly string[];
    entry: unknown;
    issues?: readonly UnsupportedIssue[];
  },
): string[] {
  const modifierNames = names.filter((name) =>
    name.startsWith(proof.mechanismPrefix),
  );
  const outputs = modifierOutputs(entry, kind);
  if (!modifierNames.length || !outputs) return [];
  const changes = issues.filter(({ field }) => isField(field, 'changes'));
  const taken = modifierNames.every((name) => {
    const output = pairOutput(proof, key, name);
    if (output?.kind !== 'modifier' || !output.rawChange)
      return output !== undefined && takeOutput(outputs, output);
    const type = takeRawIssue(changes, output);
    return (
      type !== undefined &&
      takeOutput(outputs, { ...output, bonusTypes: [type] })
    );
  });
  const curationReviewed = issues
    .filter(({ field }) => isField(field, 'curation'))
    .every(({ field, reason }) =>
      (proof.reviewedDiagnostics ?? []).some(
        (listed) =>
          listed.key === key &&
          listed.field === field &&
          listed.reason === reason,
      ),
    );
  return taken &&
    !changes.length &&
    curationReviewed &&
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
 * initiative, a dodge bonus to AC (#780: AC, touch AC and CMD, never
 * flat-footed AC), the bonus feat budget (an open slot and a slot listing its
 * only feats) and the skill ranks per level, and an Intimidate formula on the
 * Strength modifier, a penalty included. The pairs are the targets and
 * shapes the proof covers, each with the bonus type it proves; a pair holds
 * whichever covered kind carries it. A row with a `changes` issue (a change
 * that contributes nothing), any curation issue or a reviewed Racial Trait
 * rule that no longer matches keeps its Modifiers outstanding. `gameContent`
 * (source fields retained for curation) says nothing about the changes.
 *
 * `class-feature-level-grants` (#775, feature-grants design slice 1): a
 * released class's `featuresByLevel` grants a feature and its reviewed
 * schedule increments, named by stable key and resolved at release, as Grants
 * of that class at exactly their class levels and never through another
 * class; a Grant's state (off, notes, choice) survives reload, another
 * member's read and dormancy when the level goes, and returns with the same
 * Grant Key; an Archetype replacing the feature whole replaces its
 * increments, and one replacing a part replaces only that level. That is the
 * whole contract of a plain level grant: no saved choice and nothing granted
 * beyond the increments. Its scope is a reviewed list (`reviewedLevelGrants`,
 * each row's source sentence beside it), because a chosen-option parent's
 * entry is identical; a listed row must also pass the projection's
 * structural checks (`featureGrantProven`): an empty-detail entry with no
 * Modifiers, slots, prerequisites or proficiencies (a descriptive note, such
 * as Armor Mastery's, is no Modifier), listed
 * by a required class's scoped entry (the class need not be admitted, root
 * decision R1), every required increment admitted, and no outgoing
 * `requirement` edge. A `changes` or curation issue refuses it. Curated
 * conditional Modifiers (R2), Slow Fall (R3), chosen options (O2),
 * conditional grants, class-level formulas and content-linked features stay
 * outside.
 *
 * `gear` (#782, gear design slice S1): an imported armor or shield item's
 * outputs reach the saved sheet through a Catalog Release and public reads
 * and writes: the armor block survives the candidate conversion; the bonus
 * reaches `ac.armor` or `ac.shield`, the lowest worn cap limits Dexterity to
 * AC, the penalties add on Strength and Dexterity skills and spell failure
 * is summed and shown; the imported categories read light, medium, heavy and
 * shield proficiency, an item worn without it costing its penalty on every
 * attack line; enhancement, masterwork and highest-only stacking apply; a
 * shield's local Situational attack penalties stay out of every total and
 * apply on their own line only; targeted and untargeted notes arrive; and an
 * unequipped item gives nothing. Its scope is a reviewed list
 * (`launch-gear.ts`), bound to each row's source bytes and exact outputs,
 * because no structural signal says an item's outputs cover its body; any
 * `unsupported` issue refuses a row.
 */
const castingLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The plain level-grant rows #775 reviewed, each with the pinned Foundry body
 * sentence that shows no saved choice and no grant beyond its increments
 * (every choice its body names is made at use), and the numbers its body
 * promises (feature-grants rows file, `bodyNumbersNotNamedAsMechanism`).
 */
export const reviewedLevelGrants: readonly ReviewedLevelGrant[] = [
  {
    key: 'pf1/TaBxJdJQp5SFDPyn',
    name: 'Flurry of Blows (UC)',
    basis:
      'packs/class-abilities/flurry-of-blows-uc.TaBxJdJQp5SFDPyn.yaml: "At 1st level, a monk can make a flurry of blows as a full-attack action" and "At 11th level, a monk can make an additional attack at his highest base attack bonus whenever he makes a flurry of blows": an attack routine chosen at use, whose one later change is the 11th-level increment; unlike Flurry of Blows (MNK) it grants no feats.',
    bodyNumbersNotNamedAsMechanism: 'extra attack at full BAB (attack routine)',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/h56K6HEBOItImPPL',
    name: 'Inspire Courage',
    basis:
      'packs/class-abilities/inspire-courage.h56K6HEBOItImPPL.yaml: "An affected ally receives a +1 morale bonus on saving throws against charm and fear effects and a +1 competence bonus on attack and weapon damage rolls. At 5th level, and every six bard levels thereafter, this bonus increases by +1": its only choice, "which component to use when starting his performance", is made at each use; the increments are 5th, 11th and 17th.',
    bodyNumbersNotNamedAsMechanism:
      '+1 to +4 morale on attack, damage and fear saves',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/RENIeTVjWB7Mq6Mw',
    name: 'Damage Reduction',
    basis:
      'packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml: "At 7th level, the character gains damage reduction" and "At 10th level, and every three class levels thereafter (13th, 16th, and 19th level), this damage reduction rises by 1 point": no choice, and nothing beyond the increments.',
    bodyNumbersNotNamedAsMechanism: 'DR 1/- rising by increments',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/msQWK7TW7mufzf8l',
    name: 'Lore Master',
    basis:
      'packs/class-abilities/lore-master.msQWK7TW7mufzf8l.yaml: "At 5th level, the bard becomes a master of lore and can take 10 on any Knowledge skill check that he has ranks in" and "He can use this ability one additional time per day for every six levels he possesses beyond 5th": whether to take 10 or 20 is chosen at each check; the increments are 11th and 17th.',
    bodyNumbersNotNamedAsMechanism: 'take 10/20 on Knowledge; uses per day',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/NwTe1Q2utlsmOAqK',
    name: 'Armor Mastery',
    basis:
      'packs/class-abilities/armor-mastery.NwTe1Q2utlsmOAqK.yaml: "At 19th level, a fighter gains damage reduction 5/— whenever he is wearing armor or using a shield": no choice, no increments, nothing else granted.',
    bodyNumbersNotNamedAsMechanism:
      'DR 5/- while armored (situational note only)',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/2TsDfK0SKC8IGVx4',
    name: 'Smite Evil',
    basis:
      'packs/class-abilities/smite-evil.2TsDfK0SKC8IGVx4.yaml: "As a swift action, the paladin chooses one target within sight to smite" (a choice at each use) and "At 4th level, and at every three levels thereafter, the paladin may smite evil one additional time per day": the increments are 4th to 19th.',
    bodyNumbersNotNamedAsMechanism:
      'Cha to attack, level to damage, deflection AC; uses per day',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/2M56kfIOws5yYtxq',
    name: 'Inspire Competence',
    basis:
      'packs/class-abilities/inspire-competence.2M56kfIOws5yYtxq.yaml: "The ally gets a +2 competence bonus on skill checks with a particular skill as long as she continues to hear the bard’s performance. This bonus increases by +1 for every four levels the bard has attained beyond 3rd": the skill is the task at each use; the increments are 7th to 19th.',
    bodyNumbersNotNamedAsMechanism: '+2 to +6 competence on a skill',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/2Og23i3rRXu5QQlg',
    name: 'Ki Pool',
    basis:
      'packs/class-abilities/ki-pool.2Og23i3rRXu5QQlg.yaml: "At 4th level, a monk gains a pool of ki points" and "By spending 1 point from his ki pool, a monk can do one of the following": a spend chosen at use; ki strike\'s 7th, 10th and 16th-level steps are the increments.',
    bodyNumbersNotNamedAsMechanism: 'ki points 1/2 level + Wis; ki strike',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/WNi2SBF6Z2zhBMCl',
    name: 'Challenge (CAV)',
    basis:
      'packs/class-abilities/challenge-cav.WNi2SBF6Z2zhBMCl.yaml: "As a swift action, the cavalier chooses one target within sight to challenge" (a choice at each use) and "plus one additional time per day for every three levels beyond 1st": the increments are 4th to 19th.',
    bodyNumbersNotNamedAsMechanism: '+level damage vs target; uses per day',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/yotHT522pQoKDhID',
    name: "Slayer's Advance",
    basis:
      'packs/class-abilities/slayer-s-advance.yotHT522pQoKDhID.yaml: "At 13th level, a slayer can once per day move up to twice his base speed as a move action" and "At 17th level, he can do this twice per day": no choice; the 17th-level use is the increment.',
    bodyNumbersNotNamedAsMechanism:
      'twice base speed as a move action, once or twice per day (no sheet number)',
    unmodelledNumber: false,
  },
  {
    key: 'pf1/7BfYNNkYjjBevun8',
    name: 'Ki Pool (UC)',
    basis:
      'packs/class-abilities/ki-pool-uc.7BfYNNkYjjBevun8.yaml: "At 3rd level, a monk gains a pool of ki points" and "By spending 1 point from his ki pool as a swift action, a monk can make one additional unarmed strike": a spend at use; the "additional powers that consume points from his ki pool" are the separate Ki powers (UC) feature\'s picks, and ki strike\'s 7th, 10th and 16th-level steps are the increments.',
    bodyNumbersNotNamedAsMechanism: 'ki points 1/2 level + Wis',
    unmodelledNumber: true,
  },
  {
    key: 'pf1/Wl3FUflcmvQP0PaQ',
    name: 'Sneak Attack (SLA)',
    basis:
      'packs/class-abilities/sneak-attack-sla.Wl3FUflcmvQP0PaQ.yaml: "This additional damage is 1d6 at 3rd level, and increases by 1d6 every 3 levels thereafter": dealing nonlethal damage instead is chosen at each attack; the increments are 6th to 18th.',
    bodyNumbersNotNamedAsMechanism: '+1d6 to +7d6 precision damage',
    unmodelledNumber: true,
  },
];

/**
 * Owner question O1, whether a row counts when its body promises a number the
 * inventory names no mechanism for. The owner answered yes on 2026-11-08, so
 * the family lists every reviewed row (`count`), and each number stays
 * calculated work, recorded in `bodyNumbersNotNamedAsMechanism`. The other
 * answers were `without-numbers` (only Slayer's Advance) and `none`.
 */
export type LevelGrantNumbers = 'count' | 'without-numbers' | 'none';
const levelGrantNumbers: LevelGrantNumbers = 'count';

/** The reviewed rows an answer to O1 counts. */
export function levelGrantRows(answer: LevelGrantNumbers) {
  if (answer === 'none') return [];
  return reviewedLevelGrants.filter(
    ({ unmodelledNumber }) => answer === 'count' || !unmodelledNumber,
  );
}
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
  bonusType: 'untyped' | 'racial' | 'dodge',
) => ({ source, formula: 'constant', target, bonusTypes: [bonusType] });
/**
 * `rank-modifiers` (rank-modifiers design Q3, slice 1; #777): a feat's
 * rank-threshold changes, Foundry's `ifelse(gte(@skills.<s>.rank,N),H,L)` and
 * `L + if(gte(@skills.<s>.rank, N), H − L)`, import as nothing (the formula
 * grammar has no `ifelse`, `if` or `gte`), each a `changes` issue with the
 * importer's generic reason. #724's reviewed Modifier, `L + (H − L) * min(1,
 * floor(@skillRanks.<s> / N))`, stands in for each. The public proof takes
 * every listed skill through 0, 9, 10 and 20 recorded ranks on a saved sheet
 * at both proven thresholds, +3/+6 and +2/+4 at 10 ranks: each skill reads its
 * own ranks (Craft its one skill), a two-skill feat changes each skill
 * independently, two copies of one feat don't stack, two different feats
 * stack as untyped, and switching a feat off removes its contribution.
 *
 * It proves a feat's Modifier mechanisms all together or none: each is a
 * listed skill's rank threshold on its own skill at a proven threshold; the
 * entry carries exactly the reviewed output for each, with the raw bonus
 * type, and nothing else; and its `changes` issues are exactly those raw
 * changes, each once, with the generic reason and no `operator`
 * (`provenModifierMechanisms`). A curation diagnostic refuses the row unless
 * it is one of `reviewedDiagnostics` (root decision R2(b)): the 4 Skill
 * Focus repeatability notes, which concern selecting the feat again, not its
 * Modifier. It leaves out the Core Rulebook skill-pair feats (no reviewed
 * output yet), rows mixing a rank change with another Modifier, other rank
 * shapes and targets, and racial traits.
 */
const rankPair = (skill: string) => ({
  source: `skill.${skill}`,
  formula: 'rank-threshold',
  target: `skill.${skill}`,
  bonusTypes: ['untyped'],
  thresholds: [
    { below: 3, from: 6, ranks: 10 },
    { below: 2, from: 4, ranks: 10 },
  ],
});
const repeatabilityBasis = (batch: number) =>
  `#${batch}'s diagnostic on the selection rule, "You can gain this feat multiple times. Its effects do not stack. Each time you take the feat, it applies to a new skill." (CRB p. 134): the Modifier is #724's reviewed output, and the 10 other listed Skill Focus rows share the same body with no diagnostic.`;
export const launchMechanismProofs = parseLaunchMechanismProofs([
  sourcePrerequisitesProofEntry,
  sourceBodyProofEntry,
  gearProofEntry,
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
    family: 'rank-modifiers',
    mechanismPrefix: modifierMechanismPrefix,
    kinds: ['feat'],
    tests: [
      {
        path: 'convex/characterSheetRankModifiers.integration.test.ts',
        sha256:
          'fd594f52577df5bb69e42a9c0f92d0d54a732010c379609589083f9730f3c11c',
      },
    ],
    calculationIdentity:
      'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
    disqualifying: ['racialTraitRule'],
    modifiers: [
      'acr',
      'blf',
      'clm',
      'crf',
      'dev',
      'dip',
      'dis',
      'esc',
      'fly',
      'han',
      'hea',
      'int',
      'kar',
      'kdu',
      'khi',
      'kna',
      'kpl',
      'kre',
      'per',
      'rid',
      'sen',
      'slt',
      'spl',
      'ste',
      'sur',
      'swm',
      'umd',
    ].map(rankPair),
    reviewedDiagnostics: [
      {
        key: 'pf1-content/LmV6WT0Dv5FZO4Qy',
        field: 'curation.mechanics',
        reason: 'Distinct-skill repeatability is not an overlay fact.',
        basis: repeatabilityBasis(345),
      },
      {
        key: 'pf1-content/Z7kvSCJd3aMgwXrn',
        field: 'curation.mechanics',
        reason: 'Chosen-skill repeatability remains unstructured.',
        basis: repeatabilityBasis(352),
      },
      {
        key: 'pf1-content/2JWwVMFeqHnFDFSv',
        field: 'curation.mechanics',
        reason: 'Source multiple-selection identity remains unreviewed.',
        basis: repeatabilityBasis(335),
      },
      {
        key: 'pf1-content/ZRkknePy6wjAgoVH',
        field: 'curation.mechanics',
        reason: 'Chosen-skill repeatability remains unstructured.',
        basis: repeatabilityBasis(352),
      },
    ],
  },
  {
    family: 'plain-modifiers',
    mechanismPrefix: modifierMechanismPrefix,
    kinds: ['feat', 'racialTrait'],
    tests: [
      {
        path: 'convex/characterSheetModifiers.integration.test.ts',
        sha256:
          '24d8b729c9aa57fc9a2e8848fea0397948bd6d24a90ca86069a38044ed3d12db',
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
      constantPair('ac', 'ac', 'dodge'),
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
  {
    family: 'class-feature-level-grants',
    mechanism: 'Feature/option grants and conditions',
    kinds: ['classFeature'],
    tests: [
      {
        path: 'convex/characterSheetFeatureGrants.integration.test.ts',
        sha256:
          '3ec5f7b731793e7f7535173f05275b5d2a6bb96b17711914ac718975ee85a8d0',
      },
    ],
    calculationIdentity:
      'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
    disqualifying: ['changes', 'curation'],
    scope: {
      detailKind: 'classFeature',
      nonEmpty: [],
      empty: [
        'parentFeature',
        'part',
        'duplicateUpgrade',
        'picksByLevel',
        'spellcasting',
      ],
      featureGrants: {
        shape: 'level-grant',
        reviewed: levelGrantRows(levelGrantNumbers),
      },
    },
  },
]);
