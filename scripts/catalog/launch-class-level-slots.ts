import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';
import {
  evaluateFormula,
  FormulaError,
  parseFormula,
} from '../../src/lib/character-sheet-formulas.ts';
import { unmappedChangeReason } from './formula.ts';
import type { LaunchRow } from './launch-inventory-schema.ts';
import { reviewedScheduleSlots } from './pcgen/schedule-slots.ts';

/**
 * The class-level slots family (#783, feature-grants slice 3a). A class
 * feature's Foundry change `bonusFeats <formula>` on `@class.level` imports
 * as nothing: the importer has no `bonusFeats` target (`map.ts`), so the
 * change is a `changes` issue with its generic reason. The number it gives is
 * already delivered by the reviewed schedule slots: the acquisition row and
 * each increment row of the parent carry one bonus feat slot of the printed
 * feat types (`pcgen/schedule-slots.ts`, `class-schedules.ts` `withSlot`),
 * and the sheet counts an active Grant's slots by its class level. The public
 * saved-sheet proof (`convex/characterSheetClassLevelSlots.integration.test.ts`)
 * shows those slots on released classes: the bonus budget equals the Foundry
 * formula at each class level it reads, only through the listing class; a feat
 * selected into a slot survives reload and another member's read, a feat of
 * another type warns and is kept, and a three-type slot takes each type; a
 * deleted level's slot goes dormant with its Selection's slot kept and comes
 * back; an Archetype replacing the parent whole removes every slot, a part
 * replacement only that level's; an outsider is refused. Its shapes
 * (`tests/class-level-slots-proof.ts`) are bound beside it, and a coverage
 * tie (`tests/catalog/launch-class-level-slots.test.ts`) checks that each
 * listed parent's formula, printed feat types and schedule row levels are a
 * shape the proof reads at every class level from 1st to 20th, the levels
 * the rule checks.
 *
 * The rule (`provenClassLevelSlots`): a listed parent's one `Modifier
 * bonusFeats <formula>` mechanism is proven only when the formula reads
 * nothing but `@class.level`; for every class whose scoped entry lists the
 * parent, and every class level from the parent's acquisition there to 20,
 * the formula equals the number of the parent's rows that class lists at or
 * below that level (the acquisition and its increments, each admitted); each
 * of those rows' entries carries exactly its reviewed schedule slot and no
 * Modifier; and the parent's only `changes` issue is that raw change, once,
 * untyped, with the generic reason and no other field. So the schedule, not
 * the formula, delivers the number, and nothing adds it twice. A `curation`
 * issue refuses the row (`disqualifying`). The list binds each row's source
 * bytes; a parent with no reviewed slot rule (Wizard, Monk, Sorcerer and
 * Bloodrager bonus feats, whose rows match their formulas) carries no slot
 * and stays outstanding.
 */
export const classLevelSlotsSource = 'bonusFeats';
const mechanismPrefix = `Modifier ${classLevelSlotsSource} `;
const classLevelVariable = '@class.level';
const maxClassLevel = 20;
const reviewedSlots = reviewedScheduleSlots();

const reviewedClassLevelSlotSchema = z.strictObject({
  key: catalogKeySchema,
  name: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /**
   * The pinned body sentence for the slot count and feat types, and the
   * schedule slot rule's printed line.
   */
  basis: z.string().min(1),
  /**
   * A retraining limit the body sets and the sheet does not enforce (it lets
   * a slot's Selection change at any time), quoted; owner question O1 on
   * #783 decides whether such a row counts.
   */
  retraining: z.string().min(1).optional(),
});
export type ReviewedClassLevelSlot = z.infer<
  typeof reviewedClassLevelSlotSchema
>;

/** The family's scope: the source target it proves and the reviewed list. */
export const classLevelSlotsScopeSchema = z.strictObject({
  source: z.literal(classLevelSlotsSource),
  reviewed: z.array(reviewedClassLevelSlotSchema),
});
type ClassLevelSlotsScope = z.infer<typeof classLevelSlotsScopeSchema>;

const slotRule = (printed: string, types: string) =>
  `the reviewed slot rule (scripts/catalog/pcgen/schedule-slots.ts, ${printed}) gives each row one ${types} feat slot`;

/**
 * The four parents the rule fits, each read at its pin (pf1 `418761d2`).
 * `drafted` until a cross-model review checks them.
 */
