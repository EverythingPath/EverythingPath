import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { projectPersistentWeek } from '~/lib/rules-persistent-events';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { recurringEventFixture } from '../../../tests/rules/recurring-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { pressTeamPair, teamPairWithout } from './event-recurring-facts';
import { derivePhaseReadiness } from './phase-readiness';
import type { EventPanel, EventView } from './types';
import { useEventEdits } from './use-event-edits';

type Recurring = Extract<EventPanel, { family: 'recurring' }>;

function facts(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  acceptedEventIds: ReadonlySet<string> | null = null,
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
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const view = eventView(draft, source, preview, {
    acceptedEventIds,
    preparationFailed: false,
  });
  const { phases } = derivePhaseReadiness(draft, source, preview);
  const phase = phases.find((entry) => entry.phase === 'event')!;
  return { view, phase, preview };
}
function panel(view: EventView, eventId: string) {
  const found = view.occurrences.find(
    (entry) => entry.occurrence.eventId === eventId,
  )?.panel;
  expect(found?.family).toBe('recurring');
  return found as Recurring;
}
const messages = (phase: ReturnType<typeof facts>['phase']) =>
  phase.requirements.map((entry) => entry.message);
// A second character who holds an officer role.
function withOfficer(snapshot: UpkeepSnapshot, role = 'ambassador' as const) {
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'second',
  });
  snapshot.roster.officers = [{ role, characterId: 'second' }];
}
function lastOccurrence(edit: ReturnType<typeof vi.fn>) {
  return edit.mock.lastCall![0].occurrence;
}

test('[EVT-07.rivalry-base] Rivalry takes two distinct teams and a required What happened; both sit out next Activity', () => {
  const { draft, snapshot } = recurringEventFixture(66);
  const rivalry = panel(facts(draft, snapshot).view, 'event');
  expect(rivalry.eventType).toBe('rivalry');
  expect(rivalry.teams).toMatchObject({
    label: 'Rival teams',
    hint: 'Two random teams.',
    required: false,
    selected: ['team', 'second-team'],
    retained: [],
  });
  expect(rivalry.whatHappened?.required).toBe(true);
  // The base event has no officer check and no mitigation.
  expect(rivalry.officer).toBeNull();
  expect(rivalry.mitigation).toBeNull();
  expect(rivalry.outcomes).toEqual([
    'Next week (week 41): Team cannot act in Activity.',
    'Next week (week 41): Team cannot act in Activity.',
  ]);

  // One team, then the same team twice: the rules still ask for two.
  draft.event.occurrences[0]!.targets = [
    { kind: 'team', teamId: 'team' },
    { kind: 'team', teamId: 'team' },
  ];
  const { view, phase } = facts(draft, snapshot);
  const open = panel(view, 'event');
  expect(open.teams).toMatchObject({ required: true, selected: ['team'] });
  expect(open.partial).toBe(true);
  expect(messages(phase)).toEqual([
    'Event 1 · Rivalry: choose the two rival teams.',
  ]);
});

test('[EVT-07.rivalry-press] pressing rival team cards keeps two, dropping the earliest', () => {
  const pair = {
    label: 'Rival teams',
    hint: null,
    required: false,
    choices: [],
    selected: ['a', 'b'],
    retained: [{ value: 'gone', label: 'Gone', reason: '' }],
  };
  expect(pressTeamPair(pair, 'c')).toEqual(['b', 'c']);
  expect(pressTeamPair(pair, 'a')).toEqual(['b']);
  expect(pressTeamPair({ ...pair, selected: [] }, 'a')).toEqual(['a']);
  expect(teamPairWithout(pair, 'gone')).toEqual(['a', 'b']);
  expect(teamPairWithout(pair, 'a')).toEqual(['b', 'gone']);
});

