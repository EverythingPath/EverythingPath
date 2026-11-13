import { expect, test } from 'vitest';
import {
  weeklyDraftEditSchema,
  weeklyDraftSchema,
} from './weekly-draft-contract';
import { createWeeklyDraft } from './weekly-draft';

const roll = {
  diceTotal: 12,
  diceCount: 1,
  sides: 20,
  provenance: { kind: 'table' },
  modifiers: [],
};

test('Activity edits reject unsupported rolls instead of silently stripping them', () => {
  for (const choice of [
    { choiceId: 'gold', actionId: 'earn_gold', rolls: { reward: roll } },
    { choiceId: 'quiet', actionId: 'lie_low', rolls: { check: roll } },
    { choiceId: 'special', actionId: 'special', rolls: { check: roll } },
  ]) {
    expect(
      weeklyDraftEditSchema.safeParse({ kind: 'stage', slotId: 'slot', choice })
        .success,
    ).toBe(false);
  }
});

test('nested Event edits reject rolls unsupported in their structural context', () => {
  const occurrence = { eventId: 'event', origin: { kind: 'rolled' } };
  for (const details of [
    { rolls: { reward: roll } },
    { rolls: { notoriety: roll } },
    {
      targetChecks: [
        {
          target: { kind: 'character', characterId: 'pc' },
          rolls: { training: roll },
        },
      ],
    },
    { sabotage: { choiceId: 'reaction', rolls: { loss: roll } } },
    {
      persistent: true,
      persistentDecision: {
        kind: 'mitigate',
        eventId: 'event',
        rolls: { delivery: roll },
      },
    },
  ]) {
    const event = { ...occurrence, ...details };
    for (const edit of [
      { kind: 'event_occurrence', occurrence: event },
      { kind: 'event_tree', occurrences: [event] },
      {
        kind: 'stage',
        slotId: 'slot',
        choice: {
          choiceId: 'candidate',
          actionId: 'guarantee_event',
          candidates: [event],
        },
      },
    ])
      expect(weeklyDraftEditSchema.safeParse(edit).success).toBe(false);
  }
});

test('Upkeep and carried Persistent edits reject unused backing keys', () => {
  expect(
    weeklyDraftEditSchema.safeParse({
      kind: 'upkeep',
      inputs: { rolls: { reward: roll } },
    }).success,
  ).toBe(false);
  expect(
    weeklyDraftEditSchema.safeParse({
      kind: 'persistent_decision',
      decision: {
        kind: 'mitigate',
        eventId: 'event',
        rolls: { training: roll },
      },
    }).success,
  ).toBe(false);
});

const total = {
  diceTotal: 0,
  diceCount: 2,
  sides: 6,
  provenance: { kind: 'generated', sourceId: 'table-source' },
  modifiers: [{ sourceId: 'weather', value: -2, reason: 'Storm' }],
};

test.each([
  ['activate_black_market', ['check', 'notoriety']],
  ['dismiss_team', ['check', 'notoriety']],
  ['drill_militia', ['check', 'training', 'notoriety']],
  ['earn_gold', ['check', 'notoriety']],
  ['gather_information', ['check', 'notoriety']],
  ['guarantee_event', ['notoriety']],
  ['knowledge_check', ['check']],
  ['recruit_team', ['check', 'notoriety']],
  ['reduce_danger', ['check', 'notoriety']],
  ['rescue_character', ['check']],
  ['secure_cache', ['check']],
  ['special_order', ['delivery']],
  ['spread_propaganda', ['check']],
] as const)(
  '%s preserves every rule-supported conditional roll without normalizing it',
  (actionId, keys) => {
    const rolls = Object.fromEntries(
      keys.map((key, index) => [key, index % 2 ? total : roll]),
    );
    const edit = {
      kind: 'stage',
      slotId: 'slot',
      choice: { choiceId: 'choice', actionId, rolls },
    };
    expect(weeklyDraftEditSchema.parse(edit)).toEqual(edit);
    const forbidden = [
      'check',
      'training',
      'notoriety',
      'delivery',
      'loss',
      'chance',
      'table',
      'duration',
      'reward',
    ].filter((key) => !keys.some((allowed) => allowed === key));
    for (const key of forbidden)
      expect(
        weeklyDraftEditSchema.safeParse({
          ...edit,
          choice: { ...edit.choice, rolls: { ...rolls, [key]: roll } },
        }).success,
      ).toBe(false);
  },
);

