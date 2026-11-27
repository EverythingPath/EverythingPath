import { z } from 'zod';
import { parseSignedGpInput, signedCopperToGpInput } from '~/lib/gp-money';
import { REPUTATION_LEVELS } from '~/lib/militia-domain';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { tableAdjustmentSchema } from '~/lib/weekly-draft-facts';
import type { PhaseView } from './types';

// The Table Adjustment form's pure half: raw text values, their field-level
// validation into the strict saved shape, the Review-owned choices and the
// full ordered list each Save sends. The form holds raw text, so a blank or
// malformed value stays in its field with an error and is never coerced.

type Summary = Extract<PhaseView, { phase: 'summary' }>;
export type TableAdjustment = WeeklyDraft['tableAdjustments'][number];
export type AdjustmentKind = TableAdjustment['kind'];
type MilitiaField = Extract<
  TableAdjustment,
  { kind: 'militia_value' }
>['field'];
export type Choice = { value: string; label: string; description?: string };

export const adjustmentKinds: (Choice & { value: AdjustmentKind })[] = [
  {
    value: 'militia_value',
    label: 'Militia value',
    description: 'Training, treasury, notoriety or rank',
  },
  {
    value: 'team_status',
    label: 'Team condition',
    description: 'Active, disabled or missing',
  },
  {
    value: 'settlement_reputation',
    label: 'Settlement reputation',
    description: `${REPUTATION_LEVELS[0]} to ${REPUTATION_LEVELS.at(-1)}`,
  },
  {
    value: 'event_end',
    label: 'End persistent event',
    description: 'Stops a carried event',
  },
];
/** The readable name of an adjustment kind, e.g. "Team condition". */
export function kindLabel(kind: AdjustmentKind) {
  return adjustmentKinds.find((item) => item.value === kind)?.label ?? kind;
}
export const militiaFields: (Choice & { value: MilitiaField })[] = [
  { value: 'training', label: 'Training' },
  { value: 'treasuryCopper', label: 'Treasury' },
  { value: 'notoriety', label: 'Notoriety' },
  { value: 'rank', label: 'Rank' },
];
export const operations: Choice[] = [
  { value: 'add', label: 'Add' },
  { value: 'set', label: 'Set to' },
];
// The rules know three team conditions. The shared enum also admits a
// legacy `blocked`, which is offered only to keep an adjustment that already
// records it.
const conditions = ['active', 'disabled', 'missing'] as const;
const capitalized = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
export const reputations: Choice[] = REPUTATION_LEVELS.map((value) => ({
  value,
  label: value,
}));

/** Every field of every kind as raw text; unused fields stay empty. */
export type AdjustmentFormValues = {
  kind: AdjustmentKind;
  field: MilitiaField;
  operation: 'add' | 'set';
  /** Signed whole number, or signed gp for Treasury. */
  value: string;
  teamId: string;
  status: string;
  settlementId: string;
  reputation: string;
  eventId: string;
  reason: string;
};
/** The teams, settlements and carried events this week's form may target. */
export type AdjustmentTargets = {
  teams: Choice[];
  settlements: Choice[];
  events: Choice[];
};

export function adjustmentTargets(view: Summary): AdjustmentTargets {
  // Ending an event removes it from the week's carried events after the
  // Rules Baseline, so both states name the events an adjustment may end.
  const states = [view.baseline, view.outcome].filter(
    (state) => state !== null,
  );
  const carried = new Set(
    states.flatMap((state) =>
      state.context.carriedEvents.map((event) => event.eventId),
    ),
  );
  const events = view.options.eventId ?? [];
  return {
    teams: view.options.teamId ?? [],
    settlements: view.options.settlementId ?? [],
    events: states.length
      ? events.filter((event) => carried.has(event.value))
      : events,
  };
}

/** The choices of each field, keeping a value the adjustment already holds. */
export function adjustmentChoices(
  targets: AdjustmentTargets,
  initial: AdjustmentFormValues,
) {
  return {
    kinds: adjustmentKinds,
    fields: militiaFields,
    operations,
    teams: targets.teams,
    conditions: [
      ...conditions,
      ...(initial.status === 'blocked' ? ['blocked'] : []),
    ].map((value) => ({ value, label: capitalized(value) })),
    settlements: targets.settlements,
    reputations,
    events: targets.events,
  };
}
export type AdjustmentChoices = ReturnType<typeof adjustmentChoices>;

const blank: Omit<AdjustmentFormValues, 'kind'> = {
  field: 'treasuryCopper',
  operation: 'add',
  value: '',
  teamId: '',
  status: '',
  settlementId: '',
  reputation: '',
  eventId: '',
  reason: '',
};

/** Raw values of a saved adjustment, or the empty form of a new one. */
export function adjustmentFormValues(
  adjustment: TableAdjustment | { kind: AdjustmentKind },
): AdjustmentFormValues {
  if (!('adjustmentId' in adjustment))
    return { ...blank, kind: adjustment.kind };
  const values = { ...blank, kind: adjustment.kind, reason: adjustment.reason };
  switch (adjustment.kind) {
    case 'militia_value':
      return {
        ...values,
        field: adjustment.field,
        operation: adjustment.operation,
        value:
          adjustment.field === 'treasuryCopper'
            ? signedCopperToGpInput(adjustment.value)
            : String(adjustment.value),
      };
    case 'team_status':
      return {
        ...values,
        teamId: adjustment.teamId,
        status: adjustment.status,
      };
    case 'settlement_reputation':
      return {
        ...values,
        settlementId: adjustment.settlementId,
        reputation: adjustment.reputation,
      };
    case 'event_end':
      return { ...values, eventId: adjustment.eventId };
  }
}