test('[EVT-12.rivalry-twice] Rivalry Twice becomes persistent under its own block; its optional officer check can end it now', () => {
  const { draft, snapshot } = recurringEventFixture(66, true);
  withOfficer(snapshot);
  let { view, phase } = facts(draft, snapshot);
  const first = panel(view, 'first');
  const twice = panel(view, 'second');
  // The first occurrence's one-week effect is replaced, and it says where.
  expect(first.outcomes).toEqual([]);
  expect(first.notes).toEqual([
    'Twice in Event 1.2 · Rivalry: the Rivalry becomes persistent there instead of lasting one week.',
  ]);
  expect(twice.teams?.hint).toBe('The same two teams as Event 1.1 · Rivalry.');
  expect(twice.notes).toEqual([
    'Twice with Event 1.1 · Rivalry: the Rivalry becomes persistent instead of lasting one week.',
  ]);
  expect(twice.outcomes).toEqual([
    'Rivalry becomes persistent from week 40 (1st that week). Team and Team cannot act in Activity until an officer succeeds at DC 20 Bluff, Diplomacy or Intimidate.',
  ]);
  // Optional: Let it happen applies until the check is started.
  expect(twice.mitigation).toMatchObject({
    value: 'unattempted',
    explicit: false,
  });
  expect(twice.officer).toMatchObject({
    label: 'Officer check',
    legend: 'Bluff, Diplomacy or Intimidate DC 20',
    mandatory: false,
    characterId: null,
    // Only an officer can end a Rivalry.
    characters: [
      {
        value: 'second',
        label: 'Nora Vell',
        description: 'Ambassador',
        officer: true,
      },
    ],
    skill: null,
  });
  expect(messages(phase)).toEqual([]);

  // Attempted: the check waits for its skill bonus and roll, then ends it.
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'second',
    skill: 'intimidate',
  };
  ({ view, phase } = facts(draft, snapshot));
  expect(panel(view, 'second').mitigation?.value).toBe('attempted');
  expect(panel(view, 'second').officer?.required).toEqual({
    character: false,
    skillBonus: true,
    roll: true,
  });
  expect(messages(phase)).toEqual([
    'Event 1.2 · Rivalry: enter the officer check (d20).',
    'Event 1.2 · Rivalry: enter the officer’s skill bonus.',
  ]);
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'second',
    skill: 'intimidate',
    // Zero is a skill bonus, not a blank.
    skillBonus: 0,
    roll: {
      ...roll(20, 18),
      modifiers: [{ sourceId: 'custom:song', value: 2, reason: 'War song' }],
    },
  };
  ({ view, phase } = facts(draft, snapshot));
  const ended = panel(view, 'second');
  expect(ended.officer).toMatchObject({
    skillBonus: 0,
    modifier: 2,
    total: 20,
    breakdown: [
      { source: 'skill-bonus', label: 'Skill bonus', value: 0 },
      { source: 'custom:song', label: 'War song', value: 2 },
    ],
    succeeded: true,
    resultText: 'Ends the Rivalry now.',
    waiting: null,
  });
  expect(ended.outcomes).toEqual([
    'Rivalry becomes persistent from week 40 (1st that week). Team and Team cannot act in Activity until an officer succeeds at DC 20 Bluff, Diplomacy or Intimidate.',
    'Nora Vell’s Intimidate check: 20 against DC 20, success.',
    'Rivalry (from Event 1.1 · Rivalry) ends now.',
  ]);
  expect(messages(phase)).toEqual([]);
});

test('[EVT-10.rivalry-officer] a recorded non-officer stays visible to replace, and blocks the check', () => {
  const { draft, snapshot } = recurringEventFixture(66, true);
  withOfficer(snapshot);
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'pc',
    skill: 'bluff',
    skillBonus: 5,
    roll: roll(20, 17),
  };
  const { view, phase } = facts(draft, snapshot);
  const officer = panel(view, 'second').officer!;
  expect(officer.retainedCharacter).toEqual({
    value: 'pc',
    label: 'Wren Ashby',
    reason:
      'Not an officer: only an officer can make this check. Choose an officer.',
  });
  expect(officer.required.character).toBe(true);
  // Everything is entered but the engine records no result yet.
  expect(officer.total).toBeNull();
  expect(officer.waiting).toBe(
    'The result follows once this event’s other inputs are in.',
  );
  expect(messages(phase)).toEqual([
    'Event 1.2 · Rivalry: choose an officer for the officer check.',
  ]);
});

test('[EVT-12.turncoat-base] Turncoat asks for its raw d6 loss roll; the rules add the rank', () => {
  const { draft, snapshot } = recurringEventFixture(58);
  let { view, phase } = facts(draft, snapshot);
  let turncoat = panel(view, 'event');
  expect(turncoat.eventType).toBe('turncoat');
  expect(turncoat.lossRoll).toMatchObject({
    label: 'Training loss roll',
    legend: `Rank ${snapshot.rank} is added by the rules`,
    spec: { count: 1, sides: 6 },
    required: true,
  });
  expect(turncoat.officer).toBeNull();
  expect(turncoat.team).toBeNull();
  expect(turncoat.whatHappened?.required).toBe(false);
  expect(messages(phase)).toEqual([
    'Event 1 · Turncoat: enter the training loss roll (d6).',
  ]);
  draft.event.occurrences[0]!.rolls = { loss: roll(6, 4) };
  ({ view, phase } = facts(draft, snapshot));
  turncoat = panel(view, 'event');
  const loss = 4 + snapshot.rank;
  expect(turncoat.lossRoll?.required).toBe(false);
  expect(turncoat.outcomes).toEqual([
    `Training −${loss}: ${snapshot.training} → ${snapshot.training - loss}.`,
  ]);
  expect(messages(phase)).toEqual([]);
});

