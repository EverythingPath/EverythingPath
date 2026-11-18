import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { weeklyDraftDataSchema } from '~/lib/weekly-draft-contract';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import {
  confirmedWeek,
  emptyPlanArtifacts,
  recordSnapshot,
} from '../../../tests/history/resolution-record-fixtures';
import { HistoricalRecordView } from './record-view';

const source = weeklyDraftDataSchema.parse(
  createWeeklyDraft({
    draftId: 'private-draft-id',
    week: 11,
    slotIds: ['private-slot'],
    context: {
      firstMilitiaWeek: false,
      startDay: 70,
      uneventfulCarry: true,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  }),
);
source.tableAdjustments = [
  {
    adjustmentId: 'private-adjustment',
    kind: 'militia_value',
    field: 'treasuryCopper',
    operation: 'add',
    value: 7,
    reason: 'Recovered copper',
  },
];
source.rulesExceptions = [
  {
    exceptionId: 'private-exception',
    ruleId: 'team-capacity',
    subjectId: 'private-slot',
    reason: 'Allies joined for this week',
  },
];
source.acknowledgements = [
  {
    acknowledgementId: 'private-ack',
    subjectId: 'private-slot',
    outcome: 'The road is clear',
  },
];
const { persistentPhaseEligible: _eligible, ...weekContext } = source.context;
const successorContext = { ...weekContext, startDay: 77 };
/** The week's militia at confirmation, and after it with `change` applied. */
function weekStates(
  change: (after: ReturnType<typeof recordSnapshot>) => void,
) {
  const militiaSnapshot = { ...recordSnapshot(), treasuryCopper: 75 };
  const after = structuredClone(militiaSnapshot);
  change(after);
  return {
    militiaSnapshot,
    before: { week: 11, militiaSnapshot, context: weekContext },
    after: { week: 12, militiaSnapshot: after, context: successorContext },
  };
}
const week = weekStates((after) => {
  after.treasuryCopper = 80;
});
const record: CanonicalResolutionRecord = {
  recordId: 'private-record',
  source,
  sourceMilitiaSnapshot: week.militiaSnapshot,
  rulesetVersion: 3,
  provenance: 'confirmation',
  ...emptyPlanArtifacts({
    before: week.before,
    baseline: week.after,
    final: {
      ...week.after,
      militiaSnapshot: { ...week.after.militiaSnapshot, treasuryCopper: 87 },
    },
  }),
  warnings: [{ code: 'team-capacity', message: 'team-capacity' }],
  adjudication: {
    tableAdjustments: source.tableAdjustments,
    rulesExceptions: source.rulesExceptions,
    acknowledgements: source.acknowledgements,
  },
  successorContext,
  supersedesRecordId: null,
};

const region = (name: string) => within(screen.getByRole('region', { name }));
/** The Result's table row for one "Group · Label" fact, as its cell texts. */
function resultRow(label: string) {
  const row = region('Result')
    .getAllByRole('row')
    .find((entry) => entry.textContent?.includes(label));
  if (!row) throw new Error(`No ${label} row`);
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}
const showAll = () =>
  fireEvent.click(
    region('Result').getByRole('button', { name: 'Show all values' }),
  );

test('[rules.P86.display] historical display uses recorded plans, context and table decisions with no editable controls', () => {
  const { container, rerender } = render(
    <HistoricalRecordView record={record} />,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual([
    '1Upkeep',
    '2Activity',
    '3Event',
    '4Persistent',
    'Facts not linked to a phase',
    '5Table Adjustments',
    '6Result · week 12 began',
  ]);
  // The recorded militia at confirmation, Rules Baseline and Final,
  // copper-exact.
  expect(resultRow('Militia · Treasury')).toEqual([
    expect.stringContaining('Treasury'),
    '0.75 gp',
    '0.8 gp',
    '0.87 gp',
  ]);
  expect(
    region('Result').getAllByText(
      'Table Adjustments change the Rules Baseline 0.8 gp to 0.87 gp.',
    ).length,
  ).toBeGreaterThan(0);
  const adjustment = within(
    region('Table Adjustments').getByRole('article', { name: 'Adjustment 1' }),
  );
  expect(adjustment.getByText('Treasury +0.07 gp')).toBeVisible();
  expect(adjustment.getByText('Recovered copper')).toBeVisible();
  // Facts whose subject this record cannot place stay readable, unlinked.
  const unlinked = region('Unlinked facts');
  expect(unlinked.getByText('Allies joined for this week')).toBeVisible();
  expect(unlinked.getByText('Table outcome: The road is clear')).toBeVisible();
  expect(
    unlinked.getByText(
      'Recruitment leaves the roster above the team allowance after this week’s actions.',
    ),
  ).toBeVisible();
  // Show all reveals the recorded next-week context.
  showAll();
  expect(resultRow('Next week · Start day')).toEqual([
    expect.stringContaining('Start day'),
    '70',
    '77',
    '77',
  ]);
  expect(resultRow('Next week · Uneventful-week benefit')).toEqual([
    expect.stringContaining('Uneventful-week benefit'),
    'Yes',
    'Yes',
    'Yes',
  ]);
  expect(container.textContent).not.toContain('private-');
  expect(container.textContent).not.toContain('treasuryCopper');
  expect(container.querySelector('input, textarea, select')).toBeNull();
  expect(
    screen.getAllByRole('button').map((button) => button.textContent),
  ).toEqual(['Show all values']);
  // Another immutable record shows only its own facts.
  rerender(
    <HistoricalRecordView
      record={{
        ...record,
        recordId: 'correction',
        provenance: 'historical_correction',
        supersedesRecordId: record.recordId,
        ...emptyPlanArtifacts({
          before: week.before,
          baseline: weekStates((after) => {
            after.training = 10;
          }).after,
          final: weekStates((after) => {
            after.training = 12;
          }).after,
        }),
        adjudication: {
          ...record.adjudication,
          tableAdjustments: [
            {
              adjustmentId: 'private-training',
              kind: 'militia_value',
              field: 'training',
              operation: 'add',
              value: 2,
              reason: 'Drilled after the week',
            },
          ],
        },
      }}
    />,
  );
  expect(resultRow('Militia · Training')).toEqual([
    expect.stringContaining('Training'),
    '30',
    '10',
    '12',
  ]);
  expect(region('Result').queryByText('0.87 gp')).toBeNull();
  expect(
    region('Table Adjustments').queryByText('Recovered copper'),
  ).toBeNull();
  expect(
    region('Table Adjustments').getByText('Drilled after the week'),
  ).toBeVisible();
});

test('[rules.P86.labels] historical references remain distinguishable without exposing IDs or renaming rules and table notes', () => {
  const annotated: CanonicalResolutionRecord = {
    ...record,
    source: {
      ...record.source,
      activity: {
        ...record.source.activity,
        consumableIds: ['opaque-bonus-first', 'opaque-bonus-second'],
        slots: [
          {
            slotId: 'private-slot',
            choice: { choiceId: 'a', actionId: 'earn_gold' },
          },
        ],
      },
    },
    ...emptyPlanArtifacts({
      before: week.before,
      baseline: week.after,
      final: {
        ...week.after,
        context: {
          ...successorContext,
          operatedSettlementIds: ['opaque-settlement'],
        },
      },
    }),
    warnings: [{ code: 'team-used', message: 'team-used' }],
  };
  const { container } = render(<HistoricalRecordView record={annotated} />);
  showAll();
  expect(container.textContent).not.toContain('opaque-');
  expect(container.textContent).not.toContain('private-');
  expect(container.textContent).not.toContain('treasuryCopper');
  expect(
    region('2 Activity').getByText('Slot 1 · Earn Gold', { exact: false }),
  ).toBeVisible();
  expect(
    region('Unlinked facts').getByText(
      'This team has already acted this Activity.',
    ),
  ).toBeVisible();
  // A recorded settlement reads by its record-local label.
  expect(resultRow('Next week · Operating from').at(-1)).toBe('Settlement 1');
});

test('[rules.HIST-05.view-record-only] the history view has only the selected record as input and no live, backend or rules dependency', () => {
  const { record: confirmed } = confirmedWeek();
  const { container } = render(<HistoricalRecordView record={confirmed} />);
  expect(region('Result').getAllByText('Character 1').length).toBeGreaterThan(
    0,
  );
  expect(container.textContent).not.toMatch(/Aubrin|Kasvarina/);
  const file = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'record-view.tsx'),
    'utf8',
  );
  const specifiers = [
    ...file.matchAll(/import\s+(?:type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
  expect(specifiers.sort()).toEqual([
    './record-review',
    'react',
    '~/components/week-review/week-review',
    '~/lib/canonical-resolution-record',
  ]);
});