test.each([
  'activate_refuge',
  'broker_market',
  'change_officer_role',
  'covert_action',
  'lie_low',
  'manipulate_events',
  'restore_character',
  'special',
  'strike_team',
  'upgrade_team',
])('%s has no generic roll backing, even an empty map', (actionId) => {
  const choice = { choiceId: 'choice', actionId };
  expect(
    weeklyDraftEditSchema.parse({ kind: 'stage', slotId: 'slot', choice }),
  ).toEqual({ kind: 'stage', slotId: 'slot', choice });
  expect(
    weeklyDraftEditSchema.safeParse({
      kind: 'stage',
      slotId: 'slot',
      choice: { ...choice, rolls: {} },
    }).success,
  ).toBe(false);
});

test('nested edits retain supported raw facts, officers, targets and conditional checks exactly', () => {
  const officerCheck = {
    characterId: 'officer',
    skill: 'diplomacy',
    roll,
  };
  const event = {
    eventId: 'event',
    origin: { kind: 'rolled' },
    tableRoll: { ...roll, sides: 100 },
    rolls: { check: roll, loss: total },
    officerCheck,
    targetChecks: [
      {
        target: { kind: 'character', characterId: 'pc' },
        rolls: { check: roll, loss: { ...total, diceCount: 1, sides: 100 } },
      },
    ],
    sabotage: {
      choiceId: 'reaction',
      rolls: { check: roll, notoriety: total },
    },
    persistent: true,
    persistentDecision: {
      kind: 'mitigate',
      eventId: 'event',
      rolls: { check: total },
      officerCheck,
    },
  };
  for (const edit of [
    { kind: 'event_occurrence', occurrence: event },
    { kind: 'event_tree', occurrences: [event] },
    {
      kind: 'stage',
      slotId: 'slot',
      choice: {
        choiceId: 'candidate',
        actionId: 'manipulate_events',
        candidates: [event],
      },
    },
    { kind: 'persistent_decision', decision: event.persistentDecision },
  ])
    expect(weeklyDraftEditSchema.parse(edit)).toEqual(edit);
});

test('Special narrative and manual outcome survive removal of arbitrary dice', () => {
  const edit = {
    kind: 'stage',
    slotId: 'slot',
    choice: {
      choiceId: 'special',
      actionId: 'special',
      instruction: 'Negotiate a truce',
      acknowledgements: [
        {
          acknowledgementId: 'result',
          subjectId: 'special',
          outcome: 'Truce agreed',
        },
      ],
    },
  };
  expect(weeklyDraftEditSchema.parse(edit)).toEqual(edit);
});

test('draft parsing preserves supported rolls recorded for another specification but rejects removed fields at rest', () => {
  const draft = createWeeklyDraft({
    draftId: 'draft',
    week: 4,
    slotIds: ['slot'],
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  const source = {
    ...draft,
    upkeep: {
      ...draft.upkeep,
      rolls: {
        check: roll,
        training: { ...roll, diceTotal: 3, sides: 4 },
        notoriety: total,
        loss: total,
      },
    },
    activity: {
      ...draft.activity,
      slots: [
        {
          slotId: 'slot',
          choice: {
            choiceId: 'order',
            actionId: 'special_order',
            expedited: true,
            rolls: { delivery: { ...roll, diceTotal: 2, sides: 6 } },
          },
        },
      ],
    },
  };
  expect(weeklyDraftSchema.parse(source)).toEqual(source);
  for (const key of ['delivery', 'chance', 'table', 'duration', 'reward']) {
    const invalid = {
      ...source,
      upkeep: {
        ...source.upkeep,
        rolls: { ...source.upkeep.rolls, [key]: roll },
      },
    };
    expect(weeklyDraftSchema.safeParse(invalid).success).toBe(false);
  }
  const invalidChoice = {
    ...source,
    activity: {
      slots: [
        {
          slotId: 'slot',
          choice: {
            choiceId: 'order',
            actionId: 'special_order',
            rolls: { delivery: total, check: roll },
          },
        },
      ],
    },
  };
  expect(weeklyDraftSchema.safeParse(invalidChoice).success).toBe(false);
  const invalidEvent = {
    ...source,
    event: {
      occurrences: [
        {
          eventId: 'event',
          origin: { kind: 'rolled' },
          rolls: { duration: roll },
        },
      ],
    },
  };
  expect(weeklyDraftSchema.safeParse(invalidEvent).success).toBe(false);
});