test('[EVT-10.turncoat-twice] Turncoat Twice asks for the defecting team and a mandatory officer Diplomacy check', () => {
  const { draft, snapshot } = recurringEventFixture(58, true);
  withOfficer(snapshot);
  for (const event of draft.event.occurrences)
    if (event.eventId !== 'root') event.rolls = { loss: roll(6, 2) };
  const dc = 10 + snapshot.rank;
  let { view, phase } = facts(draft, snapshot);
  const first = panel(view, 'first');
  let twice = panel(view, 'second');
  expect(first.notes).toEqual([
    'Twice in Event 1.2 · Turncoat: whether a team defects is decided there.',
  ]);
  expect(twice.notes).toEqual([
    'Twice with Event 1.1 · Turncoat: its training loss still applies, and this one decides whether a team defects.',
  ]);
  // Twice does not use a loss roll of its own: it stays until cleared.
  expect(twice.lossRoll).toBeNull();
  expect(twice.retained).toEqual([
    { field: 'rolls', label: 'Rolls', value: 'loss roll' },
  ]);
  expect(twice.team).toMatchObject({
    label: 'Team that defects',
    hint: 'The GM chooses one full team.',
    required: true,
  });
  expect(twice.whatHappened?.required).toBe(true);
  expect(twice.officer).toMatchObject({
    label: 'Diplomacy check',
    legend: `Diplomacy DC ${dc}`,
    mandatory: true,
    expectedSkill: 'diplomacy',
  });
  // Anyone can make it: a non-officer with a Rules Exception.
  expect(twice.officer?.characters.map((entry) => entry.value)).toEqual([
    'second',
    'pc',
  ]);
  expect(twice.officer?.characters[1]?.description).toBe(
    'Not an officer · needs a Rules Exception',
  );
  expect(messages(phase)).toEqual([
    'Event 1.2 · Turncoat: choose the team that defects.',
  ]);

  // Team chosen: the check is mandatory, never an Attempt it choice.
  draft.event.occurrences[2]!.targets = [{ kind: 'team', teamId: 'team' }];
  ({ view, phase } = facts(draft, snapshot));
  twice = panel(view, 'second');
  expect(twice.mitigation).toBeNull();
  expect(twice.officer?.required.character).toBe(true);
  expect(messages(phase)).toEqual([
    'Event 1.2 · Turncoat: choose the officer who makes the Diplomacy check.',
  ]);

  // A non-officer using Bluff needs both Rules Exceptions.
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'pc',
    skill: 'bluff',
    skillBonus: 3,
    roll: roll(20, 10),
  };
  ({ view, phase } = facts(draft, snapshot));
  twice = panel(view, 'second');
  expect(twice.officer?.notes).toEqual([
    'Not an officer: this check needs a Rules Exception, recorded below.',
  ]);
  expect(messages(phase)).toEqual([
    'Event 1.2 · Turncoat: the Diplomacy check is made by someone who is not an officer. Record a reasoned Rules Exception or choose an officer.',
  ]);

  // An officer's failed Diplomacy: the team defects.
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'second',
    skill: 'diplomacy',
    skillBonus: 1,
    roll: roll(20, 2),
  };
  ({ view, phase } = facts(draft, snapshot));
  twice = panel(view, 'second');
  expect(twice.officer).toMatchObject({
    total: 3,
    dc,
    succeeded: false,
    resultText: 'Team defects and is lost.',
  });
  expect(twice.outcomes).toEqual([
    `Nora Vell’s Diplomacy check: 3 against DC ${dc}, failure.`,
    'Team defects and is lost.',
  ]);
  expect(messages(phase)).toEqual([]);

  // Success keeps the team, out of next Activity.
  draft.event.occurrences[2]!.officerCheck.roll = roll(20, 19);
  twice = panel(facts(draft, snapshot).view, 'second');
  expect(twice.officer?.resultText).toBe(
    'Team stays, but cannot act next Activity.',
  );
  expect(twice.outcomes).toEqual([
    `Nora Vell’s Diplomacy check: 20 against DC ${dc}, success.`,
    'Next week (week 41): Team cannot act in Activity.',
  ]);
});

