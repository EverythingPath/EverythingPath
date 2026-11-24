import { describe, expect, test } from 'vitest';
import {
  weeklyDraftSchema,
  weeklyDraftEditSchema,
  stagedActionChoiceSchema,
} from './weekly-draft-contract';
import { MILITIA_ACTIVITY_ACTION_IDS } from './militia-domain';
import { createWeeklyDraft, editWeeklyDraft } from './weekly-draft';

const context = {
  firstMilitiaWeek: false,
  startDay: 70,
  uneventfulCarry: true,
  carriedEvents: [],
  queuedEffects: [],
  orders: [],
  lastBuyoffWeek: null,
};
const fresh = () =>
  createWeeklyDraft({
    draftId: 'draft-11',
    week: 11,
    context,
    slotIds: ['left', 'right', 'extra'],
  });

describe('canonical Weekly Draft', () => {
  test('[draft.partial] stages partial choices and distinguishes missing from zero', () => {
    const initial = fresh();
    const staged = editWeeklyDraft(initial, {
      kind: 'stage',
      slotId: 'left',
      choice: { choiceId: 'gold', actionId: 'earn_gold' },
    });
    expect(staged.ok).toBe(true);
    if (!staged.ok) throw new Error(staged.error);
    expect(staged.draft.activity.slots[0]?.choice).toMatchObject({
      choiceId: 'gold',
      actionId: 'earn_gold',
    });
    expect(staged.draft.activity.slots[0]?.choice).not.toHaveProperty(
      'costCopper',
    );
    const edited = editWeeklyDraft(staged.draft, {
      kind: 'detail',
      slotId: 'left',
      choiceId: 'gold',
      choice: { choiceId: 'gold', actionId: 'earn_gold', costCopper: 0 },
    });
    expect(edited.ok && edited.draft.activity.slots[0]?.choice).toMatchObject({
      costCopper: 0,
    });
    expect(initial.activity.slots[0]?.choice).toBeNull();
  });
});

function accepted(
  draft: ReturnType<typeof fresh>,
  edit: Parameters<typeof editWeeklyDraft>[1],
) {
  const result = editWeeklyDraft(draft, edit);
  if (!result.ok) throw new Error(result.error);
  return result.draft;
}

test('[rules.P09.aggregate] moves and swaps complete choices and rejects obsolete details', () => {
  const gold = {
    choiceId: 'gold',
    actionId: 'earn_gold' as const,
    costCopper: 0,
  };
  const other = {
    choiceId: 'other',
    actionId: 'earn_gold' as const,
    costCopper: 10,
  };
  let draft = accepted(fresh(), {
    kind: 'stage',
    slotId: 'left',
    choice: gold,
  });
  draft = accepted(draft, {
    kind: 'move',
    fromSlotId: 'left',
    toSlotId: 'extra',
    choiceId: 'gold',
  });
  expect(draft.activity.slots.map((s) => s.choice)).toEqual([null, null, gold]);
  draft = accepted(draft, { kind: 'stage', slotId: 'right', choice: other });
  draft = accepted(draft, {
    kind: 'swap',
    fromSlotId: 'extra',
    toSlotId: 'right',
    choiceId: 'gold',
    otherChoiceId: 'other',
  });
  expect(draft.activity.slots.map((s) => s.choice)).toEqual([
    null,
    gold,
    other,
  ]);
  const replaced = accepted(draft, {
    kind: 'replace',
    slotId: 'right',
    choiceId: 'gold',
    choice: { choiceId: 'replacement', actionId: 'earn_gold' },
  });
  expect(replaced.activity.slots[1]?.choice).not.toHaveProperty('costCopper');
  expect(
    editWeeklyDraft(replaced, {
      kind: 'detail',
      slotId: 'right',
      choiceId: 'gold',
      choice: gold,
    }),
  ).toEqual({ ok: false, error: 'obsolete_choice' });
  const cleared = accepted(replaced, {
    kind: 'clear',
    slotId: 'extra',
    choiceId: 'other',
  });
  expect(cleared.activity.slots.map((s) => s.slotId)).toEqual([
    'left',
    'right',
    'extra',
  ]);
  expect(cleared.activity.slots[2]?.choice).toBeNull();
  expect(cleared.revision).toBe(6);
  expect(
    editWeeklyDraft(draft, {
      kind: 'move',
      fromSlotId: 'right',
      toSlotId: 'extra',
      choiceId: 'gold',
    }).ok,
  ).toBe(false);
  expect(draft.activity.slots.map((s) => s.choice)).toEqual([
    null,
    gold,
    other,
  ]);
});

