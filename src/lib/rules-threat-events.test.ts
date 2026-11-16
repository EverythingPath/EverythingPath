import { expect, test } from 'vitest';
import { projectActivityAndEvents as project } from './rules-event-outcomes';
import { projectUpkeep } from './rules-upkeep';
import { projectActivity } from './rules-activity';
import { threatEventFixture } from '../../tests/rules/threat-event-fixture';
import { characterFixture } from '../../tests/rules/character-fixture';
import { occurrence } from '../../tests/rules/event-selection-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';
import { projectWeeklyDraft } from './canonical-weekly-resolution';

test('[rules.EV03.loss] cache loss affects only the selected cache and its contents including a planned retrieval', () => {
  const { draft, snapshot } = threatEventFixture();
  draft.event.occurrences[0]!.targets = [
    { kind: 'cache', cacheId: 'returning' },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.caches.map((cache) => cache.status)).toEqual([
    'hidden',
    'lost',
  ]);
  expect(result.outcome.economy?.items.map((item) => item.location)).toEqual([
    'cache',
    'lost',
  ]);
});
test('[rules.EV03.mitigate] successful mitigation with two caches retrieves only its target and preserves the other', () => {
  const { draft, snapshot } = threatEventFixture();
  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'cache' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 12) },
    },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(13);
  expect(result.outcome.economy?.caches.map((cache) => cache.status)).toEqual([
    'retrieved',
    'returning',
  ]);
  expect(result.outcome.economy?.items.map((item) => item.location)).toEqual([
    'held',
    'returning',
  ]);
});
test('[rules.EV03.inputs] missing attempted mitigation preserves resources while explicit unattempted applies loss', () => {
  const { draft, snapshot } = threatEventFixture();
  const event = draft.event.occurrences[0]!;
  const input = {
    target: { kind: 'cache' as const, cacheId: 'cache' },
    mitigation: 'attempted' as 'attempted' | 'unattempted',
  };
  event.targetChecks = [input];
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(false);
  expect(result.outcome.economy).toEqual(snapshot.economy);
  input.mitigation = 'unattempted';
  result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.caches[0]?.status).toBe('lost');
  event.targets = [{ kind: 'cache', cacheId: 'foreign' }];
  expect(project(draft, snapshot).event.requirements).toContain('event:cache');
});
test('[rules.EV03.twice] second occurrence discovers all remaining caches and has independent mitigation', () => {
  const { draft, snapshot } = threatEventFixture(62, true);
  const second = draft.event.occurrences[2]!;
  second.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'returning' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 12) },
    },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.caches.map((cache) => cache.status)).toEqual([
    'lost',
    'retrieved',
  ]);
  expect(result.outcome.economy?.items.map((item) => item.location)).toEqual([
    'lost',
    'held',
  ]);
  snapshot.economy!.caches = snapshot.economy!.caches.slice(0, 1);
  second.targetChecks = [];
  expect(project(draft, snapshot).event.ready).toBe(true);
});
test('[rules.EV03.modifiers] Overseer and queued modifiers enter an event check exactly once', () => {
  const { draft, snapshot } = threatEventFixture();
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.intelligence = 14;
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'penalty',
        sourceId: 'penalty',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'check_modifier', check: 'secrecy', value: -2 },
      },
    ],
  };
  const event = draft.event.occurrences[0]!;
  event.overseerCharacterId = 'pc';
  const check = roll(20, 11);
  check.modifiers = [
    'rank-focus',
    'officers',
    'overseer-support',
    'queued:penalty',
  ].map((sourceId) => ({ sourceId, value: 100, reason: 'Old display' }));
  event.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'cache' },
      mitigation: 'attempted',
      rolls: { check },
    },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(13);
  expect(result.outcome.economy?.caches[0]?.status).toBe('retrieved');
});
test('[rules.EV10.base] Invasion computes APL plus one and records the table encounter', () => {
  const { draft, snapshot } = threatEventFixture(82);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(
    result.plan.find((change) => change.kind === 'event_encounter'),
  ).toMatchObject({
    averagePartyLevel: 7,
    challengeRating: 8,
    acknowledgement: { subjectId: 'event:event' },
  });
});
test('[rules.EV10.inputs] Invasion needs an explicit APL and encounter acknowledgement', () => {
  const { draft, snapshot } = threatEventFixture(82);
  delete draft.event.occurrences[0]!.averagePartyLevel;
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    requirements: ['event:acknowledgement', 'event:average-party-level'],
  });
});
test('[rules.EV10.duplicate] two Invasions require two independent encounters and receipts', () => {
  const { draft, snapshot } = threatEventFixture(82, true);
  expect(
    project(draft, snapshot).event.plan.filter(
      (change) => change.kind === 'event_encounter',
    ),
  ).toHaveLength(2);
  draft.acknowledgements = draft.acknowledgements.filter(
    (ack) => ack.subjectId !== 'event:second',
  );
  expect(project(draft, snapshot).event.requirements).toContain(
    'second:acknowledgement',
  );
});
test('[rules.EV13.base] Missing in Action targets an operated team and makes it unavailable through the following Activity', () => {
  const { draft, snapshot } = threatEventFixture(70);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams[0]?.status).toBe('missing');
  expect(result.queuedEffects.map((effect) => effect.effect)).toEqual([
    { kind: 'team_unavailable', teamId: 'team' },
    { kind: 'team_return', teamId: 'team', status: 'active' },
  ]);
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  expect(projectActivity(draft, result.outcome).requirements).toContain(
    'work:team-unavailable:exception',
  );
});
test('[rules.EV13.twice] duplicate Missing in Action returns the same team disabled at the end of next week', () => {
  const { draft, snapshot } = threatEventFixture(70, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(
    result.queuedEffects.filter(
      (effect) => effect.effect.kind === 'team_return',
    ),
  ).toMatchObject([
    { startsWeek: 41, endsWeek: 41, effect: { status: 'disabled' } },
  ]);
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  draft.activity.slots = [];
  draft.event = { chanceRoll: roll(100, 100), occurrences: [] };
  const next = project(draft, result.outcome).event;
  expect(next.ready).toBe(true);
  expect(next.outcome.roster.teams[0]?.status).toBe('disabled');
});
test('[rules.EV13.inputs] nonexistent and unoperated teams never silently stand in for a random eligible target', () => {
  const { draft, snapshot } = threatEventFixture(70);
  const event = draft.event.occurrences[0]!;
  event.targets = [{ kind: 'team', teamId: 'foreign' }];
  expect(project(draft, snapshot).event.requirements).toContain('event:team');
  event.targets = [{ kind: 'team', teamId: 'second-team' }];
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:team-operated:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'team',
    subjectId: 'event',
    ruleId: 'team-operated',
    reason: 'Narrative scouting',
  });
  expect(project(draft, snapshot).event.ready).toBe(true);
});
test('[rules.EV13.no-early-return] queued event absence cannot use ordinary Upkeep recovery to return early', () => {
  const { draft, snapshot } = threatEventFixture(70);
  const result = project(draft, snapshot).event;
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  draft.upkeep.teamDecisions = [
    { teamId: 'team', decision: 'recover', roll: roll(20, 20) },
  ];
  const upkeep = projectUpkeep(draft, result.outcome);
  expect(upkeep.outcome.roster.teams[0]?.status).toBe('missing');
  expect(
    upkeep.plan.some(
      (change) => change.kind === 'team_status' && change.teamId === 'team',
    ),
  ).toBe(false);
});
test('[rules.EV13.new-absence] a new absence supersedes an old scheduled return in the same week', () => {
  const { draft, snapshot } = threatEventFixture(70);
  snapshot.roster.teams[0]!.status = 'missing';
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'old',
        sourceId: 'old',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'team_return', teamId: 'team', status: 'active' },
      },
    ],
  };
  draft.activity.slots = [];
  for (const ruleId of ['event-eligibility', 'team-operated'])
    draft.rulesExceptions.push({
      exceptionId: ruleId,
      subjectId: 'event',
      ruleId,
      reason: 'A fresh absence',
    });
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams[0]?.status).toBe('missing');
});
test('[rules.EV15.base] Raid deactivates only the selected refuge and captures only its hidden people with rescue provenance', () => {
  const { draft, snapshot } = threatEventFixture(78);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'safe',
    name: 'Safe',
  });
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'elsewhere',
    location: { kind: 'refuge', settlementId: 'safe' },
  });
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(
    result.outcome.settlements.map((town) => town.refugeActiveUntilWeek),
  ).toEqual([null, 41]);
  expect(result.outcome.characterActions?.people).toMatchObject([
    { status: 'captured', capture: { source: 'raid', week: 40 } },
    { status: 'hidden', capture: null },
  ]);
});
test('[rules.EV15.mitigate] each successful Security check reduces only its own capture chance to fifty percent', () => {
  const { draft, snapshot } = threatEventFixture(78);
  const event = draft.event.occurrences[0]!;
  event.targetChecks = [
    {
      target: { kind: 'character', characterId: 'pc' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 19), loss: roll(100, 51) },
    },
  ];
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(20);
  expect(result.outcome.characterActions?.people[0]?.status).toBe('hidden');
  event.targetChecks[0]!.rolls!.loss = roll(100, 50);
  result = project(draft, snapshot).event;
  expect(result.outcome.characterActions?.people[0]?.status).toBe('captured');
});
test('[rules.EV15.inputs] each attempted Raid mitigation requires independent raw check and capture dice', () => {
  const { draft, snapshot } = threatEventFixture(78);
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'second',
  });
  const event = draft.event.occurrences[0]!;
  event.targetChecks = ['pc', 'second'].map((characterId) => ({
    target: { kind: 'character', characterId },
    mitigation: 'attempted',
    rolls: { loss: roll(100, 99) },
  }));
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(false);
  expect(result.requirements).toContain('event:pc:mitigation:1d20');
  expect(result.requirements).toContain('event:second:mitigation:1d20');
  expect(
    result.outcome.characterActions?.people.every(
      (person) => person.status === 'hidden',
    ),
  ).toBe(true);
  event.targetChecks[0]!.rolls!.check = roll(20, 19);
  delete event.targetChecks[0]!.rolls!.loss;
  event.targetChecks[1]!.mitigation = 'unattempted';
  result = project(draft, snapshot).event;
  expect(result.requirements).toContain('event:pc:capture:1d100');
  expect(result.outcome.characterActions?.people[1]?.status).toBe('captured');
});
test('[rules.EV18.base] Sickness disables only its recorded random target', () => {
  const { draft, snapshot } = threatEventFixture(90);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams.map((team) => team.status)).toEqual([
    'disabled',
    'active',
  ]);
});
test('[rules.EV18.twice] Sickness Twice preserves base disabled on Loyalty twenty and loses the team at nineteen', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(20);
  expect(result.outcome.roster.teams[0]?.status).toBe('disabled');
  draft.event.occurrences[2]!.rolls = { check: roll(20, 16) };
  result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams.map((team) => team.teamId)).toEqual([
    'second-team',
  ]);
});
test('[rules.EV18.inputs] missing mandatory Sickness save cannot silently remove a team', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  delete draft.event.occurrences[2]!.rolls;
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(false);
  expect(result.outcome.roster.teams.map((team) => team.teamId)).toEqual([
    'team',
    'second-team',
  ]);
});
test('[rules.EV21.base] Turncoat loss is raw d6 plus current rank once', () => {
  const { draft, snapshot } = threatEventFixture(58);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    outcome: { training: 23, rank: 3 },
  });
  delete draft.event.occurrences[0]!.rolls;
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    outcome: { training: 30 },
  });
});
test('[rules.EV21.twice] successful officer Diplomacy prevents defection but still blocks next Activity', () => {
  const { draft, snapshot } = threatEventFixture(58, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.training).toBe(23);
  expect(result.outcome.roster.teams).toHaveLength(2);
  expect(
    result.plan.find((change) => change.kind === 'event_officer_check'),
  ).toMatchObject({ dc: 13, total: 13, succeeded: true });
  expect(result.queuedEffects).toMatchObject([
    {
      startsWeek: 41,
      endsWeek: 41,
      effect: { kind: 'team_unavailable', teamId: 'team' },
    },
  ]);
});
test('[rules.EV21.inputs] absent officer dice, bonus, target or correct skill blocks defection until supplied', () => {
  const { draft, snapshot } = threatEventFixture(58, true);
  const event = draft.event.occurrences[2]!;
  delete event.officerCheck!.roll;
  expect(project(draft, snapshot).event).toMatchObject({ ready: false });
  expect(project(draft, snapshot).event.outcome.roster.teams).toHaveLength(2);
  event.officerCheck!.roll = roll(20, 9);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams.map((team) => team.teamId)).toEqual([
    'second-team',
  ]);
  event.officerCheck!.skill = 'bluff';
  expect(project(draft, snapshot).event.requirements).toContain(
    'second:officer-skill:exception',
  );
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
});
test('[rules.E03.outcome-replacement] losing the last eligible team requests and consumes a replacement for a later team event', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  snapshot.roster.teams = snapshot.roster.teams.slice(0, 1);
  draft.event.occurrences[2]!.rolls = { check: roll(20, 16) };
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'auto',
        sourceId: 'auto',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  draft.event.occurrences.unshift(
    occurrence('auto', 90, { kind: 'automatic', sourceId: 'auto' }),
  );
  draft.event.occurrences[0]!.targets = [{ kind: 'team', teamId: 'team' }];
  draft.acknowledgements.push({
    acknowledgementId: 'auto',
    subjectId: 'event:auto',
    outcome: 'Random target recorded',
  });
  // The normal first Sickness is now the save; the next one follows the loss.
  draft.event.occurrences[2]!.rolls = { check: roll(20, 16) };
  let result = project(draft, snapshot).event;
  expect(result.requirements).toContain('second:replacement:1');
  draft.event.occurrences.push(
    occurrence('replacement', 10, {
      kind: 'replacement',
      parentEventId: 'second',
    }),
  );
  result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.selected.at(-1)?.eventId).toBe('replacement');
  expect(result.outcome.training).toBe(33);
});

