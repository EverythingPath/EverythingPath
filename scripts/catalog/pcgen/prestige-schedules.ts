import { locatorId, resolveGrant, type PcgenOwnedRow } from './inventory';
import { toPcgenKey } from './keys';
import type { PcgenPrestigeClass, PcgenRecord, PcgenTree } from './lst';
import { at, type At } from './schedule-model';

/**
 * #716 D1 (research party-code §1): a prestige class's reviewed level
 * grants, from which the importer writes its `featuresByLevel`.
 *
 * - One acquisition row per feature the class owns, at the level of PCGen's
 *   `PREVARGTEQ:<namespace>_CFP_Level,<level>` gate (the `.MOD` lines of its
 *   `CATEGORY:Class` record), each cited to the PRD's class table: the
 *   Special column's entry at that level, else the class feature paragraph
 *   (`classFeature`) for a feature the column doesn't print.
 * - No increment rows: the later steps the table prints (`laterSteps`) are
 *   the acquisition's own rules, and level-scaled values are left for its
 *   structure records.
 * - Where PCGen and the table disagree no row is chosen: the review stops and
 *   reports it. `prestigeFeatureRows` refuses a schedule that no longer
 *   matches the gates or the class's owned features.
 */
export type PrestigePrinted =
  | {
      kind: 'special';
      /** The Special column's entry at the row's level, as printed. */
      entry: string;
      /** The later Special column entries of the same feature, as printed. */
      laterSteps?: readonly { level: number; entry: string }[];
    }
  | {
      kind: 'classFeature';
      /** The page line of the feature's paragraph under Class Features. */
      line: number;
      text: string;
    };
export type PrestigeScheduleRow = {
  /** The Special Ability KEY the gate grants. */
  feature: string;
  classLevel: number;
  /** The `.MOD` line whose gate grants it at `classLevel`. */
  gate: At;
  printed: PrestigePrinted;
};
type NonEmpty<T> = readonly [T, ...T[]];
export type ReviewedPrestigeSchedule = {
  /** The class block's PCGen KEY. */
  key: string;
  /** The PCGen class its `<namespace>_CFP_Level` gate variable names. */
  flagNamespace: string;
  /** The PRD capture page (under `pages/`) and its class table's caption. */
  printedTable: { page: string; caption: string };
  /** In level order, then the table's order. */
  rows: NonEmpty<PrestigeScheduleRow>;
};

const cr = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const special = (
  entry: string,
  laterSteps?: readonly { level: number; entry: string }[],
): PrestigePrinted => ({
  kind: 'special',
  entry,
  ...(laterSteps && { laterSteps }),
});

/**
 * Dragon Disciple (Core Rulebook pp. 380-382): PCGen's gates at
 * cr_abilities_class.lst:353-360, the PRD's Table: Dragon Disciple at
 * coreRulebook/prestigeClasses/dragonDisciple.html:363-372. Every gated
 * level is the level the table prints the feature at. The Special column
 * prints neither Weapon and Armor Proficiency nor Spells per Day: both are
 * class feature paragraphs with no level of their own (:376, :377), which
 * PCGen grants at 1st; the Spells per Day column's advances are the class's
 * `castingAdvances` (cr_classes.lst:385-391), not rows.
 */
const dragonDisciple: ReviewedPrestigeSchedule = {
  key: 'Dragon Disciple',
  flagNamespace: 'DragonDisciple',
  printedTable: {
    page: 'coreRulebook/prestigeClasses/dragonDisciple.html',
    caption: 'Dragon Disciple',
  },
  rows: [
    {
      feature: 'Dragon Disciple ~ Weapon and Armor Proficiency',
      classLevel: 1,
      gate: at(cr, 353),
      printed: {
        kind: 'classFeature',
        line: 376,
        text: 'Not in the Special column: the class feature paragraph, a class feature from 1st level.',
      },
    },
    {
      feature: 'Dragon Disciple ~ Spells per Day',
      classLevel: 1,
      gate: at(cr, 354),
      printed: {
        kind: 'classFeature',
        line: 377,
        text: 'Not in the Special column: the class feature paragraph; its advances are the Spells per Day column, from 2nd level (castingAdvances).',
      },
    },
    {
      feature: 'Dragon Disciple ~ Blood of Dragons',
      classLevel: 1,
      gate: at(cr, 355),
      printed: special('Blood of dragons'),
    },
    {
      feature: 'Dragon Disciple ~ Natural Armor Increase',
      classLevel: 1,
      gate: at(cr, 355),
      printed: special('natural armor increase (+1)', [
        { level: 4, entry: 'natural armor increase (+1)' },
        { level: 7, entry: 'natural armor increase (+1)' },
      ]),
    },
    {
      feature: 'Dragon Disciple ~ Ability Boost',
      classLevel: 2,
      gate: at(cr, 356),
      printed: special('Ability boost (Str +2)', [
        { level: 4, entry: 'Ability boost (Str +2)' },
        { level: 6, entry: 'Ability boost (Con +2)' },
        { level: 8, entry: 'Ability boost (Int +2)' },
      ]),
    },
    {
      feature: 'Dragon Disciple ~ Bloodline Feat',
      classLevel: 2,
      gate: at(cr, 356),
      printed: special('bloodline feat', [
        { level: 5, entry: 'bloodline feat' },
        { level: 8, entry: 'bloodline feat' },
      ]),
    },
    {
      feature: 'Dragon Disciple ~ Dragon Bite',
      classLevel: 2,
      gate: at(cr, 356),
      printed: special('dragon bite'),
    },
    {
      feature: 'Dragon Disciple ~ Breath Weapon',
      classLevel: 3,
      gate: at(cr, 357),
      printed: special('Breath weapon'),
    },
    {
      feature: 'Dragon Disciple ~ Blindsense',
      classLevel: 5,
      gate: at(cr, 358),
      printed: special('Blindsense 30 ft.', [
        { level: 10, entry: 'Blindsense 60 ft.' },
      ]),
    },
    {
      feature: 'Dragon Disciple ~ Dragon Form',
      classLevel: 7,
      gate: at(cr, 359),
      printed: special('Dragon form (1/day)', [
        { level: 10, entry: 'Dragon form (2/day)' },
      ]),
    },
    {
      feature: 'Dragon Disciple ~ Wings',
      classLevel: 9,
      gate: at(cr, 360),
      printed: special('Wings'),
    },
  ],
};

