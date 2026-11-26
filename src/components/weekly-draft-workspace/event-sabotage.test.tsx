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
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { EventView } from './event-view';

function project(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Wren Ashby' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return { view: eventView(draft, source, preview), preview };
}

// One Sickness (Event 1) whose team the table has not chosen yet, and two
// Saboteurs teams that did not act this week.
function sickness(check?: number, notoriety?: number) {
  const { draft, snapshot } = threatEventFixture(90);
  const event = draft.event.occurrences[0]!;
  delete event.targets;
  draft.acknowledgements = [];
  if (check !== undefined || notoriety !== undefined)
    event.sabotage = {
      choiceId: 'sabotage-event',
      teamId: 'second-team',
      check: 'secrecy',
      rolls: {
        ...(check !== undefined ? { check: roll(20, check) } : {}),
        ...(notoriety !== undefined ? { notoriety: roll(6, notoriety) } : {}),
      },
    };
  draft.acknowledgements.push({
    acknowledgementId: 'sabotage:event:sabotage-event',
    subjectId: 'sabotage:event:sabotage-event',
    outcome: 'The Saboteurs struck at dawn.',
  });
  return { draft, snapshot, event };
}
const notorietyAfter = (preview: ReturnType<typeof project>['preview']) =>
  preview.phases!.event.outcome.notoriety;

test('[rules.EVT-10.sabotage-success] a successful Sabotage negates the exact event, adds its notoriety and no longer asks for the event’s own inputs', () => {
  const plain = sickness();
  const before = project(plain.draft, plain.snapshot);
  // Unsabotaged, the Sickness asks for its team.
  expect(before.view.requirements).toContain('event:team');

  const { draft, snapshot } = sickness(20, 4);
  const { view, preview } = project(draft, snapshot);
  const facts = view.sabotage!.event!;
  expect(facts.dc).toBe(15 + snapshot.rank);
  expect(facts.result).toEqual({
    kind: 'success',
    text: 'Sabotage succeeds: Sickness does not happen.',
  });
  expect(facts.notorietyGain).toBe(4);
  expect(notorietyAfter(preview)).toBe(notorietyAfter(before.preview) + 4);
  expect(view.occurrences[0]!.negated).toBe(true);
  expect(view.rolled.blocks[0]!.status).toBe('sabotaged');
  // The prototype bug: a sabotaged event must not still ask for its team.
  expect(view.requirements).toEqual([]);
  expect(view.ready).toBe(true);
});

test('[rules.EVT-10.sabotage-failure] a failed Sabotage still adds its notoriety and the event still happens', () => {
  const plain = sickness();
  const before = project(plain.draft, plain.snapshot);
  const { draft, snapshot } = sickness(1, 5);
  const { view, preview } = project(draft, snapshot);
  expect(view.sabotage!.event!.result).toEqual({
    kind: 'failure',
    text: 'Sabotage fails: Sickness still happens.',
  });
  expect(view.sabotage!.event!.checkRow).toMatchObject({
    label: 'Sabotage Secrecy check for Event 1 · Sickness',
    dc: 15 + snapshot.rank,
    succeeded: false,
    resultText: 'Sickness still happens.',
  });
  expect(notorietyAfter(preview)).toBe(notorietyAfter(before.preview) + 5);
  expect(view.occurrences[0]!.negated).toBe(false);
  expect(view.requirements).toContain('event:team');
});

