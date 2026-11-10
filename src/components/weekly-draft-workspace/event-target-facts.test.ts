import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { resourceEventFixture } from '../../../tests/rules/resource-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { derivePhaseReadiness } from './phase-readiness';
import type { EventPanel, EventView } from './types';
import { useEventEdits } from './use-event-edits';

function facts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  snapshot.roster.teams[1] &&= {
    ...snapshot.roster.teams[1],
    name: 'Night Runners',
  };
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
  const view = eventView(draft, source, preview);
  const { phases } = derivePhaseReadiness(draft, source, preview);
  const phase = phases.find((entry) => entry.phase === 'event')!;
  const summary = phases.find((entry) => entry.phase === 'summary')!;
  return { view, phase, summary };
}
function item(view: EventView, eventId: string) {
  return view.occurrences.find(
    (entry) => entry.occurrence.eventId === eventId,
  )!;
}
function panel<F extends EventPanel['family']>(
  view: EventView,
  eventId: string,
  family: F,
) {
  const found = item(view, eventId).panel;
  expect(found?.family).toBe(family);
  return found as Extract<EventPanel, { family: F }>;
}
function hideSecondPerson(snapshot: UpkeepSnapshot) {
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'second',
  });
}
const messages = (phase: ReturnType<typeof facts>['phase']) =>
  phase.requirements.map((entry) => entry.message);

test('[EVT-07.sickness] Sickness names its team target, requires What happened and lists its own outcome', () => {
  const { draft, snapshot } = threatEventFixture(90);
  let { view } = facts(draft, snapshot);
  const sickness = panel(view, 'event', 'team');
  expect(sickness.eventType).toBe('sickness');
  expect(sickness.team).toMatchObject({
    label: 'Team that falls sick',
    hint: 'A random team.',
    selected: 'team',
    required: false,
  });
  expect(sickness.team!.choices.map((choice) => choice.label)).toEqual([
    'Team',
    'Night Runners',
  ]);
  expect(sickness.check).toBeNull();
  expect(item(view, 'event').optionalMitigation).toBe('unavailable');
  expect(sickness.whatHappened).toMatchObject({
    subjectId: 'event:event',
    required: true,
    acknowledgement: { outcome: 'The table records the result.' },
  });
  expect(sickness.outcomes).toEqual(['Team: Active → Disabled.']);

  delete draft.event.occurrences[0]!.targets;
  draft.acknowledgements = [];
  const next = facts(draft, snapshot);
  view = next.view;
  expect(panel(view, 'event', 'team').team).toMatchObject({
    selected: null,
    required: true,
  });
  expect(panel(view, 'event', 'team').whatHappened.required).toBe(true);
  expect(messages(next.phase)).toEqual(
    expect.arrayContaining([
      'Event 1 · Sickness: choose the team that falls sick.',
      'Event 1 · Sickness: record what happened.',
    ]),
  );
});

test('[EVT-10.sickness-twice] the Twice Sickness save is a mandatory Loyalty check row with its breakdown and result', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  let { view, phase } = facts(draft, snapshot);
  const twice = panel(view, 'second', 'team');
  expect(item(view, 'second').mode).toBe('twice');
  expect(item(view, 'second').optionalMitigation).toBe('unavailable');
  expect(twice.team?.hint).toBe('The same team as Event 1.1 · Sickness.');
  expect(
    twice.team?.choices.find((choice) => choice.value === 'team')?.description,
  ).toContain('Chosen in Event 1.1 · Sickness');
  expect(twice.check).toMatchObject({
    checkId: 'second:sickness',
    label: 'Loyalty check',
    legend: 'Loyalty DC 20',
    mandatory: true,
    total: 20,
    succeeded: true,
    resultText: 'The team stays, disabled.',
    required: false,
  });
  expect(twice.check!.breakdown.map((entry) => entry.label)).toContain(
    'Rank and focus',
  );
  // The first occurrence has no save.
  expect(panel(view, 'first', 'team').check).toBeNull();

  draft.event.occurrences[2]!.rolls = { check: roll(20, 16) };
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'second', 'team').check).toMatchObject({
    succeeded: false,
    resultText: 'The team is lost.',
  });
  expect(panel(view, 'second', 'team').outcomes).toContain('Team is lost.');

  delete draft.event.occurrences[2]!.rolls;
  const missing = facts(draft, snapshot);
  ({ view, phase } = missing);
  expect(panel(view, 'second', 'team').check?.required).toBe(true);
  // One line for the missing die, not one per engine code, in the Event
  // phase and in Review & confirm's required decisions.
  for (const readiness of [phase, missing.summary])
    expect(
      messages(readiness).filter((text) => text.includes('Loyalty check')),
    ).toEqual(['Event 1.2 · Sickness: enter the Loyalty check (d20).']);
});

