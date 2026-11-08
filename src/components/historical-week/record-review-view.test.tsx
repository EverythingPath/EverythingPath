import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { confirmedWeek } from '../../../tests/history/resolution-record-fixtures';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import { WeekReviewSections } from '~/components/week-review/week-review';
import { recordWeekReview } from './record-review';

const region = (name: string) => screen.getByRole('region', { name });

test('[rules.HIST-05.frozen-view] a frozen record renders the six historical sections read-only, quoting its recorded words', () => {
  const { container } = render(
    <WeekReviewSections facts={recordWeekReview(confirmedWeek().record)} />,
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
    '5Table Adjustments',
    '6Result · week 3 began',
  ]);
  // Only the local Show all toggle; no edit, clear, reorder or Confirm.
  expect(
    screen.getAllByRole('button').map((button) => button.textContent),
  ).toEqual(['Show all values']);
  expect(container.querySelector('input, textarea, select')).toBeNull();
  const activity = within(region('2 Activity'));
  expect(
    activity.getByText(
      'The disabled rescuers can undertake this limited rescue mission.',
    ),
  ).toBeVisible();
  expect(activity.getByText('The officer returns home')).toBeVisible();
  expect(
    within(region('Table Adjustments')).getByText('The officer was rescued'),
  ).toBeVisible();
  const table = within(screen.getByRole('table'));
  expect(
    table.getAllByRole('columnheader').map((node) => node.textContent),
  ).toEqual(['Value', 'At confirmation', 'Rules Baseline', 'Final']);
});

test('[rules.HIST-05.frozen-view-unlinked] a record keeps a ruling whose subject it does not hold and facts linked to nothing in the week', () => {
  const record = structuredClone(confirmedWeek().record);
  const exception = {
    exceptionId: 'id-vanished',
    subjectId: 'id-deleted-choice',
    ruleId: 'action-capacity',
    reason: 'An extra day was allowed then',
  };
  const acknowledgement = {
    acknowledgementId: 'id-stray',
    subjectId: 'id-long-gone',
    outcome: 'A ruling from an earlier tool',
  };
  for (const facts of [record.source, record.adjudication]) {
    facts.rulesExceptions.push(exception);
    facts.acknowledgements.push(acknowledgement);
  }
  render(
    <WeekReviewSections
      facts={recordWeekReview(canonicalResolutionRecordSchema.parse(record))}
    />,
  );
  const activity = within(region('2 Activity'));
  expect(
    activity.getByText('Its subject is not part of this recorded week.'),
  ).toBeVisible();
  expect(activity.queryByText('No longer part of this week.')).toBeNull();
  expect(activity.getByText('An extra day was allowed then')).toBeVisible();
  expect(activity.queryByText(/cannot permit an extra action/)).toBeNull();
  const unlinked = within(region('Unlinked facts'));
  expect(
    unlinked.getByText('Table outcome: A ruling from an earlier tool'),
  ).toBeVisible();
});