test('[rules.EVT-10.sabotage-unavailable] a disabled Saboteurs team asks for a Rules Exception and neither spends notoriety nor negates until it has one', () => {
  const plain = sickness();
  const before = project(plain.draft, plain.snapshot);
  const { draft, snapshot } = sickness(20, 4);
  snapshot.roster.teams.find((team) => team.teamId === 'second-team')!.status =
    'disabled';
  const { view, preview } = project(draft, snapshot);
  const facts = view.sabotage!.event!;
  expect(facts.result?.kind).toBe('unavailable');
  expect(
    facts.team.choices.find((card) => card.value === 'second-team'),
  ).toMatchObject({ description: expect.stringContaining('Disabled') });
  expect(view.occurrences[0]!.negated).toBe(false);
  expect(notorietyAfter(preview)).toBe(notorietyAfter(before.preview));
  expect(view.messages['sabotage-event:team-condition:exception']).toBe(
    'Event 1 · Sickness: Sabotage: record a Rules Exception reason for this team, or choose another team.',
  );
  // With a reasoned exception the attempt resolves.
  draft.rulesExceptions.push({
    exceptionId: 'sabotage-exception',
    subjectId: 'sabotage-event',
    ruleId: 'team-condition',
    reason: 'The GM allows it',
  });
  expect(project(draft, snapshot).view.sabotage!.event!.result?.kind).toBe(
    'success',
  );
});

test('[rules.EVT-10.sabotage-incomplete] an incomplete attempt negates nothing and names each missing input', () => {
  const { draft, snapshot } = sickness(undefined, 3);
  const { view } = project(draft, snapshot);
  expect(view.sabotage!.event!.result?.kind).toBe('incomplete');
  expect(view.occurrences[0]!.negated).toBe(false);
  expect(view.messages['sabotage-event:check:1d20']).toBe(
    'Event 1 · Sickness: Sabotage: enter the check roll (d20).',
  );
  // One missing d20 is one decision, not also the check's absent roll.
  expect(view.requirements).toContain('sabotage-event:check:1d20');
  expect(view.requirements).not.toContain('event:sabotage:sabotage-event:roll');
  // Without a team, only the team is asked for.
  delete draft.event.occurrences[0]!.sabotage!.teamId;
  const noTeam = project(draft, snapshot).view;
  expect(noTeam.sabotage!.event!.result?.kind).toBe('incomplete');
  expect(noTeam.messages['sabotage-event:team']).toBe(
    'Event 1 · Sickness: Sabotage: choose the Saboteurs team.',
  );
});

test('[rules.EVT-14.sabotage-exact] Sabotage negates only the occurrence it was made on', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  const first = draft.event.occurrences.find(
    (event) => event.eventId === 'first',
  )!;
  first.sabotage = {
    choiceId: 'sabotage-first',
    teamId: 'second-team',
    check: 'secrecy',
    rolls: { check: roll(20, 20), notoriety: roll(6, 2) },
  };
  draft.acknowledgements.push({
    acknowledgementId: 'note',
    subjectId: 'sabotage:first:sabotage-first',
    outcome: 'Done',
  });
  const { view, preview } = project(draft, snapshot);
  expect(preview.phases!.event.negatedEventIds).toEqual(['first']);
  const byId = (eventId: string) =>
    view.occurrences.find((item) => item.occurrence.eventId === eventId)!;
  expect(byId('first').negated).toBe(true);
  expect(byId('second').negated).toBe(false);
  expect(view.sabotage!.second!.offer).toBe(true);
  expect(view.sabotage!.second!.recorded).toBe(false);
});

test('[EVT-07.sabotage-open] the quiet button opens the reaction locally; the first team choice records it on the exact occurrence with everything else kept', async () => {
  const { draft, snapshot } = sickness();
  draft.acknowledgements = [];
  draft.event.occurrences[0]!.targets = [{ kind: 'team', teamId: 'team' }];
  const edit = vi.fn((_edit: WeeklyDraftEdit) =>
    Promise.resolve('accepted' as const),
  );
  render(
    <EventView
      view={project(draft, snapshot).view}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Sabotage this event · Event 1 · Sickness',
    }),
  );
  expect(edit).not.toHaveBeenCalled();
  const panel = screen.getByRole('group', {
    name: 'Sabotage of Event 1 · Sickness',
  });
  expect(panel).toHaveTextContent(
    `Sabotage · reactive action · DC ${15 + snapshot.rank} · adds notoriety`,
  );
  // Nothing is asked for before a choice is made.
  expect(screen.queryByText(/Sabotage: choose/)).not.toBeInTheDocument();
  fireEvent.click(
    within(panel).getByRole('button', {
      name: 'Cancel Sabotage of Event 1 · Sickness',
    }),
  );
  expect(edit).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('group', { name: 'Sabotage of Event 1 · Sickness' }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Sabotage this event · Event 1 · Sickness',
    }),
  );
  const cards = within(
    screen.getByRole('group', { name: 'Sabotage of Event 1 · Sickness' }),
  ).getAllByRole('button', { name: 'Team', pressed: false });
  fireEvent.click(cards[1]!);
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: {
      ...draft.event.occurrences[0],
      sabotage: { choiceId: 'sabotage-event', teamId: 'second-team' },
    },
  });
});

