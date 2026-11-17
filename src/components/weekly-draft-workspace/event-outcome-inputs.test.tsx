import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { resourceEventFixture } from '../../../tests/rules/resource-event-fixture';
import { eventView, type EventPreparationContext } from './event-facts';
import { EventView } from './event-view';

function view(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Wren Ashby' }],
  });
  return eventView(
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
    context,
  );
}
const lastOccurrence = (edit: ReturnType<typeof vi.fn>) =>
  edit.mock.lastCall![0].occurrence;
function morale() {
  const { draft, snapshot } = resourceEventFixture(26);
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'later',
        eventType: 'theft',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
      {
        eventId: 'older',
        eventType: 'theft',
        startedWeek: 38,
        order: 0,
        targets: [],
      },
    ],
  };
  return { draft, snapshot };
}

test('[EVT-07.high-morale-view] High Morale picks its ended carried event on cards and returns to the oldest', () => {
  const { draft, snapshot } = morale();
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const block = screen.getByRole('group', { name: 'Event 1' });
  const endings = within(block).getByRole('group', {
    name: 'Persistent event that ends',
  });
  // Two Thefts: their weeks tell them apart, and the oldest ends by default.
  const older = within(endings).getByRole('button', {
    name: 'Theft · Since week 38 · 1st that week',
  });
  const later = within(endings).getByRole('button', {
    name: 'Theft · Since week 39 · 1st that week',
  });
  expect(older).toHaveAttribute('aria-pressed', 'true');
  expect(later).toHaveAttribute('aria-pressed', 'false');
  expect(
    within(endings).getByText(
      'The oldest carried event ends unless you choose another.',
    ),
  ).toBeVisible();
  const outcomes = within(block).getByRole('list', {
    name: 'Event 1 outcomes',
  });
  expect(
    within(outcomes)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual([
    '›Theft (since week 38) ends now.',
    `›Next week (week ${draft.week + 1}): Loyalty checks +2.`,
  ]);
  // What happened is offered, never required.
  expect(within(block).getByText('optional')).toBeVisible();

  fireEvent.click(later);
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'event', eventId: 'later' },
  ]);
  draft.event.occurrences[0]!.targets = [{ kind: 'event', eventId: 'later' }];
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.click(
    // Named for its own event block, so two High Morales never share a name.
    within(block).getByRole('button', {
      name: 'End the oldest instead for Event 1',
    }),
  );
  expect(lastOccurrence(edit)).not.toHaveProperty('targets');
});

test('[EVT-07.high-morale-retained] a recorded ending no longer carried is named, required and clearable', () => {
  const { draft, snapshot } = morale();
  draft.event.occurrences[0]!.targets = [
    { kind: 'event', eventId: 'gone' },
    { kind: 'team', teamId: 'team' },
  ];
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const block = screen.getByRole('group', { name: 'Event 1' });
  const endings = within(block).getByRole('group', {
    name: /^Persistent event that ends/,
  });
  expect(within(endings).getByText('required')).toBeVisible();
  expect(
    within(endings).getByText(
      'A carried event no longer recorded: It is no longer current when this event resolves. Clear it.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(
    within(endings).getByRole('button', {
      name: 'Clear A carried event no longer recorded from Persistent event that ends',
    }),
  );
  // The unused team target stays until its own clear.
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'team', teamId: 'team' },
  ]);
  fireEvent.click(
    within(block).getByRole('button', { name: 'Clear Targets from Event 1' }),
  );
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'event', eventId: 'gone' },
  ]);
});

test('[EVT-07.invasion-view] Invasion enters its party level, keeps zero apart from clear and requires What happened', async () => {
  const { draft, snapshot } = resourceEventFixture(82);
  draft.acknowledgements = [];
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const block = screen.getByRole('group', { name: 'Event 1' });
  // The general details editor stays folded away below the panel.
  const [level] = within(block)
    .getAllByRole('textbox', { name: 'Average Party Level' })
    .filter((field) => !field.closest('details'));
  expect(
    within(block).getByText(
      'So far. More follows once the inputs above are in.',
    ),
  ).toBeVisible();
  expect(within(block).getByText('required')).toBeVisible();
  fireEvent.change(level!, { target: { value: 'x' } });
  expect(edit).not.toHaveBeenCalled();
  expect(await within(block).findByText('Use digits only.')).toBeVisible();
  fireEvent.change(level!, { target: { value: '0' } });
  expect(lastOccurrence(edit).averagePartyLevel).toBe(0);
  fireEvent.change(level!, { target: { value: '' } });
  expect(lastOccurrence(edit)).not.toHaveProperty('averagePartyLevel');

  draft.event.occurrences[0]!.averagePartyLevel = 8;
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  expect(within(block).getByText('9')).toBeVisible();
  fireEvent.change(
    within(block).getByRole('textbox', { name: 'What happened' }),
    { target: { value: 'The table drove the invaders off.' } },
  );
  fireEvent.click(
    within(block).getByRole('button', { name: 'Save what happened' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'event:event',
        subjectId: 'event:event',
        outcome: 'The table drove the invaders off.',
      },
    }),
  );
});

test('[EVT-09.calm-view] All Is Calm and the Weeks show outcome lines only, and a prepared blank sends nothing', () => {
  const { draft, snapshot } = resourceEventFixture(46);
  draft.acknowledgements = [];
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  let block = screen.getByRole('group', { name: 'Event 1' });
  expect(
    within(block).queryByRole('textbox', { name: 'What happened' }),
  ).not.toBeInTheDocument();
  const lines = () =>
    within(within(block).getByRole('list', { name: 'Event 1 outcomes' }))
      .getAllByRole('listitem')
      .map((line) => line.textContent);
  expect(lines()).toEqual(['›No event this week.']);
  expect(
    within(block).getByText(
      `Uneventful: next week’s event chance rises by ${snapshot.rank}.`,
    ),
  ).toBeVisible();

  const pain = resourceEventFixture(100);
  pain.draft.acknowledgements = [];
  rerender(
    <EventView
      view={view(pain.draft, pain.snapshot)}
      edit={edit}
      disabled={false}
    />,
  );
  block = screen.getByRole('group', { name: 'Event 1' });
  expect(lines()).toEqual([
    `›Next week (week ${pain.draft.week + 1}): all organization checks −1.`,
    `›Next week (week ${pain.draft.week + 1}): Upkeep training loss is doubled.`,
  ]);
  expect(
    within(block).queryByRole('textbox', { name: 'What happened' }),
  ).not.toBeInTheDocument();

  // Until the draft holds the occurrence, it asks for nothing and waits.
  rerender(
    <EventView
      view={view(pain.draft, pain.snapshot, {
        acceptedEventIds: new Set(),
        preparationFailed: false,
      })}
      edit={edit}
      disabled={false}
    />,
  );
  block = screen.getByRole('group', { name: 'Event 1' });
  expect(
    within(block).getByRole('textbox', { name: 'Event 1 table roll' }),
  ).toBeDisabled();
  expect(
    within(block).queryByRole('list', { name: 'Event 1 outcomes' }),
  ).not.toBeInTheDocument();
  expect(edit).not.toHaveBeenCalled();
});
