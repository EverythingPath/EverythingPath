import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { recurringEventFixture } from '../../../tests/rules/recurring-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { EventView } from './event-view';

vi.mock('~/components/ui/select', () => import('./native-select-test-double'));

function fixture(value: number, twice = false) {
  const { draft, snapshot } = recurringEventFixture(value, twice);
  // Distinct team names, and an officer besides the unassigned PC.
  snapshot.roster.teams[1]!.name = 'Scouts';
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'second',
  });
  snapshot.roster.officers = [{ role: 'ambassador', characterId: 'second' }];
  return { draft, snapshot };
}
function view(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
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
  );
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
const block = (label: string) => screen.getByRole('group', { name: label });

test('[EVT-08.theft-view] Theft: Attempt it reveals the Loyalty check row; Let it happen keeps an entered roll as unused', () => {
  const { draft, snapshot } = fixture(74);
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const theft = block('Event 1');
  expect(
    within(theft).getByText('Not chosen yet: Let it happen applies.'),
  ).toBeVisible();
  expect(
    within(theft).queryByRole('textbox', { name: 'Loyalty check' }),
  ).not.toBeInTheDocument();
  expect(
    within(theft).getByRole('list', { name: 'Event 1 outcomes' }),
  ).toHaveTextContent('Treasury halved: 300 gp → 150 gp.');
  fireEvent.click(
    within(theft).getByRole('button', { name: 'Attempt it for Event 1' }),
  );
  expect(lastOccurrence(edit).mitigation).toBe('attempted');

  draft.event.occurrences[0]!.mitigation = 'attempted';
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  // An attempt without its roll shows no final-looking loss.
  expect(
    within(theft).queryByRole('list', { name: 'Event 1 outcomes' }),
  ).not.toBeInTheDocument();
  fireEvent.change(
    within(theft).getByRole('textbox', { name: 'Loyalty check' }),
    { target: { value: '20' } },
  );
  expect(lastOccurrence(edit)).toMatchObject({
    mitigation: 'attempted',
    rolls: { check: total(20, 20) },
  });

  draft.event.occurrences[0]!.rolls = { check: roll(20, 20) };
  draft.event.occurrences[0]!.mitigation = 'unattempted';
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.click(
    within(theft).getByRole('button', {
      name: 'Clear unused check roll for Event 1',
    }),
  );
  expect(lastOccurrence(edit)).not.toHaveProperty('rolls');
  expect(lastOccurrence(edit).mitigation).toBe('unattempted');
});

test('[EVT-07.rivalry-view] Rivalry picks two teams on cards named for their block', () => {
  const { draft, snapshot } = fixture(66, true);
  delete draft.event.occurrences[1]!.targets;
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const first = block('Event 1.1');
  const rival = within(first).getByRole('group', { name: /^Rival teams/ });
  fireEvent.click(
    within(rival).getByRole('button', { name: 'Scouts · Event 1.1' }),
  );
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'team', teamId: 'second-team' },
  ]);
  // The same teams in the Twice block have their own names.
  expect(
    within(block('Event 1.2')).getByRole('button', {
      name: 'Scouts · Event 1.2',
      pressed: true,
    }),
  ).toBeVisible();
  fireEvent.click(
    within(block('Event 1.2')).getByRole('button', {
      name: 'Clear rival teams from Event 1.2',
    }),
  );
  expect(lastOccurrence(edit)).not.toHaveProperty('targets');
});