test('[draft.action-facts] complete choices own typed targets, raw dice and provenance', () => {
  const choice = {
    choiceId: 'order',
    actionId: 'special_order' as const,
    teamId: 'fixers-2',
    itemId: 'wand',
    mode: 'purchase' as const,
    priceCopper: 150001,
    expedited: false,
    orderedDay: 76,
    rolls: {
      delivery: {
        diceTotal: 7,
        diceCount: 2,
        sides: 6,
        provenance: { kind: 'table' as const },
        modifiers: [],
      },
    },
  };
  const draft = accepted(fresh(), { kind: 'stage', slotId: 'extra', choice });
  expect(draft.activity.slots[2]?.choice).toEqual(choice);
  expect(
    accepted(draft, {
      kind: 'move',
      fromSlotId: 'extra',
      toSlotId: 'left',
      choiceId: 'order',
    }).activity.slots[0]?.choice,
  ).toEqual(choice);
  expect(
    editWeeklyDraft(draft, {
      kind: 'detail',
      slotId: 'extra',
      choiceId: 'order',
      choice: { choiceId: 'order', actionId: 'lie_low' },
    }).ok,
  ).toBe(false);
});

test('[draft.context] freezes week-start facts and keeps persistent eligibility fixed', () => {
  const draft = createWeeklyDraft({
    draftId: 'carried',
    week: 11,
    slotIds: ['a'],
    context: {
      ...context,
      carriedEvents: [
        {
          eventId: 'rivalry',
          eventType: 'rivalry',
          startedWeek: 9,
          order: 0,
          targets: [{ kind: 'team', teamId: 'guards-2' }],
        },
      ],
    },
  });
  expect(draft.context.persistentPhaseEligible).toBe(true);
  expect(Object.isFrozen(draft.context.carriedEvents[0]?.targets)).toBe(true);
  const next = accepted(draft, {
    kind: 'persistent_decision',
    decision: { eventId: 'rivalry', kind: 'buyoff' },
  });
  expect(next.context).toEqual(draft.context);
  expect(next.context.persistentPhaseEligible).toBe(true);
  expect(next.persistent.decisions).toEqual([
    { eventId: 'rivalry', kind: 'buyoff' },
  ]);
});