const reviewedClassLevelSlotRecords: readonly ReviewedClassLevelSlot[] = [
  {
    key: 'pf1/vfu0FW2XYF7cBUQp',
    name: 'Bonus Feat (CAV)',
    sourceSha256:
      '75f98a28cc45d99d76052a7e971eb9a965b249e747b60c111b3fd7645d227075',
    basis: `packs/class-abilities/bonus-feat-cav.vfu0FW2XYF7cBUQp.yaml: "At 6th level, and at every six levels thereafter, a cavalier gains a bonus feat in addition to those gained from normal advancement. These bonus feats must be selected from those listed as combat feats. The cavalier must meet the prerequisites of these bonus feats.": bonusFeats floor(@class.level / 6) is 1 at 6th, 2 at 12th and 3 at 18th, the Cavalier schedule's rows at 6, 12 and 18; ${slotRule('advancedPlayersGuide/baseClasses/cavalier.html:392', 'Combat')}.`,
  },
  {
    key: 'pf1/gzBR0qkMdu0KkLV0',
    name: 'Bonus Feats (MAG)',
    sourceSha256:
      'a867ed8184d9e57e3e44db5ce37a07319d996e086f9b3b3de50cc3aba2db47db',
    basis: `packs/class-abilities/bonus-feats-mag.gzBR0qkMdu0KkLV0.yaml: "At 5th level, and every six levels thereafter, a magus gains a bonus feat in addition to those gained from normal advancement. These bonus feats must be selected from those listed as combat, item creation, or metamagic feats. He must meet the prerequisites for these feats as normal.": bonusFeats floor((@class.level + 1) / 6) is 1 at 5th, 2 at 11th and 3 at 17th, the Magus schedule's rows at 5, 11 and 17; ${slotRule('ultimateMagic/spellcasters/magus.html:424', 'Combat, Item Creation or Metamagic')}.`,
  },
  {
    key: 'pf1/CV8BsY3ciUb9TA1Y',
    name: 'Bonus Feats (FGT)',
    sourceSha256:
      'ab7655c67684faa9e8d317b850c7bc9ec286f8233d2d276a397c19d67737e441',
    basis: `packs/class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml: "At 1st level, and at every even level thereafter, a fighter gains a bonus feat in addition to those gained from normal advancement (meaning that the fighter gains a feat at every level). These bonus feats must be selected from those listed as Combat Feats": bonusFeats 1 + floor(@class.level / 2) is 1 at 1st and 11 at 20th, the Fighter schedule's rows at 1 and every even level; ${slotRule('coreRulebook/classes/fighter.html:380', 'Combat')}.`,
    retraining:
      'Upon reaching 4th level, and every four levels thereafter (8th, 12th, and so on), a fighter can choose to learn a new bonus feat in place of a bonus feat he has already learned. … A fighter can only change one feat at any given level and must choose whether or not to swap the feat at the time he gains a new bonus feat for the level.',
  },
  {
    key: 'pf1/717fyDCcfLtD345B',
    name: 'Teamwork Feat',
    sourceSha256:
      'ade3dba1b6e2bd6bd6ee475947c04c8ff54a49dbebca431cb9beeaee0f2940da',
    basis: `packs/class-abilities/teamwork-feat.717fyDCcfLtD345B.yaml: "At 3rd level, and every three levels thereafter, the inquisitor gains a bonus feat in addition to those gained from normal advancement. These bonus feats must be selected from those listed as teamwork feats. The inquisitor must meet the prerequisites of the selected bonus feat.": bonusFeats floor(@class.level / 3) is 1 at 3rd and 6 at 18th, the Inquisitor schedule's rows at 3, 6 … 18; ${slotRule('advancedPlayersGuide/baseClasses/inquisitor.html:432', 'Teamwork')}.`,
    retraining:
      'As a standard action, the inquisitor can choose to learn a new bonus teamwork feat in place of the most recent bonus teamwork feat she has already learned. … An inquisitor can change her most recent teamwork feat a number of times per day equal to her Wisdom modifier.',
  },
];

/**
 * Owner question O1 on #783, whether a row whose retraining limit the sheet
 * doesn't enforce counts. Until it is answered (root decision R1, 2026-11-09)
 * the list leaves Fighter Bonus Feats and Teamwork Feat out (`unmet`); a yes
 * is the one-line change to `count`.
 */
export type RetrainingAnswer = 'count' | 'unmet';
const retrainingAnswer: RetrainingAnswer = 'unmet';

/** The reviewed rows an answer to O1 lists. */
export function classLevelSlotRows(answer: RetrainingAnswer) {
  return reviewedClassLevelSlotRecords.filter(
    ({ retraining }) => answer === 'count' || retraining === undefined,
  );
}
export const reviewedClassLevelSlots = classLevelSlotRows(retrainingAnswer);

/**
 * The level-grant record of a listed row (`class-feature-level-grants`): a
 * chosen option, the feat Selection in each row's slot, whose output is its
 * reviewed schedule slot (`scheduleSlot`) and whose `changes` issue this
 * family takes.
 */
