import { expect, test } from 'vitest';
import { projectActivityAndEventShaping as project } from './rules-event-shaping';
import {
  eventSelectionFixture,
  occurrence,
  pair,
} from '../../tests/rules/event-selection-fixture';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';

test('[rules.E01.bounds] projected chance clamps low and high notoriety after carry and queued modifiers', () => {
  for (const [notoriety, expected] of [
    [-10, 10],
    [9, 10],
    [10, 10],
    [95, 95],
    [96, 95],
    [100, 95],
  ]) {
    const { draft, snapshot } = eventSelectionFixture();
    snapshot.notoriety = notoriety!;
    draft.event.chanceRoll = roll(100, 100);
    expect(project(draft, snapshot).event).toMatchObject({
      ready: true,
      chance: expected,
    });
  }
});
test('[rules.E01.trigger] below chance triggers while equal and above do not; chance roll is required', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.notoriety = 20;
  draft.event.occurrences = [occurrence('event', 10)];
  for (const value of [19, 20, 21]) {
    draft.event.chanceRoll = roll(100, value);
    const result = project(draft, snapshot).event;
    expect(result.ready).toBe(true);
    expect(result.selected.length).toBe(value < 20 ? 1 : 0);
  }
  delete draft.event.chanceRoll;
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    nextUneventfulCarry: null,
    requirements: ['event:chance:1d100'],
  });
});
test('[rules.E01.settlement] operating reputation modifies the chance roll, not the chance or the table roll', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.settlements = economyFixture('earn_gold').snapshot.settlements;
  draft.activity.operatingSettlementId = 'town';
  draft.event.chanceRoll = roll(100, 12);
  draft.event.occurrences = [occurrence('event', 15)];
  const town = snapshot.settlements[0]!;
  for (const [reputation, chanceModifier, selected] of [
    ['Indifferent', 0, false],
    ['Friendly', -5, true],
    ['Unfriendly', 5, false],
  ] as const) {
    town.reputation = reputation;
    const result = project(draft, snapshot).event;
    expect(result.ready).toBe(true);
    expect(result.chance).toBe(10);
    expect(result.chanceModifier).toBe(chanceModifier);
    expect(result.selected.map((event) => event.eventType)).toEqual(
      selected ? ['night_ops'] : [],
    );
  }
  town.reputation = null;
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:operating-settlement',
  );
});
test('[rules.E01.recompute] removing an upstream guarantee changes cost, notoriety and required event rolls', () => {
  const { draft, snapshot } = eventActionFixture();
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    chance: 13,
    guaranteed: true,
  });
  draft.activity.slots[0]!.choice = null;
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    chance: 10,
    guaranteed: false,
    selected: [],
  });
});
test('[rules.E05.carry] carry changes chance once rather than the percentile roll', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.context = { ...draft.context, uneventfulCarry: true };
  draft.event.chanceRoll = roll(100, 12);
  draft.event.occurrences = [occurrence('event', 10)];
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    chance: 13,
    carryModifier: 3,
    nextUneventfulCarry: false,
    selected: [{ eventId: 'event' }],
  });
});
test('[rules.E05.consecutive] consecutive quiet weeks carry a boolean and never accumulate rank', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.chanceRoll = roll(100, 100);
  for (let week = 0; week < 4; week++) {
    const result = project(draft, snapshot).event;
    expect(result.chance).toBe(week === 0 ? 10 : 13);
    expect(result.nextUneventfulCarry).toBe(true);
    draft.context = {
      ...draft.context,
      uneventfulCarry: result.nextUneventfulCarry!,
    };
    draft.week++;
  }
});
test('[rules.E05.rank-change] carry uses this projected rank rather than the previous rank', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.context = { ...draft.context, uneventfulCarry: true };
  draft.event.chanceRoll = roll(100, 100);
  snapshot.rank = 7;
  expect(project(draft, snapshot).event).toMatchObject({
    chance: 17,
    carryModifier: 7,
  });
});
test('[rules.E05.exclusions] first-use metadata, forced calm, storms and automatic events exclude carry', () => {
  for (const kind of [
    'first',
    'forced',
    'storm',
    'automatic',
    'ordinary-calm',
  ] as const) {
    const { draft, snapshot } = eventSelectionFixture();
    draft.event.chanceRoll = roll(100, 100);
    if (kind === 'first')
      draft.context = { ...draft.context, firstMilitiaWeek: true };
    if (kind === 'forced' || kind === 'automatic')
      draft.context = {
        ...draft.context,
        queuedEffects: [
          {
            effectId: 'queued',
            sourceId: 'storm',
            startsWeek: 40,
            endsWeek: 40,
            effect:
              kind === 'forced'
                ? { kind: 'all_is_calm' }
                : { kind: 'automatic_events', count: 1 },
          },
        ],
      };
    if (kind === 'automatic')
      draft.event.occurrences = [
        occurrence('auto', 46, { kind: 'automatic', sourceId: 'storm' }),
      ];
    if (kind === 'storm' || kind === 'ordinary-calm') {
      draft.event.chanceRoll = roll(100, 1);
      draft.event.occurrences = [
        occurrence('event', kind === 'storm' ? 54 : 46),
      ];
    }
    expect(project(draft, snapshot).event, kind).toMatchObject({
      ready: true,
      nextUneventfulCarry: kind === 'ordinary-calm',
    });
  }
});
test('[rules.E04.two] Roll Twice preserves both final occurrence identities and raw targets in order', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = pair(10);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.tree.map((event) => event.eventId)).toEqual([
    'root',
    'first',
    'second',
  ]);
  expect(result.selected.map((event) => event.eventId)).toEqual([
    'first',
    'second',
  ]);
});
test('[rules.E04.reroll] repeated Roll Twice keeps asking for a reroll in its own die until every leaf has a roll', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = pair(50);
  const [, first, second] = draft.event.occurrences;
  expect(project(draft, snapshot).event.requirements).toEqual([
    'first:replacement:1',
    'second:replacement:1',
  ]);
  // A child recorded under a Roll Twice is not its reroll (Ruleset Version 9),
  // even a replacement kept from when its parent's die was an event that
  // could not occur: the Roll Twice still asks for its own new die.
  draft.event.occurrences.push(
    occurrence('child', 10, { kind: 'replacement', parentEventId: 'first' }),
  );
  second!.tableRoll = roll(100, 10);
  expect(project(draft, snapshot).event.requirements).toEqual([
    'first:replacement:1',
  ]);
  draft.event.occurrences.pop();
  first!.tableRoll = roll(100, 10);
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    selected: [{ eventId: 'first' }, { eventId: 'second' }],
  });
  delete first!.tableRoll;
  expect(project(draft, snapshot).event.requirements).toEqual([
    'first:table:1d100',
  ]);
});
test('[rules.E04.no-clause] duplicates with no Twice clause dispatch independent baseline occurrences', () => {
  for (const value of [10, 30, 78, 82]) {
    const { draft, snapshot } = eventSelectionFixture();
    draft.event.occurrences = pair(value);
    expect(
      project(draft, snapshot).event.dispatch.map((entry) => entry.mode),
    ).toEqual(['base', 'base']);
  }
});
test('[rules.E04.clause] actual Twice clauses and explicit no-extra clauses retain separate dispatch identities', () => {
  for (const value of [
    2, 18, 22, 26, 34, 38, 42, 46, 54, 58, 62, 66, 74, 86, 90, 98, 100,
  ]) {
    const { draft, snapshot } = eventSelectionFixture();
    draft.event.occurrences = pair(value);
    const result = project(draft, snapshot).event;
    expect(result.ready).toBe(true);
    expect(result.dispatch.map((entry) => entry.mode)).toEqual([
      'base',
      value === 2 || value === 100 ? 'no_additional_effect' : 'twice',
    ]);
    expect(result.dispatch[1]?.firstEventId).toBe('first');
  }
});
test('[rules.E04.independent] automatic replacements precede guarantees and do not consume the normal Roll Twice expansion', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'queued',
        sourceId: 'storm',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  const auto = occurrence('auto', 50, { kind: 'automatic', sourceId: 'storm' });
  draft.event.occurrences = [auto];
  choice.candidates = [occurrence('root', 10), occurrence('rejected', 74)];
  choice.selectedEventId = 'root';
  // An automatic Roll Twice is rerolled in its own die.
  expect(project(draft, snapshot).event.requirements).toContain(
    'auto:replacement:1',
  );
  auto.tableRoll = roll(100, 10);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.selected.map((event) => event.eventId)).toEqual([
    'auto',
    'root',
  ]);
  expect(result.nextUneventfulCarry).toBe(false);
  // Without the guarantee the chance-rolled event keeps the one expansion.
  draft.activity.slots[0]!.choice = null;
  draft.event.chanceRoll = roll(100, 1);
  draft.event.occurrences.push(...pair(10));
  expect(
    project(draft, snapshot).event.selected.map((event) => event.eventId),
  ).toEqual(['auto', 'first', 'second']);
});