function signedWhole(text: string) {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' } as const;
  if (!/^[-−+]?\d+$/.test(trimmed))
    return {
      kind: 'invalid',
      message: 'Enter a whole number, such as 3 or -2.',
    } as const;
  const value = Number(trimmed.replace('−', '-'));
  if (!Number.isSafeInteger(value))
    return { kind: 'invalid', message: 'Enter a smaller number.' } as const;
  return { kind: 'valid', value: value === 0 ? 0 : value } as const;
}

/** The raw form values: every field of every kind as text. */
export const adjustmentFormValuesSchema = z.object({
  kind: z.enum([
    'militia_value',
    'team_status',
    'settlement_reputation',
    'event_end',
  ]),
  field: z.enum(['training', 'treasuryCopper', 'notoriety', 'rank']),
  operation: z.enum(['add', 'set']),
  value: z.string(),
  teamId: z.string(),
  status: z.string(),
  settlementId: z.string(),
  reputation: z.string(),
  eventId: z.string(),
  reason: z.string(),
});

type Issue = (path: keyof AdjustmentFormValues, message: string) => void;

function militiaValue(values: AdjustmentFormValues, issue: Issue) {
  const isMoney = values.field === 'treasuryCopper';
  const parsed = isMoney
    ? parseSignedGpInput(values.value)
    : signedWhole(values.value);
  if (parsed.kind === 'empty')
    issue(
      'value',
      isMoney ? 'An amount in gp is required.' : 'A value is required.',
    );
  if (parsed.kind === 'invalid') issue('value', parsed.message);
  const value =
    parsed.kind !== 'valid'
      ? undefined
      : 'copper' in parsed
        ? parsed.copper
        : parsed.value;
  return { field: values.field, operation: values.operation, value };
}

/** A chosen value the week still offers; missing and vanished differ. */
function target(
  values: AdjustmentFormValues,
  issue: Issue,
  path: keyof AdjustmentFormValues,
  choices: Choice[],
  missing: string,
  gone = missing,
) {
  const value = values[path];
  if (!value) issue(path, missing);
  else if (!choices.some((choice) => choice.value === value)) issue(path, gone);
  return value;
}

// The kind-specific fields of each discriminant, from raw values.
const kindFields: Record<
  AdjustmentKind,
  (
    values: AdjustmentFormValues,
    choices: AdjustmentChoices,
    issue: Issue,
  ) => Record<string, unknown>
> = {
  militia_value: (values, _choices, issue) => militiaValue(values, issue),
  team_status: (values, choices, issue) => ({
    teamId: target(
      values,
      issue,
      'teamId',
      choices.teams,
      'Choose a team.',
      'This team is no longer part of the week. Choose another team.',
    ),
    status: target(
      values,
      issue,
      'status',
      choices.conditions,
      'Choose a condition.',
    ),
  }),
  settlement_reputation: (values, choices, issue) => ({
    settlementId: target(
      values,
      issue,
      'settlementId',
      choices.settlements,
      'Choose a settlement.',
      'This settlement is no longer part of the week. Choose another settlement.',
    ),
    reputation: target(
      values,
      issue,
      'reputation',
      choices.reputations,
      'Choose a reputation.',
    ),
  }),
  event_end: (values, choices, issue) => ({
    eventId: target(
      values,
      issue,
      'eventId',
      choices.events,
      'Choose an event.',
      'This event no longer carries into next week. Choose another event or remove this adjustment.',
    ),
  }),
};

/**
 * Raw values → the strict saved adjustment with this identity, with an
 * error on each field that is missing (its own message) or malformed. A
 * target must be one this week still offers; a vanished team, settlement or
 * event is an error, not a payload the server would reject.
 */
export function adjustmentFormSchema(
  choices: AdjustmentChoices,
  adjustmentId: string,
) {
  return adjustmentFormValuesSchema.transform(
    (values, context): TableAdjustment => {
      let hasIssue = false;
      const issue: Issue = (path, message) => {
        hasIssue = true;
        context.addIssue({ code: 'custom', path: [path], message });
      };
      const reason = values.reason.trim();
      if (!reason) issue('reason', 'A reason is required.');
      const fields = kindFields[values.kind](values, choices, issue);
      if (hasIssue) return z.NEVER;
      const parsed = tableAdjustmentSchema.safeParse({
        kind: values.kind,
        adjustmentId,
        ...fields,
        reason,
      });
      if (parsed.success) return parsed.data;
      issue('kind', 'This adjustment cannot be saved as entered.');
      return z.NEVER;
    },
  );
}

// The full ordered list a Save sends is always built from the latest list
// this device knows (accepted plus its own pending edits), never from the
// list captured when a form opened, so another player's accepted change to a
// different adjustment is kept.

/** The latest list with one adjustment replaced; null when it has gone. */
export function replaceAdjustment(
  latest: readonly TableAdjustment[],
  adjustment: TableAdjustment,
) {
  if (!latest.some((item) => item.adjustmentId === adjustment.adjustmentId))
    return null;
  return latest.map((item) =>
    item.adjustmentId === adjustment.adjustmentId ? adjustment : item,
  );
}

/** The latest list with a new adjustment last (once, by identity). */
export function appendAdjustment(
  latest: readonly TableAdjustment[],
  adjustment: TableAdjustment,
) {
  return [
    ...latest.filter((item) => item.adjustmentId !== adjustment.adjustmentId),
    adjustment,
  ];
}

export function removeAdjustment(
  latest: readonly TableAdjustment[],
  adjustmentId: string,
) {
  return latest.filter((item) => item.adjustmentId !== adjustmentId);
}