test('[EVT-12.missing-in-action] Missing in Action prefers teams that acted and queues its absence and return', () => {
  const { draft, snapshot } = threatEventFixture(70);
  let { view, phase } = facts(draft, snapshot);
  const missing = panel(view, 'event', 'team');
  expect(missing.team?.label).toBe('Team that goes missing');
  expect(missing.team?.hint).toBe('A random team that acted this week.');
  expect(
    missing.team?.choices.map((choice) => choice.description.split(' · ')),
  ).toEqual([
    expect.arrayContaining(['Acted this week']),
    expect.arrayContaining(['Did not act this week']),
  ]);
  expect(missing.outcomes).toEqual([
    'Team: Active → Missing.',
    'Team is unavailable in week 41.',
    'Team returns at the end of week 41, active.',
  ]);
  draft.event.occurrences[0]!.targets = [
    { kind: 'team', teamId: 'second-team' },
  ];
  ({ phase } = facts(draft, snapshot));
  expect(messages(phase)).toContain(
    'Event 1 · Missing in Action: the chosen team did not act this week. Record a reasoned Rules Exception or choose a team that did.',
  );

  const twice = threatEventFixture(70, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  expect(panel(view, 'second', 'team').outcomes).toContain(
    'Team returns at the end of week 41, disabled.',
  );
});

test('[EVT-12.turn-around] Turn Around recovers disabled teams or asks for one team; a second one is independent', () => {
  const { draft, snapshot } = resourceEventFixture(30);
  let { view } = facts(draft, snapshot);
  expect(panel(view, 'event', 'team')).toMatchObject({
    eventType: 'turn_around',
    team: {
      label: 'Team that gains +2 on one check next Activity',
      selected: 'team',
    },
    outcomes: ['Team gains +2 on one check next Activity.'],
  });
  // Turn Around needs no outcome note.
  expect(panel(view, 'event', 'team').whatHappened.required).toBe(false);

  snapshot.roster.teams[1]!.status = 'disabled';
  ({ view } = facts(draft, snapshot));
  const recovering = panel(view, 'event', 'team');
  expect(recovering.outcomes).toEqual(['Night Runners: Disabled → Active.']);
  expect(recovering.team).toMatchObject({
    required: false,
    selected: null,
    choices: [],
    retained: [
      {
        value: 'team',
        reason: 'Not used: disabled teams recover instead.',
      },
    ],
  });

  const duplicate = resourceEventFixture(30, true);
  duplicate.snapshot.roster.teams[1]!.status = 'disabled';
  delete duplicate.draft.event.occurrences[2]!.targets;
  const both = facts(duplicate.draft, duplicate.snapshot);
  expect(item(both.view, 'second').mode).toBe('base');
  expect(panel(both.view, 'first', 'team').outcomes).toEqual([
    'Night Runners: Disabled → Active.',
  ]);
  expect(panel(both.view, 'second', 'team').team?.required).toBe(true);
  expect(messages(both.phase)).toContain(
    'Event 1.2 · Turn Around: choose the team that gains +2 on one check next activity.',
  );
});

test('[EVT-08.raid] Raid has one settlement, and every hidden person their own mitigation, check and capture roll', () => {
  const { draft, snapshot } = threatEventFixture(78);
  hideSecondPerson(snapshot);
  let { view, phase } = facts(draft, snapshot);
  let raid = panel(view, 'event', 'raid');
  expect(raid.settlement).toMatchObject({
    label: 'Settlement raided',
    selected: 'town',
    choices: [
      {
        value: 'town',
        label: 'Town',
        description: 'Active refuge · 2 hidden people',
      },
    ],
  });
  expect(raid.people.map((person) => [person.name, person.mitigation])).toEqual(
    [
      ['Wren Ashby', 'unattempted'],
      ['Nora Vell', 'unattempted'],
    ],
  );
  const rescue = `DC ${5 + snapshot.rank}`;
  expect(raid.outcomes).toEqual([
    'All refuges in Town deactivate.',
    'Wren Ashby is captured: without a successful Security check capture is certain.',
    `Wren Ashby can be recovered next week with Rescue Character at ${rescue}.`,
    'Nora Vell is captured: without a successful Security check capture is certain.',
    `Nora Vell can be recovered next week with Rescue Character at ${rescue}.`,
  ]);

  // Wren attempts and succeeds; Nora lets it happen. Someone recorded
  // elsewhere stays visible until removed.
  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 19) },
    },
    {
      target: { kind: 'character', characterId: 'second' },
      mitigation: 'unattempted',
    },
    { target: { kind: 'character', characterId: 'gone' } },
  ];
  ({ view, phase } = facts(draft, snapshot));
  raid = panel(view, 'event', 'raid');
  const [wren, nora] = raid.people;
  expect(wren).toMatchObject({
    mitigation: 'attempted',
    explicit: true,
    check: {
      label: 'Security check for Wren Ashby',
      legend: 'Security DC 20',
      mandatory: false,
      succeeded: true,
      resultText: 'Capture chance falls to 50%.',
    },
    capture: { applies: true, chance: 50, required: true },
  });
  expect(nora).toMatchObject({
    mitigation: 'unattempted',
    explicit: true,
    capture: { applies: false, chance: 100 },
  });
  expect(raid.retainedPeople).toMatchObject([
    { index: 2, value: 'gone', reason: expect.stringContaining('Remove') },
  ]);
  expect(messages(phase)).toEqual(
    expect.arrayContaining([
      'Event 1 · Raid: enter the capture roll for Wren Ashby (d100).',
      'Event 1 · Raid: a recorded Security check names someone not hidden in this refuge. Remove it.',
    ]),
  );
});

