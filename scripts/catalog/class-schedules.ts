import type { PreviewEntry } from './map.ts';
import { reviewedScheduleSlots } from './pcgen/schedule-slots.ts';
import {
  incrementEntries,
  reviewedSchedule,
  scheduleRows,
  type ReviewedSchedule,
} from './pcgen/schedules.ts';
import { uuidKey, type SourceRecord, type Unsupported } from './records.ts';
import { readArray, readObject, readText } from './values.ts';

const field = 'links.classAssociations';
const slots = reviewedScheduleSlots();

type Row = { classLevel: number; externalKey: string };
type Association = { level: unknown; externalKey?: string; uuid: string };

/**
 * S3: a class with a reviewed schedule (#716 P5-P7) takes its
 * `featuresByLevel` from the schedule, not from Foundry's links, and gains
 * the schedule's increment entries, so every reviewed row reaches the
 * release. Foundry's links are checked against the schedule (as
 * `compareSchedule` does): a feature's acquisition at its table level is a
 * row; a reviewed non-row that is no table feature (Fighter Heavy Armor,
 * Bonus Languages) stays at its Foundry level; a reviewed non-row that is a
 * table feature (Barbarian Tireless Rage at 16) takes the table's level.
 * Any other link, a scheduled key that doesn't resolve and a remapped one
 * are refused as broken structure, never dropped.
 *
 * An increment takes its parent's upstream key and Attribution Assessment
 * (`attributionFrom`, #721), so it is admitted exactly when its parent is.
 * A row a reviewed slot rule names (`schedule-slots.ts`), acquisition or
 * increment, gains its bonus feat slot. Every other entry is returned
 * unchanged.
 */
export function reviewedScheduleEntries({
  entry,
  record,
  resolveKey,
}: {
  entry: PreviewEntry;
  record: SourceRecord;
  resolveKey: (key: string) => string | undefined;
}): PreviewEntry[] {
  const schedule =
    entry.detail.kind === 'class' ? reviewedSchedule(entry.name) : undefined;
  if (entry.detail.kind !== 'class' || schedule?.classKey !== entry.upstreamKey)
    return [withSlot(entry)];
  const unsupported = entry.unsupported.filter((item) => item.field !== field);
  const refuse = (reason: string, value: Unsupported['value']) =>
    unsupported.push({ field, reason, value });
  const resolves = (row: Row) => {
    const key = resolveKey(row.externalKey);
    if (key === row.externalKey) return true;
    refuse(
      key === undefined
        ? 'Missing or out-of-scope feature reference.'
        : `Remapped to ${key}: the reviewed schedule names its features by upstream key.`,
      { level: row.classLevel, externalKey: row.externalKey },
    );
    return false;
  };
  const kept = keptFoundryRows({ schedule, record, refuse });
  const parents = new Set(
    schedule.features
      .filter((feature) =>
        resolves({
          classLevel: feature.levels[0] ?? 0,
          externalKey: feature.externalKey,
        }),
      )
      .map(({ id }) => id),
  );
  const featuresByLevel = [
    ...scheduleRows(schedule)
      .filter(({ feature }) => parents.has(feature))
      .map(({ classLevel, externalKey }) => ({ classLevel, externalKey })),
    ...kept.filter(resolves),
  ].sort((left, right) => left.classLevel - right.classLevel);
  const increments = incrementEntries(schedule).flatMap((increment) => {
    const parent =
      increment.detail.kind === 'classFeature'
        ? increment.detail.parentFeature
        : undefined;
    const feature = schedule.features.find(
      ({ externalKey }) => externalKey === parent,
    );
    return parent && feature && parents.has(feature.id)
      ? [
          withSlot({
            ...increment,
            upstreamKey: parent,
            attributionFrom: parent,
          }),
        ]
      : [];
  });
  return [
    {
      ...entry,
      detail: { ...entry.detail, featuresByLevel },
      unsupported,
    },
    ...increments,
  ];
}

/** A slot-bearing row with its reviewed bonus feat slot. */
function withSlot(entry: PreviewEntry): PreviewEntry {
  const slot = slots.get(entry.externalKey);
  return slot
    ? {
        ...entry,
        grantsSlots: [
          ...(entry.grantsSlots ?? []),
          { ...slot, featTypes: [...slot.featTypes] },
        ],
      }
    : entry;
}

/** Foundry's non-rows the schedule keeps at their Foundry level, refusing every unexplained link. */
function keptFoundryRows({
  schedule,
  record,
  refuse,
}: {
  schedule: ReviewedSchedule;
  record: SourceRecord;
  refuse: (reason: string, value: Unsupported['value']) => void;
}): Row[] {
  const isFeature = (key: string) =>
    schedule.features.some(({ externalKey }) => externalKey === key);
  return foundryLinks(record).flatMap(({ level, externalKey, uuid }): Row[] => {
    const links = (key: string, classLevel: number | undefined) =>
      key === externalKey && classLevel === level;
    if (schedule.features.some((row) => links(row.externalKey, row.levels[0])))
      return [];
    if (
      externalKey &&
      typeof level === 'number' &&
      schedule.foundryNonRows.some((row) => links(row.externalKey, row.level))
    )
      return isFeature(externalKey) ? [] : [{ classLevel: level, externalKey }];
    refuse(
      'Foundry links a feature the reviewed class schedule does not explain.',
      externalKey ? { level, externalKey } : { level, uuid },
    );
    return [];
  });
}

function foundryLinks(record: SourceRecord): Association[] {
  return readArray(readObject(record.system.links).classAssociations).map(
    (value) => {
      const link = readObject(value);
      const uuid = readText({ value: link.uuid });
      const externalKey = uuidKey(uuid);
      return { level: link.level, uuid, ...(externalKey && { externalKey }) };
    },
  );
}
