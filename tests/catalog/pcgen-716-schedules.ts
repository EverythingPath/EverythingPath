import { locatorKeyOf } from '../../scripts/catalog/everythingpath-identities';
import { planImportBatches } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  archetypeClassContext,
  mapArchetype,
  type ArchetypeMapping,
} from '../../scripts/catalog/pcgen/archetypes';
import type { PcgenEffectiveView } from '../../scripts/catalog/pcgen/effective';
import type { assignPcgenIdentities } from '../../scripts/catalog/pcgen/identities';
import type { PcgenInventory } from '../../scripts/catalog/pcgen/inventory';
import type { PcgenRecord, PcgenTree } from '../../scripts/catalog/pcgen/lst';
import {
  compareSchedule,
  foundryAssociations,
  incrementEntries,
  pcgenSchedule,
  resolveSuffix,
  reviewedSchedule,
  type ReviewedSchedule,
  type ScheduleFinding,
} from '../../scripts/catalog/pcgen/schedules';
import { classTableRows } from '../../scripts/catalog/prd-coverage';
import { readPinned } from './pinned-sources';

/**
 * The checks every #716 schedule slice's tests share (P5, P7), on the slice's
 * pinned PCGen tree: a class's reviewed schedule, PCGen's schedule derived
 * from the tree, their comparison with Foundry's links, what a variable
 * suffix names and the count of each grant kind.
 */
export function scheduleChecks({
  tree,
  view,
}: {
  tree: PcgenTree;
  view: PcgenEffectiveView;
}) {
  const schedule = requireReviewedSchedule;
  const derive = (className: string) =>
    pcgenSchedule({ tree, view, schedule: schedule(className) });
  const compare = async (className: string) => {
    const reviewed = schedule(className);
    return compareSchedule({
      schedule: reviewed,
      pcgen: derive(className),
      foundry: foundryAssociations(
        reviewed.foundryFile,
        await readPinned('pf1', reviewed.foundryFile),
      ),
    });
  };
  /** The feature and explicit level a suffix names, else its non-row kind. */
  const levelOf = (className: string, suffix: string) => {
    const target = resolveSuffix(schedule(className), suffix);
    return target.kind === 'feature'
      ? [target.feature.id, target.classLevel]
      : [target.kind];
  };
  /** How many gated, ungated and nested grants PCGen gives the class (P7-0's grant kinds). */
  const countGrantKinds = (className: string) => {
    const { acquisitions, ungatedGrants, nestedGrants } = derive(className);
    return [acquisitions.length, ungatedGrants.length, nestedGrants.length];
  };
  return { schedule, derive, compare, levelOf, countGrantKinds };
}

/** A reviewed schedule's later rows' names, by their keys (#716 P6). */
export const listIncrementNames = (schedule: ReviewedSchedule) =>
  Object.fromEntries(
    incrementEntries(schedule).map(({ externalKey, name }) => [
      externalKey,
      name,
    ]),
  );

/** The reviewed schedule of a class, which must have one. */
function requireReviewedSchedule(className: string): ReviewedSchedule {
  const found = reviewedSchedule(className);
  if (!found) throw new Error(`No reviewed ${className} schedule.`);
  return found;
}

/**
 * The mapper checks every #716 schedule slice's archetype tests share (note
 * §5.8), on the slice's pinned PCGen tree and its assigned identities: one
 * published archetype mapped onto its class's reviewed schedule, and the
 * sub-batch of at most 100 keys it plans (plan Appendix G).
 */