test('[EVT-07.sabotage-inputs] check kind, rolls and What happened edit the same recorded reaction', async () => {
  const { draft, snapshot } = sickness();
  draft.acknowledgements = [];
  draft.event.occurrences[0]!.targets = [{ kind: 'team', teamId: 'team' }];
  draft.event.occurrences[0]!.sabotage = {
    choiceId: 'sabotage-event',
    teamId: 'second-team',
  };
  const edit = vi.fn((_edit: WeeklyDraftEdit) =>
    Promise.resolve('accepted' as const),
  );
  render(
    <EventView
      view={project(draft, snapshot).view}
      edit={edit}
      disabled={false}
    />,
  );
  const recorded = screen.getByRole('group', {
    name: 'Sabotage of Event 1 · Sickness',
  });
  fireEvent.click(
    within(recorded).getByRole('button', {
      name: 'Security check for the Sabotage',
    }),
  );
  expect(edit.mock.lastCall![0]).toMatchObject({
    occurrence: {
      targets: [{ kind: 'team', teamId: 'team' }],
      sabotage: {
        choiceId: 'sabotage-event',
        teamId: 'second-team',
        check: 'security',
      },
    },
  });
  fireEvent.change(
    within(recorded).getByRole('textbox', {
      name: 'Sabotage notoriety roll for Event 1 · Sickness',
    }),
    { target: { value: '6' } },
  );
  expect(edit.mock.lastCall![0]).toMatchObject({
    occurrence: {
      sabotage: {
        choiceId: 'sabotage-event',
        rolls: { notoriety: { diceTotal: 6, sides: 6 } },
      },
    },
  });
  fireEvent.change(
    within(recorded).getByRole('textbox', {
      name: 'What happened · Sabotage of Event 1 · Sickness',
    }),
    { target: { value: 'The bridge burned.' } },
  );
  fireEvent.click(
    within(recorded).getByRole('button', {
      name: 'Save what happened · Sabotage of Event 1 · Sickness',
    }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'sabotage:event:sabotage-event',
        subjectId: 'sabotage:event:sabotage-event',
        outcome: 'The bridge burned.',
      },
    }),
  );
});

test('[EVT-07.sabotage-cancel] cancelling a recorded Sabotage clears its note, then the reaction, keeping the event’s own inputs', async () => {
  const { draft, snapshot } = sickness(12, 2);
  draft.event.occurrences[0]!.targets = [{ kind: 'team', teamId: 'team' }];
  const edit = vi.fn((_edit: WeeklyDraftEdit) =>
    Promise.resolve('accepted' as const),
  );
  render(
    <EventView
      view={project(draft, snapshot).view}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Cancel Sabotage of Event 1 · Sickness',
    }),
  );
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  expect(edit.mock.calls.map(([call]) => call)).toEqual([
    {
      kind: 'clear_acknowledgement',
      acknowledgementId: 'sabotage:event:sabotage-event',
    },
    {
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'event',
        origin: { kind: 'rolled' },
        tableRoll: draft.event.occurrences[0]!.tableRoll,
        targets: [{ kind: 'team', teamId: 'team' }],
      },
    },
  ]);
});