export function classLevelSlotLevelGrant({
  key,
  name,
  basis,
}: ReviewedClassLevelSlot) {
  return {
    key,
    name,
    basis: `${basis} The saved choice is the feat Selection in each row's slot; its eligibility, the feat's own prerequisites and the slot's feat types, is advisory (#313, docs/character-sheet/rules-checks.md).`,
    bodyNumbersNotNamedAsMechanism: `none: the bonus feat count is the ${classLevelSlotsSource} change, which the reviewed schedule slots deliver (class-level-slots)`,
    unmodelledNumber: false,
    scheduleSlot: true as const,
  };
}

/** The family's raw registry entry (`launchMechanismProofs`). */
export const classLevelSlotsProofEntry = {
  family: 'class-level-slots',
  mechanismPrefix: 'Modifier ',
  kinds: ['classFeature'],
  tests: [
    {
      path: 'convex/characterSheetClassLevelSlots.integration.test.ts',
      sha256:
        'acb002153cd61a665aa2481b0abbfa4705b85f123aba7f5417dd59eba61b02cf',
    },
    // The shapes the proof imports, bound as the test is: the coverage tie
    // (`tests/catalog/launch-class-level-slots.test.ts`) reads them.
    {
      path: 'tests/class-level-slots-proof.ts',
      sha256:
        'b65da519d5b69b20e2913fc1e5858f265fa61a8b1cd89499983178897190d7c8',
    },
  ],
  calculationIdentity:
    'sha256:19cff24a1223d8d2e6853141709ac37da5145b1352b140ddcb1adb5a8c826038',
  disqualifying: ['curation'],
  classLevelSlots: {
    source: classLevelSlotsSource,
    reviewed: reviewedClassLevelSlots,
  },
};

/** The reviewed schedule slot of a row, by its release key. */
export function reviewedScheduleSlot(key: string) {
  return reviewedSlots.get(key);
}

/** The entry carries exactly the row's reviewed schedule slot. */
export function carriesReviewedSlot(key: string, grantsSlots: unknown) {
  const slot = reviewedScheduleSlot(key);
  return (
    slot !== undefined &&
    canonicalReleaseJson(grantsSlots ?? null) === canonicalReleaseJson([slot])
  );
}

/**
 * Whether the family names a mechanism of this name on the row with this
 * key: a `Modifier bonusFeats …` of a listed row.
 */
export function classLevelSlotsNamesMechanism(
  scope: ClassLevelSlotsScope,
  key: string,
  name: string,
) {
  return (
    name.startsWith(mechanismPrefix) &&
    scope.reviewed.some((listed) => listed.key === key)
  );
}

/**
 * The formula's value at each class level, when it reads only
 * `@class.level` in the app's formula grammar; any other variable, grammar
 * or an evaluation error gives none.
 */
function classLevelFormula(formula: string) {
  const variables = formula.match(/@[A-Za-z][A-Za-z0-9_.]*/g) ?? [];
  if (variables.some((name) => name !== classLevelVariable)) return undefined;
  let node: ReturnType<typeof parseFormula>;
  try {
    node = parseFormula(formula);
  } catch (error) {
    if (error instanceof FormulaError) return undefined;
    throw error;
  }
  return (level: number) => {
    try {
      return evaluateFormula(node, () => level);
    } catch (error) {
      if (error instanceof FormulaError) return undefined;
      throw error;
    }
  };
}

/** An `unsupported` issue as the projection reads it. */
export type UnsupportedIssue = {
  field: string;
  reason?: string;
  value?: unknown;
};

const isChanges = ({ field }: UnsupportedIssue) =>
  field === 'changes' || field.startsWith('changes.');