test('[EVT-08.theft-mitigation] Theft mitigation is optional: unattempted halves the treasury, attempted waits for its Loyalty check', () => {
  const { draft, snapshot } = recurringEventFixture(74);
  let { view, phase } = facts(draft, snapshot);
  let theft = panel(view, 'event');
  expect(theft.mitigation).toMatchObject({
    value: 'unattempted',
    explicit: false,
  });
  expect(theft.check).toBeNull();
  expect(theft.outcomes).toEqual(['Treasury halved: 300 gp → 150 gp.']);
  expect(messages(phase)).toEqual([]);

  draft.event.occurrences[0]!.mitigation = 'attempted';
  ({ view, phase } = facts(draft, snapshot));
  theft = panel(view, 'event');
  expect(theft.check).toMatchObject({
    checkId: 'event:theft',
    label: 'Loyalty check',
    legend: 'Loyalty DC 20',
    mandatory: false,
    required: true,
  });
  // An incomplete attempt shows no final-looking outcome.
  expect(theft.outcomes).toEqual([]);
  expect(theft.partial).toBe(true);
  // One line for the missing die, not two.
  expect(messages(phase)).toEqual([
    'Event 1 · Theft: enter the Loyalty check (d20).',
  ]);

  draft.event.occurrences[0]!.rolls = { check: roll(20, 20) };
  theft = panel(facts(draft, snapshot).view, 'event');
  expect(theft.check).toMatchObject({
    succeeded: true,
    resultText: 'The treasury loses only 10%.',
  });
  expect(theft.outcomes).toEqual(['Treasury loses 10%: 300 gp → 270 gp.']);

  // Let it happen keeps the roll on record, unused.
  draft.event.occurrences[0]!.mitigation = 'unattempted';
  theft = panel(facts(draft, snapshot).view, 'event');
  expect(theft.mitigation).toMatchObject({
    value: 'unattempted',
    explicit: true,
  });
  expect(theft.check).toBeNull();
  expect(theft.unusedCheckRoll).toBe(true);
  expect(theft.outcomes).toEqual(['Treasury halved: 300 gp → 150 gp.']);

  // An older roll with no recorded choice reads as attempted.
  delete draft.event.occurrences[0]!.mitigation;
  theft = panel(facts(draft, snapshot).view, 'event');
  expect(theft.mitigation).toMatchObject({
    value: 'attempted',
    explicit: false,
  });
});

test('[EVT-12.theft-twice] Theft Twice has no mitigation, keeps the first loss and restricts income until Reduce Danger', () => {
  const { draft, snapshot } = recurringEventFixture(74, true);
  // A mitigation recorded on the Twice is kept, unused, until cleared.
  draft.event.occurrences[2]!.mitigation = 'attempted';
  const { view, phase } = facts(draft, snapshot);
  const first = panel(view, 'first');
  const twice = panel(view, 'second');
  expect(first.mitigation).not.toBeNull();
  expect(first.outcomes).toEqual(['Treasury halved: 300 gp → 150 gp.']);
  expect(first.notes).toEqual([
    'Twice in Event 1.2 · Theft: this Theft also becomes persistent, listed there.',
  ]);
  expect(twice.mitigation).toBeNull();
  expect(twice.check).toBeNull();
  expect(twice.notes).toEqual([
    'Twice with Event 1.1 · Theft: its treasury loss still applies, and the Theft becomes persistent.',
    'Twice has no mitigation. Only a successful Reduce Danger in a later week ends this Theft.',
  ]);
  expect(twice.outcomes).toEqual([
    'Theft becomes persistent from week 40 (1st that week). Half of all incoming treasury gains are lost every week until a successful Reduce Danger.',
  ]);
  expect(twice.retained).toEqual([
    { field: 'mitigation', label: 'Mitigation', value: 'Attempt it' },
  ]);
  expect(messages(phase)).toEqual([]);
});

test('[EVT-12.penalty-events] Low Morale and Double Agent: queued penalties and restriction, or one persistent event under their Twice', () => {
  let { view } = facts(
    ...(Object.values(recurringEventFixture(86)) as [
      WeeklyDraft,
      UpkeepSnapshot,
    ]),
  );
  const morale = panel(view, 'event');
  expect(morale.eventType).toBe('low_morale');
  expect(morale.outcomes).toEqual([
    'This week and next (weeks 40–41): Loyalty checks −2.',
  ]);
  expect(morale.whatHappened?.required).toBe(false);
  ({ view } = facts(
    ...(Object.values(recurringEventFixture(98)) as [
      WeeklyDraft,
      UpkeepSnapshot,
    ]),
  ));
  expect(panel(view, 'event').outcomes).toEqual([
    'This week and next (weeks 40–41): Secrecy checks −2.',
    'Next week (week 41): Secure Cache cannot be used in Activity.',
  ]);

  const { draft, snapshot } = recurringEventFixture(98, true);
  // Exact source, age and order: the engine orders it after the one
  // carried event, as Persistent labels carried events.
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'older',
        eventType: 'low_morale',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
    ],
  };
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'first').outcomes).toEqual([]);
  expect(panel(view, 'second').outcomes).toEqual([
    'Double Agent becomes persistent from week 40 (2nd that week). Secrecy checks −2 and no Secure Cache in Activity every week while it lasts.',
  ]);
});