const schedules: ReadonlyMap<string, ReviewedPrestigeSchedule> = new Map(
  [dragonDisciple].map((schedule) => [toPcgenKey(schedule.key), schedule]),
);

/** The reviewed schedule of a prestige class, by its PCGen KEY. */
export const reviewedPrestigeSchedule = (key: string) =>
  schedules.get(toPcgenKey(key));

/** The class's gated grants: each granted KEY with its gate's level and line. */
function gatedGrants(
  tree: PcgenTree,
  record: PcgenPrestigeClass,
  namespace: string,
) {
  const variable = `${namespace}_CFP_Level`;
  return record.grants
    .filter(({ category }) => category === 'Class')
    .flatMap(({ keys }) =>
      keys.flatMap(
        (key) => resolveGrant(tree.classRecords, key, record.pack).records,
      ),
    )
    .flatMap(({ grants }) => grants)
    .flatMap(({ keys, prerequisites, file, line }) => {
      const gate = prerequisites.find(
        ({ kind, isNegated, items }) =>
          kind === 'PREVARGTEQ' && !isNegated && items[0] === variable,
      );
      const level = Number(gate?.items[1]);
      return gate && Number.isInteger(level)
        ? keys.map((key) => ({ key, level, gate: at(file, line) }))
        : [];
    });
}

/** The class's directly owned features by folded KEY, and each grant no record has. */
function ownedFeaturesOf(owned: readonly PcgenOwnedRow[]) {
  const findings: string[] = [];
  const features = new Map<string, PcgenRecord>();
  for (const row of owned) {
    if (row.depth !== 1) continue;
    if (!row.feature)
      findings.push(`${row.key} is granted but no record has its KEY.`);
    else if (!features.has(toPcgenKey(row.key)))
      features.set(toPcgenKey(row.key), row.feature);
  }
  return { features, findings };
}

/**
 * The class's features by level: each owned feature (the inventory's
 * depth-1 rows of the class) at its reviewed row's level, in the schedule's
 * order. `findings` names every reviewed row PCGen's gates no longer give
 * and every owned feature without exactly one row; the importer refuses a
 * schedule with findings.
 */
export function prestigeFeatureRows({
  tree,
  record,
  owned,
  schedule,
}: {
  tree: PcgenTree;
  record: PcgenPrestigeClass;
  /** The inventory's rows of this class. */
  owned: readonly PcgenOwnedRow[];
  schedule: ReviewedPrestigeSchedule;
}) {
  const grants = gatedGrants(tree, record, schedule.flagNamespace);
  const { features, findings } = ownedFeaturesOf(owned);
  const rows = schedule.rows.flatMap((row) => {
    const granted = grants.filter(
      ({ key }) => toPcgenKey(key) === toPcgenKey(row.feature),
    );
    const matches = granted.some(
      ({ level, gate }) => level === row.classLevel && gate === row.gate,
    );
    if (!matches)
      findings.push(
        granted.length
          ? `${row.feature} is granted at ${granted.map(({ level, gate }) => `level ${level} (${gate})`).join(', ')}, not at level ${row.classLevel} (${row.gate}).`
          : `${row.feature} has no ${schedule.flagNamespace}_CFP_Level gate.`,
      );
    const feature = features.get(toPcgenKey(row.feature));
    if (!feature) findings.push(`${row.feature} is not an owned feature.`);
    return feature ? [{ classLevel: row.classLevel, feature }] : [];
  });
  const scheduled = new Map<string, number>();
  for (const { feature } of rows)
    scheduled.set(
      locatorId(feature),
      (scheduled.get(locatorId(feature)) ?? 0) + 1,
    );
  for (const feature of features.values()) {
    const count = scheduled.get(locatorId(feature)) ?? 0;
    if (count !== 1)
      findings.push(
        count
          ? `${feature.locator.key} has ${count} reviewed rows.`
          : `${feature.locator.key} is an owned feature with no reviewed row.`,
      );
  }
  return { rows, findings };
}