export function bindArchetypeMapper({
  tree,
  view,
  identities,
}: {
  tree: PcgenTree;
  view: PcgenEffectiveView;
  identities: ReturnType<typeof assignPcgenIdentities>;
}) {
  const requireIdentityKey = ({
    keys,
    record,
  }: {
    keys: ReadonlyMap<string, string>;
    record: PcgenRecord;
  }) => {
    const key = keys.get(
      locatorKeyOf({ source: 'pcgen', locator: record.locator }),
    );
    if (!key) throw new Error(`No key for ${record.locator.key}.`);
    return key;
  };
  const mapPublishedArchetype = ({
    className,
    archetype,
  }: {
    className: string;
    archetype: string;
  }): ArchetypeMapping => {
    const record = tree.archetypes.find(
      ({ locator }) => locator.key === archetype,
    );
    if (!record) throw new Error(`No ${archetype}.`);
    return mapArchetype({
      context: archetypeClassContext({
        tree,
        view,
        schedule: requireReviewedSchedule(className),
      }),
      record,
      externalKey: requireIdentityKey({ keys: identities.owners.keys, record }),
      featureKeyOf: (feature) =>
        requireIdentityKey({ keys: identities.features.keys, record: feature }),
    });
  };
  return { mapPublishedArchetype };
}

/**
 * The base class the inventory gives an archetype (`PcgenOwner.className`),
 * which must give one: the class a mapping is read against when no test
 * names it.
 */
export function readInventoryClass({
  inventory,
  archetype,
}: {
  inventory: PcgenInventory;
  archetype: string;
}) {
  const owner = inventory.owners.find(
    ({ record }) => record.locator.key === archetype,
  );
  if (!owner?.className)
    throw new Error(`The inventory gives ${archetype} no base class.`);
  return owner.className;
}

/** The archetype's catalog detail, which must be an archetype's. */
export function readArchetypeDetail({ subject }: ArchetypeMapping) {
  const { detail } = subject.entry;
  if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
  return detail;
}

/** The mapping's review items as `[kind, id]`. */
export const summarizeItems = ({ items }: ArchetypeMapping) =>
  items.map(({ kind, id }) => [kind, id]);

/** What the archetype replaces as `[classLevel, externalKey, scope]`. */
export const listReplacements = (mapping: ArchetypeMapping) =>
  readArchetypeDetail(mapping).replaces.map(
    ({ classLevel, externalKey, scope }) => [classLevel, externalKey, scope],
  );

/** The sizes of the archetype's sub-batches: it and the features it owns directly. */
export function planArchetypeBatch({
  className,
  mapping,
}: {
  className: string;
  mapping: ArchetypeMapping;
}) {
  const { batches } = planImportBatches({
    selector: {
      source: '#716 PRD/PCGen import',
      kind: 'archetype',
      base_class: className,
      max_candidates: 100,
    },
    owners: [
      {
        kind: 'archetype',
        name: mapping.subject.entry.name,
        baseClass: className,
        locator: mapping.subject.locator,
        ownedFeatures: mapping.ownedFeatures.map(({ locator }) => locator),
      },
    ],
  });
  return batches.map(({ owners, features }) => owners.length + features.length);
}

/** Each finding as `[kind, feature, settledBy]`. */
export const brief = (findings: readonly ScheduleFinding[]) =>
  findings.map(({ kind, feature, settledBy }) => [kind, feature, settledBy]);

/** The text of a pinned `<file>:<line>`, PCGen's under `pcgenPin.directory`. */
export async function pinnedLine(repo: 'pcgen' | 'pf1' | 'prd', at: string) {
  const [file = '', line = ''] = at.split(':');
  const path = repo === 'pcgen' ? `${pcgenPin.directory}/${file}` : file;
  return (await readPinned(repo, path)).split(/\r?\n/)[Number(line) - 1] ?? '';
}

/** A pinned PRD page's text from `from` to `to` (1-based lines), tags dropped. */
export async function readPrdText({
  page,
  from,
  to,
}: {
  page: string;
  from: number;
  to: number;
}) {
  return (await readPinned('prd', `pages/${page}`))
    .split('\n')
    .slice(from - 1, to)
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');
}

/** A row label as the PRD prints it: case, apostrophes and Foundry's “(UC)” aside. */
export const normalizePrintedLabel = (text: string) =>
  text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/ \(uc\)$/, '');

