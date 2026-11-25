import { fireEvent, render, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import type {
  ResultRow,
  ReviewPhase,
  ReviewSection,
  WeekReviewFacts,
} from './review-facts';
import { WeekReviewSections } from './week-review';

function section(
  phase: ReviewPhase,
  number: ReviewSection['number'],
  title: string,
  overrides: Partial<ReviewSection> = {},
): ReviewSection {
  return {
    phase,
    number,
    title,
    chips: [],
    status: 'empty',
    statusText: `No ${title} consequences this week.`,
    items: [],
    ...overrides,
  };
}

function row(overrides: Partial<ResultRow> & { key: string }): ResultRow {
  return {
    group: 'Militia',
    label: overrides.key,
    now: { kind: 'value', text: '10', key: '10' },
    baseline: { kind: 'value', text: '10', key: '10' },
    final: { kind: 'value', text: '10', key: '10' },
    changed: false,
    finalDiffers: false,
    difference: null,
    ...overrides,
  };
}

const facts: WeekReviewFacts = {
  mode: 'live',
  sections: [
    section('upkeep', 1, 'Upkeep', {
      status: 'complete',
      statusText: null,
      chips: ['Training −13', 'Treasury +20 gp'],
      items: [
        {
          key: 'attrition',
          title: 'Training attrition',
          details: ['Loyalty 9 + 5 = 14 vs DC 15', 'failed'],
          effects: [{ key: 'training', text: 'Training −13' }],
          notes: [
            {
              kind: 'warning',
              key: 'range',
              message: 'Roll outside its range.',
            },
          ],
          missing: false,
        },
      ],
    }),
    section('activity', 2, 'Activity', {
      status: 'incomplete',
      statusText: 'Some decisions in this phase are still open.',
      items: [
        {
          key: 'slot-2',
          title: 'Slot 2 · Earn Gold',
          details: [],
          effects: [],
          notes: [
            {
              kind: 'exception',
              key: 'exception:smugglers',
              exceptionId: 'smugglers',
              subjectId: 'slot-2',
              ruleId: 'team-already-acted',
              rule: 'Team already acted',
              reason: 'The smugglers split up.',
              obsolete: false,
            },
          ],
          missing: false,
        },
        {
          key: 'missing:old',
          title: 'Slot 5 · Sabotage',
          details: [],
          effects: [],
          notes: [
            {
              kind: 'exception',
              key: 'exception:old',
              exceptionId: 'old',
              subjectId: 'slot-5',
              ruleId: 'action-capacity',
              rule: 'Action allowance',
              reason: 'Extra action during the ambush',
              obsolete: true,
            },
          ],
          missing: true,
        },
      ],
    }),
    section('event', 3, 'Event', {
      status: 'complete',
      statusText: null,
      items: [
        {
          key: 'ambush',
          title: 'Ambush',
          details: ['Security 9 + 5 = 14 vs DC 16', 'failed'],
          effects: [{ key: 'scouts', text: 'Hollow Scouts disabled' }],
          notes: [
            {
              kind: 'outcome',
              key: 'outcome:ambush',
              text: 'The Scouts fell back to Hollow Crossing.',
            },
          ],
          missing: false,
        },
      ],
    }),
    section('persistent', 4, 'Persistent', {
      status: 'not-applicable',
      statusText: 'No persistent events carry into this week.',
    }),
  ],
  unassociated: [],
  adjustments: [
    {
      key: 'adjustment:reward',
      adjustmentId: 'reward',
      number: 1,
      kind: 'Militia value',
      effect: 'Treasury +500 gp',
      reason: 'Reward for the Longshadow rescue',
      notes: [],
    },
  ],
  result: {
    nextWeek: 15,
    complete: true,
    rows: [
      row({
        key: 'training',
        label: 'Training',
        now: { kind: 'value', text: '132', key: '132' },
        baseline: { kind: 'value', text: '125', key: '125' },
        final: { kind: 'value', text: '125', key: '125' },
        changed: true,
      }),
      row({
        key: 'treasury',
        label: 'Treasury',
        now: { kind: 'value', text: '1240 gp', key: '1240' },
        baseline: { kind: 'value', text: '1245 gp', key: '1245' },
        final: { kind: 'value', text: '1745 gp', key: '1745' },
        changed: true,
        finalDiffers: true,
        difference:
          'Table Adjustments change the Rules Baseline 1245 gp to 1745 gp.',
      }),
      row({ key: 'notoriety', label: 'Notoriety' }),
    ],
  },
};

const region = (name: string) => screen.getByRole('region', { name });

test('the six sections render in rules order with their exact labels, expanded', () => {
  render(<WeekReviewSections facts={facts} />);
  expect(
    screen
      .getAllByRole('region')
      .map((node) => node.getAttribute('aria-label')),
  ).toEqual([
    '1 Upkeep',
    '2 Activity',
    '3 Event',
    '4 Persistent',
    'Table Adjustments',
    'Result',
  ]);
  expect(document.querySelector('details')).toBeNull();
  expect(
    screen
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent),
  ).toEqual([
    '1Upkeep',
    '2Activity',
    '3Event',
    '4Persistent',
    '5Table Adjustments',
    '6Result · week 15 begins',
  ]);
});