test.each([
  ['EV03', 62],
  ['EV13', 70],
  ['EV15', 78],
] as const)(
  '[rules.%s.empty] no eligible targets requires a replacement',
  (_id, value) => {
    const { draft, snapshot } = threatEventFixture(value);
    draft.activity.slots = [];
    snapshot.economy!.caches = [];
    snapshot.settlements = [];
    delete draft.activity.operatingSettlementId;
    expect(project(draft, snapshot).event.requirements).toContain(
      'event:replacement:1',
    );
  },
);
test('[rules.EV15.rescue] captured Raid source grants the special rescue DC only in the following Activity', () => {
  const { draft, snapshot } = threatEventFixture(78);
  const raided = project(draft, snapshot).event.outcome;
  const rescue = characterFixture('rescue_character').choice;
  raided.roster.teams[0]!.teamType = 'specialists';
  draft.activity.slots = [{ slotId: 'rescue', choice: rescue }];
  draft.week = 41;
  expect(
    projectActivity(draft, raided).plan.find(
      (change) => change.kind === 'rescue_result',
    ),
  ).toMatchObject({ dc: 8, succeeded: true });
  draft.week = 42;
  expect(
    projectActivity(draft, raided).plan.find(
      (change) => change.kind === 'rescue_result',
    ),
  ).toMatchObject({ dc: 20 });
});
test('[rules.EV18.ordering] later Turn Around observes and heals an earlier Sickness', () => {
  const { draft, snapshot } = threatEventFixture(90, true);
  draft.event.occurrences[2]!.tableRoll = roll(100, 30);
  draft.event.occurrences[2]!.targets = [];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams[0]?.status).toBe('active');
  expect(result.outcome.bonuses).toEqual([]);
});
test('[rules.E03.replacement-sabotage] dynamic replacement retains its reactive choice and negation instead of applying its reward', () => {
  const { draft, snapshot } = threatEventFixture(78, true);
  const replacement = occurrence('replacement', 10, {
    kind: 'replacement',
    parentEventId: 'second',
  });
  replacement.sabotage = {
    choiceId: 'stop',
    teamId: 'team',
    check: 'secrecy',
    rolls: { check: roll(20, 20), notoriety: roll(6, 2) },
  };
  draft.acknowledgements.push({
    acknowledgementId: 'stop',
    subjectId: 'sabotage:replacement:stop',
    outcome: 'The event was stopped',
  });
  draft.event.occurrences.push(replacement);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.negatedEventIds).toContain('replacement');
  expect(result.outcome.training).toBe(30);
  expect(result.outcome.notoriety).toBe(12);
  delete replacement.sabotage.rolls!.check;
  expect(project(draft, snapshot).event.ready).toBe(false);
});
test('[rules.EV15.references] foreign per-person mitigation targets are not silently ignored', () => {
  const { draft, snapshot } = threatEventFixture(78);
  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'character', characterId: 'foreign' },
      mitigation: 'unattempted',
    },
  ];
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:mitigation-target',
  );
});