/** The schedule's reviewed printed table and the table's rows, read from the pinned PRD page. */
async function readPrintedTable(schedule: ReviewedSchedule) {
  const { printedTable } = schedule;
  if (printedTable?.status !== 'reviewed')
    throw new Error(`${schedule.className} has no reviewed table.`);
  const rows = classTableRows(
    await readPinned('prd', `pages/${printedTable.page}`),
    printedTable.caption,
  );
  return { printedTable, rows };
}

/**
 * A reviewed schedule's rows against its printed table (#716 P7, owner
 * decision 8): for each level, the labels the schedule's rows print there
 * (`incrementName`, else the feature's name, and any `alsoPrinted` entry) and
 * the table's Special column entries, both normalized and sorted. Rows the
 * table cites as `unprinted` print nothing, and a column-printed feature
 * (`columns`) prints only its acquisition there.
 */
export async function comparePrintedRows(schedule: ReviewedSchedule) {
  const { features } = schedule;
  const { printedTable, rows } = await readPrintedTable(schedule);
  const listScheduleLabels = (level: number) =>
    features
      .filter(({ id }) => !(id in printedTable.unprinted))
      .flatMap((feature) => [
        ...feature.levels.flatMap((rowLevel, index) =>
          rowLevel === level &&
          (index === 0 || !printedTable.columns?.[feature.id])
            ? [
                normalizePrintedLabel(
                  feature.incrementName?.(index) ?? feature.name,
                ),
              ]
            : [],
        ),
        ...(printedTable.alsoPrinted?.[feature.id] ?? []).flatMap((also) =>
          also.level === level ? [normalizePrintedLabel(also.entry)] : [],
        ),
      ])
      .sort();
  return rows.map(({ level, line, special }) => ({
    level,
    line,
    schedule: listScheduleLabels(level),
    table: special.map(normalizePrintedLabel).sort(),
  }));
}

/**
 * What a column-printed row steps on at a level: the value the column
 * prints, or the attacks it prints beyond the iterative attacks of a base
 * attack bonus equal to the class level, one per 5 levels (CRB monk's flurry,
 * coreRulebook/classes/monk.html:385).
 */
function readColumnStep({
  reading,
  printed,
  level,
}: {
  reading: 'value' | 'extraAttacks';
  printed: string;
  level: number;
}) {
  return reading === 'value'
    ? printed
    : String(printed.split('/').length - Math.ceil(level / 5));
}

/**
 * Each column-printed feature's later rows against its column (#716 P7b):
 * the schedule's later rows with their labels, and the table's steps after
 * the acquisition, each with the value the column prints there.
 */
export async function comparePrintedColumns(schedule: ReviewedSchedule) {
  const { printedTable, rows } = await readPrintedTable(schedule);
  return Object.entries(printedTable.columns ?? {}).map(
    ([id, { column, reading }]) => {
      const feature = schedule.features.find((found) => found.id === id);
      if (!feature) throw new Error(`No ${id} in ${schedule.className}.`);
      const [acquiredAt = 1] = feature.levels;
      const readStepAt = (row: (typeof rows)[number]) => {
        const printed = row.columns[column];
        if (printed === undefined)
          throw new Error(`${printedTable.caption} has no ${column} column.`);
        return {
          printed,
          step: readColumnStep({ reading, printed, level: row.level }),
        };
      };
      const table = rows.flatMap((row, index) => {
        const previous = rows[index - 1];
        if (row.level <= acquiredAt || !previous) return [];
        const { printed, step } = readStepAt(row);
        return readStepAt(previous).step === step
          ? []
          : [{ level: row.level, line: row.line, printed, reading }];
      });
      return {
        feature: id,
        column,
        schedule: feature.levels.slice(1).map((level, index) => ({
          level,
          label: feature.incrementName?.(index + 1) ?? feature.name,
        })),
        table,
      };
    },
  );
}