test('phase sections show chips, details, effect chips and every kind of note', () => {
  render(<WeekReviewSections facts={facts} />);
  const upkeep = within(region('1 Upkeep'));
  // The phase chip in the header and the item's effect chip.
  expect(upkeep.getAllByText('Training −13')).toHaveLength(2);
  expect(upkeep.getByText('Treasury +20 gp')).toBeVisible();
  expect(
    upkeep.getByText('· Loyalty 9 + 5 = 14 vs DC 15 · failed'),
  ).toBeVisible();
  expect(upkeep.getByText('Warning:')).toHaveClass('sr-only');
  expect(upkeep.getByText('Roll outside its range.')).toBeVisible();
  const activity = within(region('2 Activity'));
  expect(
    activity.getByText('Some decisions in this phase are still open.'),
  ).toBeVisible();
  expect(activity.getByText('Team already acted')).toBeVisible();
  expect(activity.getAllByText('Rules Exception')).toHaveLength(2);
  expect(activity.getByText('The smugglers split up.')).toBeVisible();
  expect(activity.getByText('No longer part of this week.')).toBeVisible();
  const event = within(region('3 Event'));
  expect(event.getByText('Hollow Scouts disabled')).toBeVisible();
  expect(event.getByText('Recorded outcome')).toBeVisible();
  expect(
    event.getByText('The Scouts fell back to Hollow Crossing.'),
  ).toBeVisible();
  expect(
    within(region('4 Persistent')).getByText(
      'No persistent events carry into this week.',
    ),
  ).toBeVisible();
});

test('an obsolete exception keeps its recorded reason and states that it cannot permit an extra action', () => {
  render(<WeekReviewSections facts={facts} />);
  const activity = within(region('2 Activity'));
  expect(activity.getByText('Extra action during the ambush')).toBeVisible();
  expect(
    activity.getByText(
      'This recorded exception cannot permit an extra action. Move the choice to an available slot, clear it, or restore the allowance.',
    ),
  ).toBeVisible();
});

test('a live exception without a reason and no editor reads as unrecorded', () => {
  const [upkeep, activity, ...rest] = facts.sections;
  const item = activity.items[0]!;
  const note = item.notes[0]!;
  if (note.kind !== 'exception') throw new Error('Expected an exception');
  render(
    <WeekReviewSections
      facts={{
        ...facts,
        sections: [
          upkeep,
          {
            ...activity,
            items: [{ ...item, notes: [{ ...note, reason: '' }] }],
          },
          rest[0],
          rest[1],
        ],
      }}
    />,
  );
  expect(screen.getByText('No reason recorded.')).toBeVisible();
});