test('[EVT-12.same-week-decision] a same-week persistent decision stays with its occurrence and still reaches Persistent', () => {
  const { draft, snapshot } = recurringEventFixture(74, true);
  const first = draft.event.occurrences[1]!;
  first.persistent = true;
  first.persistentDecision = { eventId: 'first', kind: 'unattempted' };
  const { view } = facts(draft, snapshot);
  expect(panel(view, 'first').sameWeek).toEqual({
    value: 'Let it happen',
    used: true,
  });
  // Never listed as an unused input to clear by accident.
  expect(panel(view, 'first').retained).toEqual([]);
  // Persistent reads the same stored decision for the same-week event.
  const persistent = projectPersistentWeek(draft, snapshot).persistent;
  expect(persistent.plan).toContainEqual({
    kind: 'persistent_retained',
    eventId: 'first',
  });
});

test('[EVT-07.recurring-edits] each field edit saves the whole occurrence with its other facts, and waits for the occurrence', () => {
  const { draft, snapshot } = recurringEventFixture(66, true);
  withOfficer(snapshot);
  draft.event.occurrences[2]!.rolls = { loss: roll(6, 3) };
  const original = structuredClone(draft.event.occurrences[2]!);
  const { view } = facts(draft, snapshot);
  const edit = vi.fn();
  const { result } = renderHook(() => useEventEdits(view, edit));

  // The first officer write names both the character and the skill.
  expect(
    result.current.patchOfficerCheck('second', { characterId: 'second' }),
  ).toBe('Choose the character and skill first.');
  expect(edit).not.toHaveBeenCalled();
  expect(
    result.current.patchOfficerCheck('second', {
      characterId: 'second',
      skill: 'diplomacy',
    }),
  ).toBeNull();
  expect(lastOccurrence(edit)).toEqual({
    ...original,
    officerCheck: { characterId: 'second', skill: 'diplomacy' },
  });

  // Unused rolls clear by name; others stay.
  draft.event.occurrences[2]!.officerCheck = {
    characterId: 'second',
    skill: 'diplomacy',
    skillBonus: 4,
  };
  draft.event.occurrences[2]!.rolls = { loss: roll(6, 3), check: roll(20, 5) };
  const next = facts(draft, snapshot).view;
  const edits = renderHook(() => useEventEdits(next, edit)).result.current;
  edits.patchOfficerCheck('second', { skillBonus: null, roll: roll(20, 9) });
  expect(lastOccurrence(edit).officerCheck).toEqual({
    characterId: 'second',
    skill: 'diplomacy',
    roll: roll(20, 9),
  });
  edits.clearRetained('second', 'rolls', { rolls: ['check'] });
  expect(lastOccurrence(edit).rolls).toEqual({ check: roll(20, 5) });
  edits.setLossRoll('second', null);
  expect(lastOccurrence(edit).rolls).toEqual({ check: roll(20, 5) });
  edits.setMitigation('second', 'unattempted');
  expect(lastOccurrence(edit)).toMatchObject({
    mitigation: 'unattempted',
    targets: original.targets,
  });
  // Let it happen for Rivalry Twice removes the officer check.
  edits.clearRetained('second', 'officerCheck');
  expect(lastOccurrence(edit)).not.toHaveProperty('officerCheck');

  // Nothing is sent before the accepted draft holds the occurrence.
  const pending = facts(draft, snapshot, new Set()).view;
  const refused = vi.fn();
  const blocked = renderHook(() => useEventEdits(pending, refused)).result
    .current;
  for (const result of [
    blocked.setLossRoll('second', roll(6, 1)),
    blocked.setMitigation('second', 'attempted'),
    blocked.patchOfficerCheck('second', {
      characterId: 'second',
      skill: 'bluff',
    }),
  ])
    expect(result).toBe('This event is not ready for its roll yet.');
  expect(refused).not.toHaveBeenCalled();
});