test('[rules.E03.eligibility] impossible occurrences require replacements and intentional exceptions retain a reason', () => {
  for (const value of [30, 34, 62, 66, 70, 78, 90]) {
    const { draft, snapshot } = eventSelectionFixture();
    snapshot.roster.teams = [];
    snapshot.settlements = [];
    snapshot.economy = { items: [], caches: [], orders: [], markets: [] };
    delete draft.activity.operatingSettlementId;
    draft.event.occurrences = [occurrence('impossible', value)];
    let result = project(draft, snapshot).event;
    expect(result.requirements, value.toString()).toContain(
      'impossible:replacement:1',
    );
    expect(result.selected).toEqual([]);
    draft.event.occurrences.push(
      occurrence('replacement', 10, {
        kind: 'replacement',
        parentEventId: 'impossible',
      }),
    );
    result = project(draft, snapshot).event;
    expect(result.ready).toBe(true);
    expect(result.selected.map((event) => event.eventId)).toEqual([
      'replacement',
    ]);
    draft.rulesExceptions.push({
      exceptionId: 'exception',
      subjectId: 'impossible',
      ruleId: 'event-eligibility',
      reason: 'The GM supplies a narrative target',
    });
    expect(
      project(draft, snapshot).event.selected.map((event) => event.eventId),
    ).toEqual(['impossible']);
  }
});
test('[rules.E03.nested] an impossible leaf inside Roll Twice can request further replacements', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.roster.teams = [];
  draft.event.occurrences = pair(90);
  const another = occurrence('another', 50, {
    kind: 'replacement',
    parentEventId: 'first',
  });
  draft.event.occurrences.push(
    another,
    occurrence('second-result', 10, {
      kind: 'replacement',
      parentEventId: 'second',
    }),
  );
  // The replacement rolled Roll Twice: it is rerolled in its own die.
  expect(project(draft, snapshot).event.requirements).toEqual([
    'another:replacement:1',
  ]);
  another.tableRoll = roll(100, 10);
  expect(
    project(draft, snapshot).event.selected.map((event) => event.eventId),
  ).toEqual(['another', 'second-result']);
});