/** The issue is the importer's own for the raw change, untyped. */
function isRawIssue(
  { field, reason, value }: UnsupportedIssue,
  formula: string,
) {
  if (field !== 'changes' || reason !== unmappedChangeReason) return false;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields: Record<string, unknown> = { ...value };
  return (
    Object.keys(fields).sort().join() === 'formula,target,type' &&
    fields.target === classLevelSlotsSource &&
    fields.formula === formula &&
    fields.type === 'untyped'
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'sources'>;
export type ClassLevelSlotsInput = {
  row: ProvenRow;
  /** The row's outstanding, non-prose mechanism names. */
  names: readonly string[];
  /** The parent's scoped build entry. */
  entry: unknown;
  /** The row's issues no disqualifier dropped. */
  issues: readonly UnsupportedIssue[];
  /** The scoped entries of the class rows whose scoped entry lists the parent. */
  listings: readonly unknown[];
  /** The parent's increment rows, by release key, and whether the gate admits each. */
  increments: ReadonlyMap<string, boolean>;
  /** A release key's scoped build entry. */
  entryOf: (key: string) => unknown;
};

/** A row entry of the parent: exactly its reviewed slot, and no Modifier. */
function slotRowEntry(key: string, entry: unknown) {
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  return (
    parsed.success &&
    parsed.data.externalKey === key &&
    parsed.data.detail.kind === 'classFeature' &&
    parsed.data.modifiers.length === 0 &&
    carriesReviewedSlot(key, parsed.data.grantsSlots)
  );
}

/**
 * One listing class's rows of the parent: its acquisition level and each
 * row's class level, when the class lists the parent once, every other row
 * of it is an admitted increment listed once, and every row's entry carries
 * exactly its reviewed slot.
 */
function listedRows(
  listing: unknown,
  parentKey: string,
  { increments, entryOf }: ClassLevelSlotsInput,
) {
  const parsed = importedCatalogEntrySchema.safeParse(listing);
  if (!parsed.success || parsed.data.detail.kind !== 'class') return undefined;
  const rows = parsed.data.detail.featuresByLevel.filter(({ externalKey }) => {
    if (externalKey === parentKey || increments.has(externalKey)) return true;
    const found = importedCatalogEntrySchema.safeParse(entryOf(externalKey));
    return (
      found.success &&
      found.data.detail.kind === 'classFeature' &&
      found.data.detail.parentFeature === parentKey
    );
  });
  const keys = rows.map(({ externalKey }) => externalKey);
  const acquisition = rows.filter(
    ({ externalKey }) => externalKey === parentKey,
  );
  if (
    acquisition.length !== 1 ||
    new Set(keys).size !== keys.length ||
    !keys.every(
      (key) =>
        (key === parentKey || increments.get(key) === true) &&
        slotRowEntry(key, entryOf(key)),
    )
  )
    return undefined;
  return {
    from: acquisition[0]?.classLevel ?? Number.NaN,
    levels: rows.map(({ classLevel }) => classLevel),
  };
}

/**
 * The row's one Modifier mechanism, a `Modifier bonusFeats …` of a listed
 * row bound to its reviewed source bytes; otherwise none.
 */
function reviewedMechanism(
  scope: ClassLevelSlotsScope,
  { row, names }: ClassLevelSlotsInput,
) {
  const reviewed = scope.reviewed.find(({ key }) => key === row.key);
  const modifierNames = names.filter((name) => name.startsWith('Modifier '));
  const [name] = modifierNames;
  return reviewed &&
    row.sources.some(({ rawSha256 }) => rawSha256 === reviewed.sourceSha256) &&
    modifierNames.length === 1 &&
    name?.startsWith(mechanismPrefix)
    ? name
    : undefined;
}

/** The row's only `changes` issue, when it is the raw change of this formula. */
function onlyRawIssue(issues: readonly UnsupportedIssue[], formula: string) {
  const changes = issues.filter(isChanges);
  const [rawIssue] = changes;
  return changes.length === 1 && rawIssue && isRawIssue(rawIssue, formula)
    ? rawIssue
    : undefined;
}

/**
 * The listing class's rows of the parent deliver the formula: at every class
 * level from the acquisition there to 20, as many rows at or below it as the
 * formula gives.
 */
function deliversFormula(
  rows: ReturnType<typeof listedRows>,
  valueAt: NonNullable<ReturnType<typeof classLevelFormula>>,
) {
  if (!rows || !Number.isInteger(rows.from) || rows.from > maxClassLevel)
    return false;
  for (let level = rows.from; level <= maxClassLevel; level += 1)
    if (
      valueAt(level) !==
      rows.levels.filter((rowLevel) => rowLevel <= level).length
    )
      return false;
  return true;
}

/**
 * The row's proven `Modifier bonusFeats …` mechanism, with the raw `changes`
 * issue it takes, when the rule holds (the module's description); otherwise
 * none.
 */
export function provenClassLevelSlots(
  scope: ClassLevelSlotsScope,
  input: ClassLevelSlotsInput,
): { mechanisms: string[]; rawIssue: UnsupportedIssue } | undefined {
  const name = reviewedMechanism(scope, input);
  const parsed = importedCatalogEntrySchema.safeParse(input.entry);
  if (!name || !parsed.success) return undefined;
  const formula = name.slice(mechanismPrefix.length);
  const parentKey = parsed.data.externalKey;
  const valueAt = classLevelFormula(formula);
  const rawIssue = onlyRawIssue(input.issues, formula);
  return valueAt &&
    rawIssue &&
    slotRowEntry(parentKey, input.entry) &&
    input.listings.length > 0 &&
    input.listings.every((listing) =>
      deliversFormula(listedRows(listing, parentKey, input), valueAt),
    )
    ? { mechanisms: [name], rawIssue }
    : undefined;
}
