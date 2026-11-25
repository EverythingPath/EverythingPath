import { expect, test } from 'vitest';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { occurrence } from '../../tests/rules/event-selection-fixture';
import {
  childEvent as child,
  guaranteedWeek,
} from '../../tests/rules/candidate-reroll-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import {
  CANONICAL_WEEKLY_RULESET_VERSION,
  prepareCanonicalResolutionRecord,
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { projectActivityAndEventShaping as select } from './rules-event-shaping';
import { projectActivityAndEvents } from './rules-event-outcomes';

// Since the candidate reroll Ruleset Version (#191, approved in #108) a Roll
// Twice on an Activity event candidate, chosen or not, is rerolled in its own
// die like a child's or an automatic event's. Under earlier versions a chosen
// candidate's Roll Twice expanded into two events.

const preview = (input: ReturnType<typeof guaranteedWeek>) =>
  projectWeeklyDraft(structuredClone(input));

test('[rules.A10.reroll-version] a rerolled candidate week previews and records under the current Ruleset Version', () => {
  const input = guaranteedWeek(
    [occurrence('pick', 10), occurrence('other', 46)],
    'pick',
  );
  const record = prepareCanonicalResolutionRecord(
    resolveCanonicalWeeklyDraft(structuredClone(input)),
    'record',
  );
  expect(record.rulesetVersion).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
  expect(preview(input).rulesetVersion).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
});

test('[rules.A10.unchosen-reroll] a candidate that is not chosen still needs its Roll Twice rerolled before the week is complete', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  choice.candidates![1]!.tableRoll = roll(100, 51);
  let event = select(draft, snapshot).event;
  expect(event.ready).toBe(false);
  expect(event.requirements).toEqual(['theft:replacement:1']);
  expect(event.positions).toContainEqual({
    kind: 'replacement',
    parentEventId: 'theft',
    count: 1,
    eventIds: [],
    reroll: true,
  });
  expect(event.selected.map((entry) => entry.eventId)).toEqual(['raid']);
  // A child recorded under it is not that reroll.
  choice.candidates!.push(
    child('theft/replacement/1', 74, 'replacement', 'theft'),
  );
  expect(select(draft, snapshot).event.requirements).toEqual([
    'theft:replacement:1',
  ]);
  choice.candidates!.pop();
  choice.candidates![1]!.tableRoll = roll(100, 74);
  event = select(draft, snapshot).event;
  expect(event.ready).toBe(true);
  expect(event.selected.map((entry) => entry.eventId)).toEqual(['raid']);
});

test('[rules.A10.reroll-ineligible-chain] a candidate replacement for an event that cannot occur rerolls a Roll Twice in its own die, chosen or not', () => {
  for (const chosen of [true, false]) {
    const { draft, snapshot, choice } = eventActionFixture();
    if (choice.actionId !== 'guarantee_event') throw Error('fixture');
    // Without an active refuge a Raid cannot occur.
    snapshot.settlements[0]!.refugeActivatedWeek = null;
    snapshot.settlements[0]!.refugeActiveUntilWeek = null;
    choice.selectedEventId = chosen ? 'raid' : 'theft';
    let event = select(draft, snapshot).event;
    expect(event.requirements).toContain('raid:replacement:1');
    choice.candidates!.push(
      child('raid/replacement/1', 50, 'replacement', 'raid'),
    );
    event = select(draft, snapshot).event;
    expect(event.requirements).toContain('raid/replacement/1:replacement:1');
    expect(event.requirements).not.toContain('raid/replacement/1:roll_twice:2');
    expect(event.positions).toContainEqual({
      kind: 'replacement',
      parentEventId: 'raid/replacement/1',
      count: 1,
      eventIds: [],
      reroll: true,
    });
    choice.candidates!.at(-1)!.tableRoll = roll(100, 10);
    event = select(draft, snapshot).event;
    expect(event.ready, `chosen: ${chosen}`).toBe(true);
    expect(event.selected.map((entry) => entry.eventId)).toEqual([
      chosen ? 'raid/replacement/1' : 'theft',
    ]);
  }
});

test('[rules.A10.reroll-exception] an eligibility Rules Exception keeps an event that cannot occur, but never keeps a candidate Roll Twice', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  choice.candidates![1]!.tableRoll = roll(100, 50);
  draft.rulesExceptions.push({
    exceptionId: 'keep',
    subjectId: 'theft',
    ruleId: 'event-eligibility',
    reason: 'The table keeps it',
  });
  for (const selectedEventId of ['raid', 'theft']) {
    choice.selectedEventId = selectedEventId;
    expect(select(draft, snapshot).event.requirements).toContain(
      'theft:replacement:1',
    );
  }
  // The same exception keeps a Raid that cannot occur, without a replacement.
  snapshot.settlements[0]!.refugeActivatedWeek = null;
  snapshot.settlements[0]!.refugeActiveUntilWeek = null;
  choice.candidates![0]!.tableRoll = roll(100, 10);
  choice.candidates![1]!.tableRoll = roll(100, 78);
  const event = select(draft, snapshot).event;
  expect(event.ready).toBe(true);
  expect(event.warnings).toContain('theft:event-eligibility');
  expect(event.selected.map((entry) => entry.eventId)).toEqual(['theft']);
});

test('[rules.A10.reroll-dynamic] a chosen candidate that can no longer occur after earlier events rerolls its replacement Roll Twice in place', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  snapshot.roster.teams = snapshot.roster.teams.slice(0, 1);
  // Two automatic Sickness events lose the only team before the candidate.
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'storm',
        sourceId: 'storm',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'automatic_events', count: 2 },
      },
    ],
  };
  draft.event.occurrences = ['auto-1', 'auto-2'].map((eventId) => ({
    ...occurrence(eventId, 90, { kind: 'automatic', sourceId: 'storm' }),
    targets: [{ kind: 'team' as const, teamId: 'team' }],
  }));
  draft.event.occurrences[1]!.rolls = { check: roll(20, 2) };
  choice.candidates![0]!.tableRoll = roll(100, 90);
  choice.candidates![0]!.targets = [{ kind: 'team', teamId: 'team' }];
  for (const eventId of ['auto-1', 'auto-2', 'raid'])
    draft.acknowledgements.push({
      acknowledgementId: eventId,
      subjectId: `event:${eventId}`,
      outcome: 'Random team recorded',
    });
  let event = projectActivityAndEvents(draft, snapshot).event;
  expect(event.requirements).toContain('raid:replacement:1');
  choice.candidates!.push(
    child('raid/replacement/1', 50, 'replacement', 'raid'),
  );
  event = projectActivityAndEvents(draft, snapshot).event;
  expect(event.requirements).toContain('raid/replacement/1:replacement:1');
  expect(event.requirements).not.toContain('raid/replacement/1:roll_twice:2');
});
