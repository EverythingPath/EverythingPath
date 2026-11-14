import { z } from 'zod';
import type { CanonicalResolutionRecord } from './canonical-resolution-record';

export type HeadlineValue = string | number | boolean | null;
export type HeadlineUnit = 'number' | 'gp' | 'text';
export type FinishedWeekHeadlineFact = {
  key: string;
  label: string;
  before: HeadlineValue;
  final: HeadlineValue;
  beforeRecorded: boolean;
  finalRecorded: boolean;
  unit: HeadlineUnit;
};

type RecordedFacts = Record<string, unknown>;
type RecordedValue = { recorded: boolean; value: HeadlineValue };
type RecordedEntity = { id: string; name?: string; value: string | null };
type EntityFamily = {
  keyPrefix: string;
  fallbackLabel: string;
  readEntities: (facts: RecordedFacts | undefined) => unknown;
  entitySchema: z.ZodType<RecordedEntity[]>;
  readBefore: (record: CanonicalResolutionRecord) => RecordedFacts | undefined;
  readFinal: (record: CanonicalResolutionRecord) => RecordedFacts | undefined;
};

const MAX_HEADLINES = 2;
const recordedFactsSchema = z.record(z.string(), z.unknown());
const integerSchema = z.number().int();

// Family order is the approved headline priority; entries within a family keep
// their recorded order.
const militiaValueFamilies = [
  {
    key: 'treasury',
    field: 'treasuryCopper',
    label: 'Treasury',
    unit: 'gp',
    schema: integerSchema,
  },
  {
    key: 'training',
    field: 'training',
    label: 'Training',
    unit: 'number',
    schema: integerSchema,
  },
  {
    key: 'rank',
    field: 'rank',
    label: 'Rank',
    unit: 'number',
    schema: integerSchema,
  },
  {
    key: 'notoriety',
    field: 'notoriety',
    label: 'Notoriety',
    unit: 'number',
    schema: integerSchema,
  },
  {
    key: 'focus',
    field: 'focus',
    label: 'Focus',
    unit: 'text',
    schema: z.string().nullable(),
  },
] as const;
const entityFamilies: EntityFamily[] = [
  {
    keyPrefix: 'team',
    fallbackLabel: 'Team',
    readEntities: (militia) => readRecordedFacts(militia?.roster)?.teams,
    entitySchema: z.array(
      z
        .object({
          teamId: z.string(),
          name: z.string().optional(),
          status: z.string(),
        })
        .transform(({ teamId, name, status }) => ({
          id: teamId,
          name,
          value: status,
        })),
    ),
    readBefore: readBeforeMilitia,
    readFinal: readFinalMilitia,
  },
  {
    keyPrefix: 'settlement',
    fallbackLabel: 'Settlement',
    readEntities: (militia) => militia?.settlements,
    entitySchema: z.array(
      z
        .object({
          settlementId: z.string(),
          name: z.string().optional(),
          reputation: z.string().nullable(),
        })
        .transform(({ settlementId, name, reputation }) => ({
          id: settlementId,
          name,
          value: reputation,
        })),
    ),
    readBefore: readBeforeMilitia,
    readFinal: readFinalMilitia,
  },
  {
    keyPrefix: 'event',
    fallbackLabel: 'Persistent event',
    readEntities: (context) => context?.carriedEvents,
    entitySchema: z.array(
      z
        .object({ eventId: z.string(), eventType: z.string() })
        .transform(({ eventId, eventType }) => ({
          id: eventId,
          value: eventType,
        })),
    ),
    readBefore: (record) => record.source.context,
    readFinal: (record) => record.successorContext,
  },
];

// Compact finished-week comparisons read only this immutable record: its stored
// source snapshot and its final facts (final outcome or plan-after). No rules
// are re-run and no current labels are used. Values the record does not hold
// are unavailable, never an assumed zero.
export function projectHeadlineFacts(
  record: CanonicalResolutionRecord,
): FinishedWeekHeadlineFact[] {
  const candidates = [
    ...compareMilitiaValues(record),
    ...entityFamilies.flatMap((family) => compareEntities(record, family)),
  ];
  // Known changes lead; outcomes whose starting value is unavailable follow.
  return [
    ...candidates.filter((fact) => fact.beforeRecorded),
    ...candidates.filter((fact) => !fact.beforeRecorded),
  ].slice(0, MAX_HEADLINES);
}

// A comparison needs a recorded final value. A missing starting value is
// reported as unavailable rather than as an unchanged or zero value.
function compareMilitiaValues(record: CanonicalResolutionRecord) {
  const before = readBeforeMilitia(record);
  const final = readFinalMilitia(record);
  return militiaValueFamilies.flatMap(
    ({ key, field, label, unit, schema }): FinishedWeekHeadlineFact[] => {
      const was = readRecordedValue(before?.[field], schema);
      const now = readRecordedValue(final?.[field], schema);
      if (!now.recorded || (was.recorded && was.value === now.value)) return [];
      return [
        {
          key,
          label,
          before: was.value,
          final: now.value,
          beforeRecorded: was.recorded,
          finalRecorded: true,
          unit,
        },
      ];
    },
  );
}

// Additions and removals compare against an absent entity (null). Both lists
// must be recorded; otherwise nothing is known about this family.
function compareEntities(
  record: CanonicalResolutionRecord,
  family: EntityFamily,
): FinishedWeekHeadlineFact[] {
  const before = family.entitySchema.safeParse(
    family.readEntities(family.readBefore(record)),
  );
  const final = family.entitySchema.safeParse(
    family.readEntities(family.readFinal(record)),
  );
  if (!before.success || !final.success) return [];
  const previousById = new Map(
    before.data.map((entity) => [entity.id, entity]),
  );
  const nextById = new Map(final.data.map((entity) => [entity.id, entity]));
  const ids = [...new Set([...previousById.keys(), ...nextById.keys()])];
  return ids.flatMap((id, index) => {
    const previous = previousById.get(id);
    const next = nextById.get(id);
    const beforeValue = previous?.value ?? null;
    const finalValue = next?.value ?? null;
    if (beforeValue === finalValue) return [];
    const name = (next?.name ?? previous?.name)?.trim() ?? '';
    return [
      {
        key: `${family.keyPrefix}:${id}`,
        label: name.length > 0 ? name : `${family.fallbackLabel} ${index + 1}`,
        before: beforeValue,
        final: finalValue,
        beforeRecorded: true,
        finalRecorded: true,
        unit: 'text' as const,
      },
    ];
  });
}

function readBeforeMilitia(
  record: CanonicalResolutionRecord,
): RecordedFacts | undefined {
  return record.sourceMilitiaSnapshot;
}

// The final outcome is a complete week state and takes precedence; plan-after
// is used only when the outcome holds no militia facts.
function readFinalMilitia(record: CanonicalResolutionRecord) {
  const planAfter = readRecordedFacts(
    readRecordedFacts(record.finalPlan.data)?.after,
  );
  return (
    readRecordedFacts(record.finalOutcome.data.militiaSnapshot) ??
    readRecordedFacts(planAfter?.militiaSnapshot)
  );
}

function readRecordedFacts(value: unknown): RecordedFacts | undefined {
  const parsed = recordedFactsSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function readRecordedValue(
  value: unknown,
  schema: z.ZodType<HeadlineValue>,
): RecordedValue {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { recorded: true, value: parsed.data }
    : { recorded: false, value: null };
}