test.each([
  [1, 4, 'week_of_serenity'],
  [5, 12, 'war_games'],
  [13, 16, 'night_ops'],
  [17, 20, 'broke_the_code'],
  [21, 24, 'found_fire'],
  [25, 28, 'high_morale'],
  [29, 32, 'turn_around'],
  [33, 36, 'festival'],
  [37, 40, 'market_day'],
  [41, 44, 'hidden_agenda'],
  [45, 48, 'all_is_calm'],
  [49, 52, 'roll_twice'],
  [53, 56, 'calm_before_the_storm'],
  [57, 60, 'turncoat'],
  [61, 64, 'cache_discovered'],
  [65, 68, 'rivalry'],
  [69, 72, 'missing_in_action'],
  [73, 76, 'theft'],
  [77, 80, 'raid'],
  [81, 84, 'invasion'],
  [85, 88, 'low_morale'],
  [89, 96, 'sickness'],
  [97, 99, 'double_agent'],
  [100, 100, 'week_of_pain'],
] as const)(
  '[rules.E02.interval-%i-%i] table endpoints select %s from the raw percentile',
  (min, max, eventType) => {
    const { draft, snapshot } = eventSelectionFixture();
    for (const value of [min, max]) {
      draft.event.occurrences = [occurrence('event', value)];
      const result = project(draft, snapshot).event;
      expect(result.tree[0]?.eventType).toBe(eventType);
    }
  },
);
test('[rules.E02.integrity] malformed raw dice are rejected and missing dice remain incomplete', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [occurrence('event', 10)];
  for (const value of [NaN, Infinity, 1.5]) {
    draft.event.occurrences[0]!.tableRoll = roll(100, value);
    expect(weeklyDraftSchema.safeParse(draft).success).toBe(false);
  }
  delete draft.event.occurrences[0]!.tableRoll;
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    requirements: ['event:table:1d100'],
    selected: [],
  });
  draft.event.occurrences[0]!.tableRoll = roll(100, 101);
  expect(project(draft, snapshot).event.warnings).toContain(
    'event:table:roll-range',
  );
});
test('[rules.E01.queued] only currently due chance effects contribute and clearing them recomputes readiness', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.chanceRoll = roll(100, 14);
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'now',
        sourceId: 'now',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'event_chance', value: 5 },
      },
      {
        effectId: 'future',
        sourceId: 'future',
        startsWeek: 41,
        endsWeek: 41,
        effect: { kind: 'event_chance', value: 100 },
      },
      {
        effectId: 'expired',
        sourceId: 'expired',
        startsWeek: 39,
        endsWeek: 39,
        effect: { kind: 'event_chance', value: 100 },
      },
    ],
  };
  expect(project(draft, snapshot).event).toMatchObject({
    chance: 15,
    ready: false,
    requirements: ['event:root:1'],
  });
  draft.context = { ...draft.context, queuedEffects: [] };
  expect(project(draft, snapshot).event).toMatchObject({
    chance: 10,
    ready: true,
    nextUneventfulCarry: true,
  });
});

test('[rules.E05.double-calm] duplicate All Is Calm prevents the uneventful bonus chain', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = pair(46);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    nextUneventfulCarry: false,
  });
});
test('[rules.E03.candidates] impossible unchosen guaranteed candidates require replacements before choosing', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  snapshot.roster.teams = [];
  choice.candidates = [occurrence('chosen', 10), occurrence('impossible', 90)];
  choice.selectedEventId = 'chosen';
  expect(project(draft, snapshot).event.requirements).toContain(
    'impossible:replacement:1',
  );
  choice.candidates.push(
    occurrence('valid', 10, {
      kind: 'replacement',
      parentEventId: 'impossible',
    }),
  );
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    selected: [{ eventId: 'chosen' }],
  });
});