test('[EVT-10.rivalry-officer-view] Rivalry Twice: Attempt it shows the officer check, which is stored once character and skill are known', () => {
  const { draft, snapshot } = fixture(66, true);
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const twice = block('Event 1.2');
  expect(
    within(twice).queryByRole('group', { name: 'Officer check for Event 1.2' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(twice).getByRole('button', { name: 'Attempt it for Event 1.2' }),
  );
  // Revealing the check sends nothing, and the pressed card says so.
  expect(edit).not.toHaveBeenCalled();
  expect(
    within(twice).getByRole('button', { name: 'Attempt it for Event 1.2' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const officer = within(twice).getByRole('group', {
    name: 'Officer check for Event 1.2',
  });
  // Only officers are offered.
  expect(
    within(officer).queryByRole('button', { name: 'Wren Ashby · Event 1.2' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(officer).getByRole('button', { name: 'Nora Vell · Event 1.2' }),
  );
  expect(edit).not.toHaveBeenCalled();
  expect(
    within(officer).getByRole('textbox', { name: 'Skill bonus' }),
  ).toBeDisabled();
  fireEvent.change(
    within(officer).getByRole('combobox', { name: 'Skill for Event 1.2' }),
    { target: { value: 'bluff' } },
  );
  expect(lastOccurrence(edit).officerCheck).toEqual({
    characterId: 'second',
    skill: 'bluff',
  });

  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'second',
    skill: 'bluff',
  };
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.change(
    within(officer).getByRole('textbox', { name: 'Skill bonus' }),
    { target: { value: '-1' } },
  );
  expect(lastOccurrence(edit).officerCheck).toEqual({
    characterId: 'second',
    skill: 'bluff',
    skillBonus: -1,
  });
  fireEvent.change(
    within(officer).getByRole('textbox', { name: 'Officer check roll' }),
    { target: { value: '12' } },
  );
  expect(lastOccurrence(edit).officerCheck.roll).toEqual(total(20, 12));
  // Let it happen removes the stored check.
  fireEvent.click(
    within(twice).getByRole('button', { name: 'Let it happen for Event 1.2' }),
  );
  expect(lastOccurrence(edit)).not.toHaveProperty('officerCheck');
});

test('[EVT-10.turncoat-view] Turncoat: the raw loss die, then Twice picks the team and an officer for its mandatory Diplomacy check', () => {
  const { draft, snapshot } = fixture(58, true);
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.change(
    within(block('Event 1.1')).getByRole('textbox', {
      name: 'Training loss roll',
    }),
    { target: { value: '5' } },
  );
  expect(lastOccurrence(edit).rolls).toEqual({ loss: total(6, 5) });
  const twice = block('Event 1.2');
  expect(
    within(twice).queryByRole('group', { name: 'Mitigation for Event 1.2' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(twice).getByRole('button', { name: 'Scouts · Event 1.2' }),
  );
  expect(lastOccurrence(edit).targets).toEqual([
    { kind: 'team', teamId: 'second-team' },
  ]);
  const check = within(twice).getByRole('group', {
    name: 'Diplomacy check for Event 1.2',
  });
  expect(within(check).getByText('Mandatory')).toBeVisible();
  // The rules' skill shows before anything is stored.
  expect(
    within(check).getByRole('combobox', { name: 'Skill for Event 1.2' }),
  ).toHaveValue('diplomacy');
  // Diplomacy is the rules' skill, so choosing the officer stores the check.
  fireEvent.click(
    within(check).getByRole('button', { name: 'Nora Vell · Event 1.2' }),
  );
  expect(lastOccurrence(edit).officerCheck).toEqual({
    characterId: 'second',
    skill: 'diplomacy',
  });
});

test('[EVT-12.same-week-view] a same-week persistent decision is shown with its occurrence and can be cleared', () => {
  const { draft, snapshot } = fixture(74, true);
  const first = draft.event.occurrences[1]!;
  first.persistent = true;
  first.persistentDecision = { eventId: 'first', kind: 'unattempted' };
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const theft = block('Event 1.1');
  expect(
    within(theft).getByText(
      'Persistent decision for this week: Let it happen. Persistent resolves it once this event is persistent.',
    ),
  ).toBeVisible();
  fireEvent.click(
    within(theft).getByRole('button', {
      name: 'Clear the persistent decision from Event 1.1',
    }),
  );
  expect(lastOccurrence(edit)).not.toHaveProperty('persistentDecision');
  expect(lastOccurrence(edit).persistent).toBe(true);
});

test('[EVT-14.recurring-disabled] a confirmed week disables every event-specific control', () => {
  const { draft, snapshot } = fixture(66, true);
  render(
    <EventView view={view(draft, snapshot)} edit={vi.fn()} disabled={true} />,
  );
  for (const name of [
    'Scouts · Event 1.1',
    'Attempt it for Event 1.2',
    'Clear rival teams from Event 1.2',
  ])
    expect(screen.getByRole('button', { name })).toBeDisabled();
});