test('[rules.E03.replacement-duplicates] inserting a replacement reclassifies later duplicates against actual event order', () => {
  const { draft, snapshot } = threatEventFixture(78, true);
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'auto',
        sourceId: 'auto',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  const automatic = occurrence('automatic', 78, {
    kind: 'automatic',
    sourceId: 'auto',
  });
  automatic.targets = [{ kind: 'settlement', settlementId: 'town' }];
  draft.event.occurrences.unshift(automatic);
  draft.acknowledgements.push({
    acknowledgementId: 'automatic',
    subjectId: 'event:automatic',
    outcome: 'Raid recorded',
  });
  draft.event.occurrences[3]!.tableRoll = roll(100, 34);
  const replacement = occurrence('replacement', 34, {
    kind: 'replacement',
    parentEventId: 'first',
  });
  replacement.targets = [{ kind: 'settlement', settlementId: 'town' }];
  draft.event.occurrences.push(replacement);
  draft.acknowledgements.push({
    acknowledgementId: 'replacement',
    subjectId: 'event:replacement',
    outcome: 'Festival recorded',
  });
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toHaveLength(1);
  expect(result.outcome.eventBenefits?.skills[0]?.value).toBe(5);
  expect(result.dispatch.map((entry) => entry.mode)).toEqual([
    'base',
    'base',
    'twice',
  ]);
});

