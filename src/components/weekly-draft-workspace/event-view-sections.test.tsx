import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import {
  eventSelectionFixture,
  occurrence,
} from '../../../tests/rules/event-selection-fixture';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView, type EventPreparationContext } from './event-facts';
import { EventView } from './event-view';
import { eventOccurrenceAnchor } from './source-anchors';

function facts(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  return eventView(
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
    context,
  );
}
const group = (name: string) => screen.getByRole('group', { name });

test('[EVT-13.view] a first Roll Twice nests two blank child positions; manual tree controls are gone', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [
    occurrence('root', 50),
    { eventId: 'a', origin: { kind: 'roll_twice', parentEventId: 'root' } },
    { eventId: 'b', origin: { kind: 'roll_twice', parentEventId: 'root' } },
  ];
  render(
    <EventView view={facts(draft, snapshot)} edit={vi.fn()} disabled={false} />,
  );
  const root = group('Event 1');
  expect(within(root).getByText('Two more')).toBeVisible();
  // Corpus rules text sits collapsed under its block.
  expect(within(root).getAllByText('Rules: Roll Twice')[0]).toBeVisible();
  expect(
    within(root).getByText(
      'Roll Twice can only take effect once per Event phase.',
    ),
  ).toBeInTheDocument();
  for (const name of ['Event 1.1', 'Event 1.2']) {
    const child = within(root).getByRole('group', { name });
    expect(within(child).getByText('Awaiting roll')).toBeVisible();
    expect(
      within(child).getByText(
        'From Event 1 (Roll Twice) · Awaiting the table roll',
      ),
    ).toBeVisible();
  }
  for (const retired of [
    /Add rolled event/,
    /Add automatic event/,
    /Add Roll Twice child/,
    /Add replacement event/,
    /Remove Event \d+ and its branches/,
    /Select this Activity event/,
  ])
    expect(screen.queryByRole('button', { name: retired })).toBeNull();
  // The week outcome never looks final while dice are missing.
  const outcome = screen.getByRole('region', { name: 'Week outcome' });
  expect(
    within(outcome).getByText('Waiting for the steps above'),
  ).toBeVisible();
});

test('[PER-02.link] every event block, nested ones included, carries the focusable anchor a Persistent source link opens', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [
    occurrence('root', 50),
    { eventId: 'a', origin: { kind: 'roll_twice', parentEventId: 'root' } },
    { eventId: 'b', origin: { kind: 'roll_twice', parentEventId: 'root' } },
  ];
  render(
    <EventView view={facts(draft, snapshot)} edit={vi.fn()} disabled={false} />,
  );
  for (const [eventId, label] of [
    ['root', 'Event 1'],
    ['a', 'Event 1.1'],
    ['b', 'Event 1.2'],
  ] as const) {
    const block = group(label);
    expect(block).toHaveAttribute('id', eventOccurrenceAnchor(eventId));
    block.focus();
    expect(block).toHaveFocus();
  }
});

test('[EVT-03.view] a position still being saved shows its blank but accepts no roll', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.draftId = 'd';
  const edit = vi.fn();
  render(
    <EventView
      view={facts(draft, snapshot, {
        acceptedEventIds: new Set(),
        preparationFailed: false,
      })}
      edit={edit}
      disabled={false}
    />,
  );
  const field = screen.getByRole('textbox', { name: 'Event 1 table roll' });
  expect(field).toBeDisabled();
  expect(within(group('Event 1')).getByText('Preparing')).toBeVisible();
  fireEvent.change(field, { target: { value: '12' } });
  expect(edit).not.toHaveBeenCalled();
});

test('[EVT-03.retry] a failed preparation keeps the phase open and offers retry', () => {
  const { draft, snapshot } = eventSelectionFixture();
  const retry = vi.fn();
  render(
    <EventView
      view={facts(draft, snapshot, {
        acceptedEventIds: new Set(),
        preparationFailed: true,
      })}
      edit={vi.fn()}
      disabled={false}
      preparation={{ status: 'failed', retry }}
    />,
  );
  const alert = screen
    .getAllByRole('alert')
    .find((node) => node.textContent?.includes('could not be prepared'))!;
  expect(alert).toHaveTextContent('Your saved rolls are kept.');
  fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('[EVT-06.view] candidates sit side by side with Choose this event; the chance step names its source', () => {
  const { draft, snapshot } = eventActionFixture();
  const choice = draft.activity.slots.find(
    (slot) => slot.choice?.choiceId === 'shape',
  )!.choice!;
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  delete choice.selectedEventId;
  const edit = vi.fn();
  const openActivity = vi.fn();
  render(
    <EventView
      view={facts(draft, snapshot)}
      edit={edit}
      disabled={false}
      openActivity={openActivity}
    />,
  );
  const chance = screen.getByRole('region', { name: 'Event chance' });
  expect(chance).toHaveTextContent(/Guarantee Event · Action Slot \d/);
  fireEvent.click(
    within(chance).getByRole('button', { name: 'Open Activity' }),
  );
  expect(openActivity).toHaveBeenCalled();
  expect(
    screen.queryByRole('textbox', { name: 'Event chance roll' }),
  ).toBeNull();
  // A candidate pair shares one number: Raid is 1A, Theft is 1B.
  const theft = group('Event 1B');
  fireEvent.click(
    within(theft).getByRole('button', { name: 'Choose this event' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'detail',
    slotId: expect.any(String),
    choiceId: 'shape',
    choice: { ...choice, selectedEventId: 'theft' },
  });
});

test('[EVT-13.repair] clearing the roll of an otherwise empty surplus root removes it through the tree edit', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [occurrence('one', 10), occurrence('two', 80)];
  const edit = vi.fn();
  render(
    <EventView view={facts(draft, snapshot)} edit={edit} disabled={false} />,
  );
  expect(within(group('Event 2')).getByText('Needs repair')).toBeVisible();
  // Repair is by clearing; there is no separate remove control.
  expect(
    screen.queryByRole('button', { name: /Remove extra Event/ }),
  ).toBeNull();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Event 2 table roll' }),
    { target: { value: '' } },
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_tree',
    occurrences: [occurrence('one', 10)],
  });
});

test('[EVT-13.candidate-reroll-view] candidates that roll Roll Twice show Reroll with no children', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  choice.candidates = [occurrence('raid', 50), occurrence('theft', 51)];
  render(
    <EventView view={facts(draft, snapshot)} edit={vi.fn()} disabled={false} />,
  );
  for (const label of ['Event 1A', 'Event 1B']) {
    const block = group(label);
    expect(within(block).getByText('Reroll')).toBeVisible();
    expect(
      within(block).getByText(
        /Roll Twice again: reroll and enter the new die$/,
      ),
    ).toBeVisible();
    expect(
      within(block).queryByRole('group', { name: `${label}.1` }),
    ).toBeNull();
  }
});

test('[EVT-01.view] the chance line shows the settlement adjustment on the chance roll only', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.notoriety = 40;
  snapshot.settlements[0] = {
    ...snapshot.settlements[0]!,
    reputation: 'Unfriendly',
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  };
  draft.event.chanceRoll = roll(100, 41);
  draft.event.occurrences = [];
  render(
    <EventView view={facts(draft, snapshot)} edit={vi.fn()} disabled={false} />,
  );
  const chance = screen.getByRole('region', { name: 'Event chance' });
  expect(chance).toHaveTextContent('41 +5 Town (Unfriendly) = 46');
  expect(chance).toHaveTextContent('46 is not below 40: a quiet week');
  expect(chance).toHaveTextContent(
    'Operating from Town (Unfriendly) adds +5 to the chance roll.',
  );
});