test('[draft.integrity] validates all action variants, absence, dice and local-state boundaries', () => {
  for (const actionId of MILITIA_ACTIVITY_ACTION_IDS) {
    expect(
      stagedActionChoiceSchema.safeParse({ choiceId: actionId, actionId })
        .success,
    ).toBe(true);
  }
  for (const invalid of [
    { choiceId: 'a', actionId: 'unknown' },
    { choiceId: '', actionId: 'earn_gold' },
    { choiceId: 'a', actionId: 'earn_gold', costCopper: '0' },
    { choiceId: 'a', actionId: 'earn_gold', costCopper: Infinity },
    { choiceId: 'a', actionId: 'earn_gold', costCopper: -1 },
    { choiceId: 'a', actionId: 'earn_gold', costCopper: 0.5 },
    { choiceId: 'a', actionId: 'earn_gold', itemId: 'stale-order' },
    {
      choiceId: 'a',
      actionId: 'earn_gold',
      rolls: {
        check: {
          diceTotal: '21',
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    },
  ])
    expect(stagedActionChoiceSchema.safeParse(invalid).success).toBe(false);
  for (const field of [
    'phaseView',
    'inputText',
    'pending',
    'readiness',
    'preview',
    '_id',
  ]) {
    expect(
      weeklyDraftSchema.safeParse({ ...fresh(), [field]: 'local' }).success,
    ).toBe(false);
  }
  expect(
    weeklyDraftEditSchema.safeParse({ kind: 'claim', slotId: 'left' }).success,
  ).toBe(false);
  expect(
    weeklyDraftEditSchema.safeParse({ kind: 'confirm', slotId: 'left' })
      .success,
  ).toBe(false);
  expect(() =>
    createWeeklyDraft({ draftId: 'd', week: 0, context, slotIds: ['a', 'a'] }),
  ).toThrow();
  const draft = accepted(fresh(), {
    kind: 'stage',
    slotId: 'left',
    choice: { choiceId: 'gold', actionId: 'earn_gold', costCopper: 0 },
  });
  const cleared = accepted(draft, {
    kind: 'detail',
    slotId: 'left',
    choiceId: 'gold',
    choice: { choiceId: 'gold', actionId: 'earn_gold' },
  });
  expect(cleared.activity.slots[0]?.choice).not.toHaveProperty('costCopper');
  expect(
    editWeeklyDraft(draft, {
      kind: 'stage',
      slotId: 'right',
      choice: { choiceId: 'gold', actionId: 'earn_gold' },
    }).ok,
  ).toBe(false);
  expect(
    editWeeklyDraft(draft, {
      kind: 'clear',
      slotId: 'missing',
      choiceId: 'gold',
    }).ok,
  ).toBe(false);
  expect(
    editWeeklyDraft(draft, {
      kind: 'swap',
      fromSlotId: 'left',
      toSlotId: 'right',
      choiceId: 'gold',
      otherChoiceId: 'missing',
    }).ok,
  ).toBe(false);
});

test('[draft.exceptions] retains occupied extra slots and reasoned exceptions without altering inputs', () => {
  let draft = accepted(fresh(), {
    kind: 'stage',
    slotId: 'extra',
    choice: { choiceId: 'lie-low', actionId: 'lie_low' },
  });
  draft = accepted(draft, {
    kind: 'stage',
    slotId: 'left',
    choice: { choiceId: 'drill', actionId: 'drill_militia' },
  });
  const choices = draft.activity;
  draft = accepted(draft, {
    kind: 'rules_exception',
    exception: {
      exceptionId: 'permission',
      subjectId: 'lie-low',
      ruleId: 'capacity',
      reason: 'Narrative reward',
    },
  });
  expect(draft.activity).toEqual(choices);
  expect(draft.rulesExceptions[0]?.reason).toBe('Narrative reward');
  expect(
    editWeeklyDraft(draft, {
      kind: 'rules_exception',
      exception: {
        exceptionId: 'bad',
        subjectId: 'lie-low',
        ruleId: 'capacity',
        reason: '  ',
      },
    }).ok,
  ).toBe(false);
  draft = accepted(draft, {
    kind: 'table_adjustments',
    adjustments: [
      {
        kind: 'militia_value',
        adjustmentId: 'set',
        field: 'treasuryCopper',
        operation: 'set',
        value: 0,
        reason: 'Lost funds',
      },
      {
        kind: 'militia_value',
        adjustmentId: 'add',
        field: 'treasuryCopper',
        operation: 'add',
        value: 1,
        reason: 'Found copper',
      },
    ],
  });
  expect(draft.tableAdjustments.map((a) => a.adjustmentId)).toEqual([
    'set',
    'add',
  ]);
  expect(draft.activity).toEqual(choices);
  draft = accepted(draft, { kind: 'add_slot', slotId: 'reward' });
  expect(draft.activity.slots.map((s) => s.slotId)).toEqual([
    'left',
    'right',
    'extra',
    'reward',
  ]);
});

test('[draft.events] preserves ordered replacement trees, per-instance facts and optional mitigation', () => {
  const occurrences = [
    {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      eventType: 'roll_twice' as const,
    },
    {
      eventId: 'child',
      origin: { kind: 'roll_twice' as const, parentEventId: 'root' },
      eventType: 'roll_twice' as const,
    },
    {
      eventId: 'reroll',
      origin: { kind: 'replacement' as const, parentEventId: 'child' },
      eventType: 'rivalry' as const,
      persistent: true,
      targets: [{ kind: 'team' as const, teamId: 'guards-2' }],
    },
    {
      eventId: 'sibling',
      origin: { kind: 'roll_twice' as const, parentEventId: 'root' },
      eventType: 'rivalry' as const,
      targets: [{ kind: 'team' as const, teamId: 'guards-3' }],
      sabotage: { choiceId: 'sabotage', teamId: 'saboteurs-1' },
    },
  ];
  let draft = accepted(fresh(), { kind: 'event_tree', occurrences });
  expect(draft.event.occurrences).toEqual(occurrences);
  expect(draft.context.persistentPhaseEligible).toBe(false);
  draft = accepted(draft, {
    kind: 'persistent_decision',
    decision: { kind: 'unattempted', eventId: 'reroll' },
  });
  draft = accepted(draft, {
    kind: 'persistent_decision',
    decision: { kind: 'mitigate', eventId: 'reroll' },
  });
  expect(draft.event.occurrences[2]?.persistentDecision).toEqual({
    kind: 'mitigate',
    eventId: 'reroll',
  });
  expect(
    editWeeklyDraft(draft, {
      kind: 'event_tree',
      occurrences: [
        {
          eventId: 'bad',
          origin: { kind: 'replacement', parentEventId: 'bad' },
        },
      ],
    }).ok,
  ).toBe(false);
  expect(
    editWeeklyDraft(draft, {
      kind: 'persistent_decision',
      decision: { kind: 'buyoff', eventId: 'missing' },
    }).ok,
  ).toBe(false);
});

test('[draft.receipts] retains day-based order facts and prevents duplicate receipt', () => {
  const draft = createWeeklyDraft({
    draftId: 'orders',
    week: 11,
    slotIds: [],
    context: {
      ...context,
      orders: [
        {
          orderId: 'wand',
          itemId: 'wand-item',
          settlementId: 'town',
          orderedDay: 76,
          dueDay: 77,
          priceCopper: 150001,
          receipt: null,
        },
      ],
    },
  });
  const next = accepted(draft, {
    kind: 'receive_order',
    orderId: 'wand',
    receivedDay: 77,
    acknowledgementId: 'receipt',
  });
  expect(next.orderReceipts).toEqual([
    { orderId: 'wand', receivedDay: 77, acknowledgementId: 'receipt' },
  ]);
  expect(next.context.orders[0]?.dueDay).toBe(77);
  expect(next.context.orders[0]?.receipt).toBeNull();
  expect(
    editWeeklyDraft(next, {
      kind: 'receive_order',
      orderId: 'wand',
      receivedDay: 78,
      acknowledgementId: 'again',
    }).ok,
  ).toBe(false);
  expect(
    editWeeklyDraft(draft, {
      kind: 'receive_order',
      orderId: 'unknown',
      receivedDay: 77,
      acknowledgementId: 'bad',
    }).ok,
  ).toBe(false);
  expect(
    accepted(next, { kind: 'clear_receipt', orderId: 'wand' }).orderReceipts,
  ).toEqual([]);
});

test('[draft.unique-facts] rejects duplicate transfer and queued-effect identities', () => {
  const transfer = {
    transferId: 'deposit',
    characterId: 'pc',
    direction: 'deposit' as const,
    copper: 0,
  };
  expect(
    editWeeklyDraft(fresh(), {
      kind: 'upkeep',
      inputs: {
        rolls: {},
        treasuryTransfers: [transfer, transfer],
        teamDecisions: [],
      },
    }).ok,
  ).toBe(false);
  const effect = {
    effectId: 'carry',
    sourceId: 'event',
    startsWeek: 11,
    endsWeek: 12,
    effect: { kind: 'event_chance' as const, value: -2 },
  };
  expect(() =>
    createWeeklyDraft({
      draftId: 'd',
      week: 11,
      slotIds: [],
      context: { ...context, queuedEffects: [effect, effect] },
    }),
  ).toThrow();
});

test('[draft.choice-ownership] new orders own same-week receipts and event choices own candidate trees', () => {
  const order = {
    choiceId: 'order-choice',
    actionId: 'special_order' as const,
    orderId: 'new-order',
    expedited: true,
    orderedDay: 70,
    receipt: { receivedDay: 71, acknowledgementId: 'received' },
  };
  let draft = accepted(fresh(), {
    kind: 'stage',
    slotId: 'left',
    choice: order,
  });
  expect(draft.activity.slots[0]?.choice).toEqual(order);
  const eventChoice = {
    choiceId: 'events',
    actionId: 'guarantee_event' as const,
    candidates: [
      {
        eventId: 'candidate',
        origin: { kind: 'rolled' as const },
        eventType: 'theft' as const,
      },
    ],
    selectedEventId: 'candidate',
  };
  draft = accepted(draft, {
    kind: 'stage',
    slotId: 'right',
    choice: eventChoice,
  });
  draft = accepted(draft, {
    kind: 'swap',
    fromSlotId: 'left',
    toSlotId: 'right',
    choiceId: 'order-choice',
    otherChoiceId: 'events',
  });
  expect(draft.activity.slots[0]?.choice).toEqual(eventChoice);
  draft = accepted(draft, {
    kind: 'replace',
    slotId: 'left',
    choiceId: 'events',
    choice: { choiceId: 'plain', actionId: 'lie_low' },
  });
  expect(JSON.stringify(draft)).not.toContain('candidate');
  draft = accepted(draft, {
    kind: 'clear',
    slotId: 'right',
    choiceId: 'order-choice',
  });
  expect(JSON.stringify(draft)).not.toContain('received');
});

test('[draft.event-targets] keeps separate Raid person checks and High Morale ending targets', () => {
  const roll = {
    diceTotal: 1,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'table' as const },
    modifiers: [{ sourceId: 'penalty', value: -2, reason: 'Low morale' }],
  };
  const occurrences = [
    {
      eventId: 'raid',
      origin: { kind: 'rolled' as const },
      eventType: 'raid' as const,
      targetChecks: [
        {
          target: { kind: 'character' as const, characterId: 'pc-1' },
          rolls: { check: roll },
        },
        { target: { kind: 'character' as const, characterId: 'pc-2' } },
      ],
    },
    {
      eventId: 'morale',
      origin: { kind: 'rolled' as const },
      eventType: 'high_morale' as const,
      targets: [{ kind: 'event' as const, eventId: 'rivalry' }],
    },
  ];
  const draft = accepted(fresh(), { kind: 'event_tree', occurrences });
  expect(draft.event.occurrences).toEqual(occurrences);
  expect(
    weeklyDraftEditSchema.safeParse({
      kind: 'event_chance',
      roll: { ...roll, diceTotal: 0, diceCount: 1 },
    }).success,
  ).toBe(true);
  expect(
    weeklyDraftEditSchema.safeParse({
      kind: 'event_chance',
      roll: { ...roll, diceTotal: 101, diceCount: 1 },
    }).success,
  ).toBe(true);
});

test('[draft.candidate-decisions] keeps candidate mitigation owned by its choice and rejects duplicate sabotage identity', () => {
  const choice = {
    choiceId: 'guarantee',
    actionId: 'guarantee_event' as const,
    selectedEventId: 'theft',
    candidates: [
      {
        eventId: 'theft',
        origin: { kind: 'rolled' as const },
        eventType: 'theft' as const,
        persistent: true,
      },
    ],
  };
  let draft = accepted(fresh(), { kind: 'stage', slotId: 'left', choice });
  draft = accepted(draft, {
    kind: 'persistent_decision',
    decision: { kind: 'mitigate', eventId: 'theft' },
  });
  expect(draft.activity.slots[0]?.choice).toMatchObject({
    candidates: [
      { persistentDecision: { kind: 'mitigate', eventId: 'theft' } },
    ],
  });
  draft = accepted(draft, {
    kind: 'clear',
    slotId: 'left',
    choiceId: 'guarantee',
  });
  expect(JSON.stringify(draft)).not.toContain('theft');
  expect(
    editWeeklyDraft(fresh(), {
      kind: 'stage',
      slotId: 'left',
      choice: {
        ...choice,
        candidates: [
          { ...choice.candidates[0]!, sabotage: { choiceId: 'guarantee' } },
        ],
      },
    }).ok,
  ).toBe(false);
});

test('focused Upkeep edits preserve other facts and distinguish zero from an explicit clear', () => {
  const draft = createWeeklyDraft({
    draftId: 'focused-upkeep',
    week: 4,
    context,
    slotIds: ['a'],
  });
  const set = editWeeklyDraft(draft, {
    kind: 'upkeep_roll',
    field: 'check',
    roll: {
      diceTotal: 0,
      diceCount: 1,
      sides: 20,
      provenance: { kind: 'table' },
      modifiers: [],
    },
  });
  if (!set.ok) throw new Error(set.error);
  const savedRoll = set.draft.upkeep.rolls.check;
  expect(savedRoll).toMatchObject({ diceTotal: 0, diceCount: 1 });
  const clear = editWeeklyDraft(set.draft, {
    kind: 'upkeep_roll',
    field: 'check',
    roll: null,
  });
  expect(clear.ok && clear.draft.upkeep.rolls.check).toBeUndefined();
});

test('[rules.ACT-19.reducer] remove_slot drops only the identified empty slot and later slots keep their identities and choices', () => {
  let draft = fresh();
  draft = accepted(draft, {
    kind: 'stage',
    slotId: 'extra',
    choice: { choiceId: 'gold', actionId: 'earn_gold', costCopper: 0 },
  });
  const removed = editWeeklyDraft(draft, {
    kind: 'remove_slot',
    slotId: 'right',
  });
  if (!removed.ok) throw new Error(removed.error);
  expect(removed.draft.revision).toBe(draft.revision + 1);
  expect(removed.draft.activity.slots).toEqual([
    { slotId: 'left', choice: null },
    {
      slotId: 'extra',
      choice: { choiceId: 'gold', actionId: 'earn_gold', costCopper: 0 },
    },
  ]);
  expect(
    editWeeklyDraft(draft, { kind: 'remove_slot', slotId: 'extra' }),
  ).toEqual({ ok: false, error: 'occupied_slot' });
  expect(
    editWeeklyDraft(removed.draft, { kind: 'remove_slot', slotId: 'right' }),
  ).toEqual({ ok: false, error: 'unknown_slot' });
  expect(draft.activity.slots).toHaveLength(3);
  expect(
    weeklyDraftEditSchema.safeParse({ kind: 'remove_slot', slotId: ' ' })
      .success,
  ).toBe(false);
});
