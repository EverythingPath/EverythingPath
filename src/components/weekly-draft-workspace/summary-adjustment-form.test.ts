import { expect, test } from 'vitest';
import { moveAdjustmentById } from './adjustment-order';
import {
  adjustmentChoices,
  adjustmentFormSchema,
  adjustmentFormValues,
  appendAdjustment,
  removeAdjustment,
  replaceAdjustment,
  type AdjustmentFormValues,
  type AdjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';

const targets: AdjustmentTargets = {
  teams: [{ value: 'scouts', label: 'Scouts' }],
  settlements: [{ value: 'phaendar', label: 'Phaendar' }],
  events: [
    { value: 'theft-1', label: 'Theft · Event 1' },
    { value: 'theft-2', label: 'Theft · Event 2' },
  ],
};

function parse(values: Partial<AdjustmentFormValues>) {
  const initial = {
    ...adjustmentFormValues({ kind: values.kind ?? 'militia_value' }),
    ...values,
  };
  const result = adjustmentFormSchema(
    adjustmentChoices(targets, initial),
    'new',
  ).safeParse(initial);
  // The identity is the caller's; compare the rest.
  if (!result.success) return { ...result, data: undefined };
  expect(result.data.adjustmentId).toBe('new');
  const { adjustmentId: _identity, ...data } = result.data;
  return { ...result, data };
}
function errors(values: Partial<AdjustmentFormValues>) {
  const result = parse(values);
  expect(result.success).toBe(false);
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [
      issue.path.join('.'),
      issue.message,
    ]),
  );
}

test('[rules.P85.adjustment-money] a treasury adjustment converts exact signed gp to copper; other values stay signed whole numbers', () => {
  expect(
    parse({ value: '-0.07', reason: ' Seven copper for supplies ' }).data,
  ).toEqual({
    kind: 'militia_value',
    field: 'treasuryCopper',
    operation: 'add',
    value: -7,
    reason: 'Seven copper for supplies',
  });
  expect(
    parse({ operation: 'set', value: '500', reason: 'Table sets it' }).data,
  ).toMatchObject({ operation: 'set', value: 50000 });
  expect(
    parse({ field: 'training', value: '-4', reason: 'Lost drills' }).data,
  ).toMatchObject({ field: 'training', value: -4 });
  // Zero is a real value, including a negative-signed zero.
  expect(parse({ field: 'rank', value: '-0', reason: 'Reset' }).data).toEqual(
    expect.objectContaining({ field: 'rank', value: 0 }),
  );
  const zero = parse({ field: 'rank', value: '-0', reason: 'x' }).data;
  expect(zero && 'value' in zero && Object.is(zero.value, -0)).toBe(false);
});

test('[rules.P85.adjustment-validation] missing and malformed values have their own field errors and are never coerced', () => {
  expect(errors({ value: '', reason: '' })).toEqual({
    value: 'An amount in gp is required.',
    reason: 'A reason is required.',
  });
  expect(errors({ value: '1.005', reason: 'x' })).toEqual({
    value: 'Use at most two decimal places (1 cp = 0.01 gp).',
  });
  expect(errors({ value: '-', reason: 'x' })).toMatchObject({
    value: expect.stringContaining('Enter an amount in gp'),
  });
  expect(errors({ field: 'notoriety', value: '', reason: 'x' })).toEqual({
    value: 'A value is required.',
  });
  expect(errors({ field: 'notoriety', value: '2.5', reason: 'x' })).toEqual({
    value: 'Enter a whole number, such as 3 or -2.',
  });
  expect(
    errors({ field: 'training', value: '99999999999999999', reason: 'x' }),
  ).toEqual({ value: 'Enter a smaller number.' });
  expect(errors({ value: '3', reason: '   ' })).toEqual({
    reason: 'A reason is required.',
  });
});