test('[EVT-07.sabotage-refused-cancel] a refused note clear keeps the reaction and says so', async () => {
  const { draft, snapshot } = sickness(12, 2);
  const edit = vi.fn((_edit: WeeklyDraftEdit) =>
    Promise.resolve('failed' as const),
  );
  render(
    <EventView
      view={project(draft, snapshot).view}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Cancel Sabotage of Event 1 · Sickness',
    }),
  );
  expect(
    await screen.findByText('The Sabotage could not be cancelled. Try again.'),
  ).toBeVisible();
  expect(edit).toHaveBeenCalledTimes(1);
});

test('[EVT-07.sabotage-not-offered] no quiet button for a calm week, without Saboteurs, or while the week is locked', () => {
  const calm = threatEventFixture(46);
  expect(project(calm.draft, calm.snapshot).view.sabotage!.event!.offer).toBe(
    false,
  );
  const { draft, snapshot } = sickness();
  for (const team of snapshot.roster.teams) team.teamType = 'guardians';
  expect(project(draft, snapshot).view.sabotage!.event!.offer).toBe(false);

  const open = sickness();
  render(
    <EventView
      view={project(open.draft, open.snapshot).view}
      edit={vi.fn()}
      disabled
    />,
  );
  expect(
    screen.getByRole('button', {
      name: 'Sabotage this event · Event 1 · Sickness',
    }),
  ).toBeDisabled();
});

test('[EVT-07.sabotage-clear-check] pressing the chosen check again clears only the check kind', () => {
  const { draft, snapshot } = sickness(12, 2);
  const edit = vi.fn((_edit: WeeklyDraftEdit) =>
    Promise.resolve('accepted' as const),
  );
  render(
    <EventView
      view={project(draft, snapshot).view}
      edit={edit}
      disabled={false}
    />,
  );
  const check = screen.getByRole('button', {
    name: 'Secrecy check for the Sabotage',
  });
  expect(check).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(check);
  expect(edit.mock.lastCall![0]).toEqual({
    kind: 'event_occurrence',
    occurrence: {
      eventId: 'event',
      origin: { kind: 'rolled' },
      tableRoll: draft.event.occurrences[0]!.tableRoll,
      sabotage: {
        choiceId: 'sabotage-event',
        teamId: 'second-team',
        rolls: { check: roll(20, 12), notoriety: roll(6, 2) },
      },
    },
  });
});

test('[rules.EVT-10.sabotage-candidate-switch] switching the chosen candidate keeps the other candidate’s Sabotage on record, unused and without notoriety', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  const chosen = project(draft, snapshot);
  expect(chosen.view.sabotage!.raid!.recorded).toBe(true);
  expect(chosen.view.sabotage!.raid!.notorietyGain).toBe(4);
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  choice.selectedEventId = 'theft';
  const switched = project(draft, snapshot);
  const kept = switched.view.sabotage!.raid!;
  expect(kept.recorded).toBe(true);
  expect(kept.result?.kind).toBe('inactive');
  expect(kept.notorietyGain).toBeNull();
  expect(switched.preview.phases!.event.negatedEventIds).toEqual([]);
  expect(
    notorietyAfter(chosen.preview) - notorietyAfter(switched.preview),
  ).toBe(4);
});

test('[rules.EVT-13.sabotage-candidate-reroll] Sabotage waits for a chosen candidate’s Roll Twice reroll in its own die', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  const [raid] = choice.candidates!;
  // A Roll Twice is not an event: the Sabotage stays unused until rerolled.
  raid!.tableRoll = roll(100, 50);
  const pending = project(draft, snapshot);
  expect(pending.preview.requirements).toContain('raid:replacement:1');
  expect(pending.view.sabotage!.raid!.result?.kind).toBe('inactive');
  expect(pending.view.sabotage!.raid!.notorietyGain).toBeNull();

  // Rerolled in its own die, the candidate is the Raid it sabotages.
  raid!.tableRoll = roll(100, 78);
  const inPlace = project(draft, snapshot);
  expect(inPlace.view.sabotage!.raid!.result?.kind).toBe('success');
  expect(inPlace.preview.phases!.event.negatedEventIds).toEqual(['raid']);
});
