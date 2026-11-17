import {
  cleanup,
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
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
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
    people: [
      { characterId: 'pc', name: 'Wren Ashby' },
      { characterId: 'second', name: 'Nora Vell' },
    ],
  });
  return eventView(
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
    context,
  );
}
function raid() {
  const { draft, snapshot } = threatEventFixture(78);
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'second',
  });
  return { draft, snapshot };
}
// A new entry is written as a dice total.
const total = (sides: number, diceTotal: number) => ({
  diceTotal,
  diceCount: 1,
  sides,
  provenance: { kind: 'table' },
  modifiers: [],
});
const lastOccurrence = (edit: ReturnType<typeof vi.fn>) =>
  edit.mock.lastCall![0].occurrence;

test('[EVT-08.raid-view] each hidden person has their own Attempt it / Let it happen, Security check and capture roll', () => {
  const { draft, snapshot } = raid();
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const block = screen.getByRole('group', { name: 'Event 1' });
  // The general details editor stays folded away below the panel.
  expect(
    within(block)
      .getAllByRole('button', { name: 'Town', pressed: true })
      .filter((card) => !card.closest('details')),
  ).toHaveLength(1);
  const wren = within(block).getByRole('group', { name: 'Wren Ashby' });
  const nora = within(block).getByRole('group', { name: 'Nora Vell' });
  // Nothing attempted: no hidden check is asked for.
  expect(
    within(block).queryByRole('textbox', { name: /Security check for/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(wren).getByRole('button', { name: 'Attempt it for Wren Ashby' }),
  );
  expect(lastOccurrence(edit).targetChecks).toEqual([
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
    },
  ]);

  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
    },
  ];
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const check = within(wren).getByRole('textbox', {
    name: 'Security check for Wren Ashby',
  });
  expect(within(nora).queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.change(check, { target: { value: '19' } });
  expect(lastOccurrence(edit).targetChecks).toEqual([
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
      rolls: { check: total(20, 19) },
    },
  ]);

  draft.event.occurrences[0]!.targetChecks[0]!.rolls = {
    check: roll(20, 19),
  };
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  expect(
    within(wren).getByText('Success · Capture chance falls to 50%.'),
  ).toBeVisible();
  fireEvent.change(
    within(wren).getByRole('textbox', { name: 'Capture roll for Wren Ashby' }),
    { target: { value: '72' } },
  );
  expect(lastOccurrence(edit).targetChecks[0].rolls).toEqual({
    check: roll(20, 19),
    loss: total(100, 72),
  });
  // Nora explicitly lets it happen, independently of Wren.
  fireEvent.click(
    within(nora).getByRole('button', { name: 'Let it happen for Nora Vell' }),
  );
  expect(lastOccurrence(edit).targetChecks).toEqual([
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 19) },
    },
    {
      target: { kind: 'character', characterId: 'second' },
      mitigation: 'unattempted',
    },
  ]);
});

test('[EVT-10.sickness-view] the Twice Sickness save is a mandatory check with no Attempt it / Let it happen', async () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  delete draft.event.occurrences[2]!.rolls;
  draft.acknowledgements = [];
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const twice = screen.getByRole('group', { name: 'Event 1.2' });
  expect(within(twice).getByText('Mandatory')).toBeVisible();
  expect(within(twice).getByText('Loyalty DC 20')).toBeVisible();
  expect(
    within(twice).queryByRole('button', { name: /Attempt it|Let it happen/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    within(twice).getByRole('textbox', { name: 'Loyalty check' }),
    { target: { value: '16' } },
  );
  expect(lastOccurrence(edit)).toMatchObject({
    eventId: 'second',
    rolls: { check: total(20, 16) },
    targets: [{ kind: 'team', teamId: 'team' }],
  });
  // Choosing another team card replaces the target.
  const [other] = within(twice)
    .getAllByRole('button', { name: 'Team', pressed: false })
    .filter((card) => !card.closest('details'));
  fireEvent.click(other!);
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'team', teamId: 'second-team' },
  ]);
  expect(
    within(twice).getByRole('textbox', { name: 'What happened' }).closest('div')
      ?.parentElement?.textContent,
  ).toContain('required');
  fireEvent.change(
    within(twice).getByRole('textbox', { name: 'What happened' }),
    {
      target: { value: 'The fever took the Wardens.' },
    },
  );
  fireEvent.click(
    within(twice).getByRole('button', { name: 'Save what happened' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'event:second',
        subjectId: 'event:second',
        outcome: 'The fever took the Wardens.',
      },
    }),
  );
});

test('[EVT-03.panel-pending] an occurrence still being prepared shows no event inputs; Confirmation disables them all', () => {
  const { draft, snapshot } = raid();
  render(
    <EventView
      view={view(draft, snapshot, {
        acceptedEventIds: new Set(),
        preparationFailed: false,
      })}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  expect(
    screen.queryByRole('group', { name: 'Wren Ashby' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('textbox', { name: 'What happened' }),
  ).not.toBeInTheDocument();
  cleanup();

  render(<EventView view={view(draft, snapshot)} edit={vi.fn()} disabled />);
  const block = screen.getByRole('group', { name: 'Event 1' });
  for (const control of [
    ...within(block).getAllByRole('button'),
    ...within(block).getAllByRole('textbox'),
  ].filter((element) => !element.closest('details')))
    expect(control).toBeDisabled();
});