test('[rules.P85.adjustment-kinds] every kind requires its own choices and refuses a target the week no longer offers', () => {
  expect(errors({ kind: 'team_status', reason: 'x' })).toEqual({
    teamId: 'Choose a team.',
    status: 'Choose a condition.',
  });
  expect(
    errors({
      kind: 'team_status',
      teamId: 'gone',
      status: 'disabled',
      reason: 'x',
    }),
  ).toEqual({
    teamId: 'This team is no longer part of the week. Choose another team.',
  });
  expect(
    parse({
      kind: 'team_status',
      teamId: 'scouts',
      status: 'missing',
      reason: 'Lost',
    }).data,
  ).toEqual({
    kind: 'team_status',
    teamId: 'scouts',
    status: 'missing',
    reason: 'Lost',
  });
  expect(errors({ kind: 'settlement_reputation', reason: 'x' })).toEqual({
    settlementId: 'Choose a settlement.',
    reputation: 'Choose a reputation.',
  });
  expect(
    parse({
      kind: 'settlement_reputation',
      settlementId: 'phaendar',
      reputation: 'Helpful',
      reason: 'Saved the mayor',
    }).data,
  ).toMatchObject({ settlementId: 'phaendar', reputation: 'Helpful' });
  expect(errors({ kind: 'event_end', eventId: 'ended', reason: 'x' })).toEqual({
    eventId:
      'This event no longer carries into next week. Choose another event or remove this adjustment.',
  });
  // Duplicate event types remain separate instances.
  expect(
    parse({ kind: 'event_end', eventId: 'theft-2', reason: 'Gone' }).data,
  ).toEqual({ kind: 'event_end', eventId: 'theft-2', reason: 'Gone' });
});

test('team conditions offer the three rules conditions, keeping a recorded legacy one', () => {
  const offered = (status: string) =>
    adjustmentChoices(targets, {
      ...adjustmentFormValues({ kind: 'team_status' }),
      status,
    }).conditions.map((choice) => choice.value);
  expect(offered('')).toEqual(['active', 'disabled', 'missing']);
  expect(offered('blocked')).toEqual([
    'active',
    'disabled',
    'missing',
    'blocked',
  ]);
});

test('saved adjustments round-trip through the raw form values unchanged', () => {
  const saved: TableAdjustment[] = [
    {
      kind: 'militia_value',
      adjustmentId: 'money',
      field: 'treasuryCopper',
      operation: 'add',
      value: -1205,
      reason: 'Fine',
    },
    {
      kind: 'militia_value',
      adjustmentId: 'rank',
      field: 'rank',
      operation: 'set',
      value: 0,
      reason: 'Demoted',
    },
    {
      kind: 'team_status',
      adjustmentId: 'team',
      teamId: 'scouts',
      status: 'active',
      reason: 'Back',
    },
    {
      kind: 'settlement_reputation',
      adjustmentId: 'town',
      settlementId: 'phaendar',
      reputation: 'Hostile',
      reason: 'Insulted',
    },
    {
      kind: 'event_end',
      adjustmentId: 'end',
      eventId: 'theft-1',
      reason: 'Over',
    },
  ];
  for (const adjustment of saved) {
    const values = adjustmentFormValues(adjustment);
    expect(values.value).not.toBe('NaN');
    expect(
      adjustmentFormSchema(
        adjustmentChoices(targets, values),
        adjustment.adjustmentId,
      ).parse(values),
    ).toEqual(adjustment);
  }
  expect(adjustmentFormValues(saved[0]!).value).toBe('-12.05');
});

const list: TableAdjustment[] = ['a', 'b', 'c'].map((adjustmentId) => ({
  kind: 'event_end',
  adjustmentId,
  eventId: 'theft-1',
  reason: `Reason ${adjustmentId}`,
}));

test('[rules.P85.order-identity] each Save sends the full latest list, changing only its own adjustment by identity', () => {
  const edited = { ...list[1]!, reason: 'Edited' };
  expect(replaceAdjustment(list, edited)).toEqual([list[0], edited, list[2]]);
  // Another player removed it meanwhile: nothing to replace, nothing re-added.
  expect(replaceAdjustment([list[0]!, list[2]!], edited)).toBeNull();
  const added = { ...list[0]!, adjustmentId: 'd' };
  expect(appendAdjustment(list, added)).toEqual([...list, added]);
  // A repeated Save of the same new adjustment adds it once.
  expect(appendAdjustment([...list, added], added)).toEqual([...list, added]);
  expect(removeAdjustment(list, 'b')).toEqual([list[0], list[2]]);
  expect(moveAdjustmentById(list, 'c', -1)).toEqual([
    list[0],
    list[2],
    list[1],
  ]);
  expect(moveAdjustmentById(list, 'a', -1)).toBeNull();
  expect(moveAdjustmentById(list, 'c', 1)).toBeNull();
  expect(moveAdjustmentById(list, 'gone', 1)).toBeNull();
});