test('[EVT-08.raid-event-level] an event-level mitigation or check is no person’s choice: each person is left to happen, and both are listed as unused inputs to clear', () => {
  // Ruleset Version 9: a Theft or Sickness corrected to Raid keeps these, and
  // they no longer stand in for every person as they did before.
  const { draft, snapshot } = threatEventFixture(78);
  hideSecondPerson(snapshot);
  const event = draft.event.occurrences[0]!;
  event.mitigation = 'attempted';
  event.rolls = { check: roll(20, 20) };
  const { view, phase } = facts(draft, snapshot);
  const raid = panel(view, 'event', 'raid');
  expect(
    raid.people.map((person) => [person.mitigation, person.explicit]),
  ).toEqual([
    ['unattempted', false],
    ['unattempted', false],
  ]);
  expect(messages(phase)).not.toEqual(
    expect.arrayContaining([expect.stringContaining('Security check')]),
  );
  expect(raid.retained.map((entry) => [entry.field, entry.value])).toEqual([
    ['rolls', 'check roll'],
    ['mitigation', 'Attempt it'],
  ]);
  expect(raid.keep).toEqual({ targets: ['settlement'], rolls: [] });
});

test('[EVT-07.edits] target, per-person and What happened edits keep every other recorded field', () => {
  const { draft, snapshot } = threatEventFixture(78);
  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'character', characterId: 'other' },
      rolls: { check: roll(20, 4) },
    },
  ];
  const { view } = facts(draft, snapshot);
  const edit = vi.fn();
  const { result } = renderHook(() => useEventEdits(view, edit));
  const last = () => edit.mock.lastCall![0].occurrence;
  const pc = { kind: 'character' as const, characterId: 'pc' };

  result.current.setTargetCheck('event', pc, { mitigation: 'attempted' });
  expect(last().targetChecks).toEqual([
    draft.event.occurrences[0]!.targetChecks[0],
    { target: pc, mitigation: 'attempted' },
  ]);
  expect(last().targets).toEqual([
    { kind: 'settlement', settlementId: 'town' },
  ]);
  // Clearing the other person's only die leaves nothing of their entry.
  result.current.setTargetCheck(
    'event',
    { kind: 'character', characterId: 'other' },
    { check: null },
  );
  expect(last()).not.toHaveProperty('targetChecks');
  result.current.removeTargetCheck('event', 0);
  expect(last()).not.toHaveProperty('targetChecks');
  result.current.setTargets('event', 'settlement', []);
  expect(last()).not.toHaveProperty('targets');
  result.current.setCheckRoll('event', roll(20, 11));
  expect(last().rolls).toEqual({ check: roll(20, 11) });
  expect(result.current.saveWhatHappened('event', '  ')).toBeTruthy();
  expect(result.current.saveWhatHappened('event', 'Phaendar burned')).toBe(
    null,
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'acknowledge',
    acknowledgement: {
      acknowledgementId: 'receipt:event',
      subjectId: 'event:event',
      outcome: 'Phaendar burned',
    },
  });
});