test('capabilities render at their seams and unlinked facts keep their own section', () => {
  render(
    <WeekReviewSections
      facts={{
        ...facts,
        unassociated: [
          { kind: 'warning', key: 'stray', message: 'A stray warning.' },
        ],
      }}
      capabilities={{
        exception: (note) => <button>Edit {note.exceptionId}</button>,
        adjustment: (adjustment, index) => (
          <button>
            Move {adjustment.adjustmentId} {index}
          </button>
        ),
        addAdjustment: <button>Add adjustment</button>,
      }}
    />,
  );
  expect(screen.getByRole('button', { name: 'Edit smugglers' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Edit old' })).toBeVisible();
  // The editor owns the reason, so the renderer does not repeat it.
  expect(screen.queryByText('The smugglers split up.')).toBeNull();
  const adjustments = within(region('Table Adjustments'));
  expect(adjustments.getAllByRole('article')).toHaveLength(1);
  expect(
    adjustments.getByRole('article', { name: 'Adjustment 1' }),
  ).toBeVisible();
  expect(adjustments.getByText('Treasury +500 gp')).toBeVisible();
  expect(adjustments.getByText('Militia value')).toBeVisible();
  // The adjustment editor owns the reason too.
  expect(
    adjustments.queryByText('Reward for the Longshadow rescue'),
  ).toBeNull();
  expect(
    adjustments.getByRole('button', { name: 'Move reward 0' }),
  ).toBeVisible();
  expect(
    adjustments.getByRole('button', { name: 'Add adjustment' }),
  ).toBeVisible();
  const unlinked = within(region('Unlinked facts'));
  expect(
    unlinked.getByRole('heading', { name: 'Facts not linked to a phase' }),
  ).toBeVisible();
  expect(unlinked.getByText('A stray warning.')).toBeVisible();
});

test('a record with no capabilities is read-only and uses the record copy', () => {
  render(
    <WeekReviewSections
      facts={{ ...facts, mode: 'record', adjustments: [] }}
    />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Show all values' })).toBeVisible();
  expect(
    screen.getByRole('heading', { name: '6Result · week 15 began' }),
  ).toBeVisible();
  expect(screen.getAllByText('At confirmation').length).toBeGreaterThan(0);
  expect(screen.queryByText('Now')).toBeNull();
  expect(
    screen.getByText(
      'No Table Adjustments. The Final outcome equals the Rules Baseline.',
    ),
  ).toBeVisible();
  expect(
    screen.getByText('The smugglers split up.', { exact: false }),
  ).toBeVisible();
});

test('the live empty adjustments copy names the Final preview', () => {
  render(<WeekReviewSections facts={{ ...facts, adjustments: [] }} />);
  expect(
    screen.getByText(
      'No Table Adjustments. The Final preview equals the Rules Baseline.',
    ),
  ).toBeVisible();
});

test('the Result shows changed values by default and Show all values reveals the rest', () => {
  render(<WeekReviewSections facts={facts} />);
  const result = within(region('Result'));
  expect(result.getAllByText('Training').length).toBeGreaterThan(0);
  expect(result.queryByText('Notoriety')).toBeNull();
  const toggle = result.getByRole('button', { name: 'Show all values' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(toggle).toHaveTextContent('Show all values');
  expect(result.getAllByText('Notoriety').length).toBeGreaterThan(0);
  fireEvent.click(toggle);
  expect(result.queryByText('Notoriety')).toBeNull();
});

test('the Result table has the four column headers and a differing Final is described in text', () => {
  render(<WeekReviewSections facts={facts} />);
  const table = within(screen.getByRole('table'));
  expect(
    table.getAllByRole('columnheader').map((node) => node.textContent),
  ).toEqual(['Value', 'Now', 'Rules Baseline', 'Final']);
  const treasury = table.getByRole('row', { name: /Treasury/ });
  expect(
    within(treasury).getByText(
      'Table Adjustments change the Rules Baseline 1245 gp to 1745 gp.',
    ),
  ).toBeVisible();
  expect(within(treasury).getByText('1745 gp')).toHaveClass('font-semibold');
  const training = table.getByRole('row', { name: /Training/ });
  expect(within(training).getAllByText('125')[1]).not.toHaveClass(
    'font-semibold',
  );
  // The stacked phone list carries the same values and labels.
  const result = within(region('Result'));
  expect(result.getAllByRole('definition')).toHaveLength(6);
  expect(result.getAllByText('Rules Baseline')).toHaveLength(3);
});

test('an incomplete Result explains itself and never shows a Baseline or Final as a value', () => {
  render(
    <WeekReviewSections
      facts={{
        ...facts,
        result: {
          nextWeek: 15,
          complete: false,
          rows: [
            row({
              key: 'training',
              label: 'Training',
              now: { kind: 'value', text: '132', key: '132' },
              baseline: { kind: 'unavailable' },
              final: { kind: 'unavailable' },
              changed: true,
            }),
          ],
        },
      }}
    />,
  );
  const result = within(region('Result'));
  expect(
    result.getByText(
      'The Rules Baseline and Final are not available until every required decision is made.',
    ),
  ).toBeVisible();
  expect(result.getAllByText('Not available')).toHaveLength(4);
  expect(result.queryByText('No values change this week.')).toBeNull();
});

test('a complete Result with nothing changed says so', () => {
  render(
    <WeekReviewSections
      facts={{
        ...facts,
        result: { nextWeek: 15, complete: true, rows: [row({ key: 'rank' })] },
      }}
    />,
  );
  expect(screen.getByText('No values change this week.')).toBeVisible();
  expect(screen.queryByRole('table')).toBeNull();
});

test('the week-review renderer and its facts never import the workspace, the backend or a store', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(directory).filter(
    (file) => /\.tsx?$/.test(file) && !file.includes('.test.'),
  );
  expect(files).toContain('week-review.tsx');
  const pattern = /import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/g;
  for (const file of files) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    for (const match of source.matchAll(pattern)) {
      const typeOnly = match[1] !== undefined;
      const specifier = match[2]!;
      const allowed =
        specifier === 'react' ||
        specifier === 'lucide-react' ||
        specifier === '~/lib/utils' ||
        specifier.startsWith('~/components/ui/') ||
        specifier.startsWith('./') ||
        (typeOnly && specifier.startsWith('~/lib/'));
      expect(allowed, `${file} imports ${specifier}`).toBe(true);
      for (const forbidden of ['weekly-draft-workspace', 'convex', 'store'])
        expect(specifier, `${file} imports ${specifier}`).not.toContain(
          forbidden,
        );
      if (specifier.startsWith('~/lib/canonical'))
        expect(typeOnly, `${file} imports ${specifier} as a value`).toBe(true);
    }
  }
});