test('[rules.O04.event-scope] selecting Overseer on a Raid helps every check of that occurrence once, its reaction and each person alike', () => {
  const { draft, snapshot } = threatEventFixture(78);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.intelligence = 18;
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'other',
  });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'other',
  });
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'other',
  });
  const event = draft.event.occurrences[0]!;
  event.overseerCharacterId = 'pc';
  event.targetChecks = ['pc', 'other'].map((characterId) => ({
    target: { kind: 'character', characterId },
    mitigation: 'attempted',
    rolls: { check: roll(20, 16), loss: roll(100, 51) },
  }));
  event.sabotage = {
    choiceId: 'reaction',
    teamId: 'team',
    check: 'secrecy',
    rolls: { check: roll(20, 2), notoriety: roll(6, 1) },
  };
  event.sabotage.rolls!.check!.modifiers = [
    {
      sourceId: 'overseer-support',
      value: 99,
      reason: 'Previously entered bonus',
    },
  ];
  draft.acknowledgements.push({
    acknowledgementId: 'reacted',
    subjectId: 'sabotage:event:reaction',
    outcome: 'Attempted disruption',
  });
  const result = project(draft, snapshot).event;
  expect(result.requirements).toEqual([]);
  expect(result.ready).toBe(true);
  expect(result.checks.map((check) => check.total)).toEqual([11, 20, 20]);
  expect(
    result.checks.map((check) =>
      check.modifiers
        .filter((modifier) => modifier.source === 'overseer-support')
        .map((modifier) => modifier.value),
    ),
  ).toEqual([[4], [2], [2]]);
  expect(
    result.outcome.characterActions!.people.map((person) => person.status),
  ).toEqual(['hidden', 'hidden']);
  expect(result.checkUsage.overseerEventId).toBe('event');
});

test('[rules.O04.persistent-selection] a support choice on a carried event’s mitigation decision applies to its Persistent check', () => {
  const { draft, snapshot } = threatEventFixture(90);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.constitution = 16;
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'carried',
        eventType: 'theft',
        startedWeek: draft.week - 1,
        order: 0,
        targets: [],
      },
    ],
  };
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'carried',
      overseerCharacterId: 'pc',
      rolls: { check: roll(20, 12) },
    },
  ];
  const persistent = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  }).phases!.persistent;
  const check = persistent.checks.find(
    (entry) => entry.checkId === 'carried:mitigation',
  )!;
  expect(
    check.modifiers.filter(
      (modifier) => modifier.source === 'overseer-support',
    ),
  ).toHaveLength(1);
  expect(
    persistent.requirements.filter((code) => code.startsWith('carried:')),
  ).toEqual([]);
  expect(persistent.plan).toContainEqual(
    expect.objectContaining({
      kind: 'persistent_mitigation',
      eventId: 'carried',
    }),
  );
});
