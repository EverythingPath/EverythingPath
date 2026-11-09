import { compoundAcceptanceFixture } from '../../tests/rules/compound-acceptance-fixture';
import { expect, test } from 'vitest';
import {
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
  resolveReviewedWeeklyDraft,
  applyCanonicalResolutionPlan,
  prepareCanonicalResolutionRecord,
} from './canonical-weekly-resolution';
import { weeklySourceKey } from './canonical-weekly-source';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { resourceEventFixture } from '../../tests/rules/resource-event-fixture';
import { characterFixture } from '../../tests/rules/character-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { roll, upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { createWeeklyDraft } from './weekly-draft';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';
import { COMPUTED_HIT_DICE_RULESET_VERSION } from './ruleset-versions';

function fixture() {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  snapshot.training = 15;
  return { revision: draft, militiaSnapshot: snapshot };
}
function resolve(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  return resolveCanonicalWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
}

test('a version 9 weekly Drill retains level-only Hit Dice until cutover', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'pc' });
  snapshot.roster.people[0]!.hitDice = null;
  const character = { ...snapshot.characters[0]!, racialHitDice: 4 };
  snapshot.characters = [character];
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 10), training: roll(6, 2, 5) },
  };
  const result = resolve(draft, snapshot);
  expect(result.rulesetVersion).toBe(9);
  expect(result.outcome!.militiaSnapshot.training).toBe(47);
  expect(result.outcome!.militiaSnapshot.characters[0]!.level).toBe(10);
  snapshot.roster.people[0]!.hitDice = 0;
  expect(resolve(draft, snapshot).outcome!.militiaSnapshot.training).toBe(37);
  snapshot.roster.people[0]!.hitDice = 6;
  expect(resolve(draft, snapshot).outcome!.militiaSnapshot.training).toBe(43);
});

test('computed Hit Dice has a reserved Ruleset Version while production previews and records remain on version 9', () => {
  // #240/#312: cutover activates the changed rules and requires a fresh review.
  expect(COMPUTED_HIT_DICE_RULESET_VERSION).toBe(10);
  const result = resolveCanonicalWeeklyDraft(fixture());
  expect(result.rulesetVersion).toBe(9);
  expect(
    prepareCanonicalResolutionRecord(result, 'legacy-version').rulesetVersion,
  ).toBe(9);
});

test('old frozen snapshots keep zero racial Hit Dice when the current Character gains racial facts', () => {
  // PRD #251 frozen-history contract: omitted racial facts never consult a live sheet.
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'pc' });
  snapshot.roster.people[0]!.hitDice = null;
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 10), training: roll(6, 2, 5) },
  };
  const record = prepareCanonicalResolutionRecord(
    resolve(draft, snapshot),
    'frozen',
  );
  snapshot.characters[0]!.racialHitDice = 4;
  const frozen = resolveCanonicalWeeklyDraft({
    revision: record.source,
    militiaSnapshot: record.sourceMilitiaSnapshot,
  });
  expect(frozen.outcome!.militiaSnapshot.training).toBe(47);
  expect(record.sourceMilitiaSnapshot.characters[0]).not.toHaveProperty(
    'racialHitDice',
  );
  expect(snapshot.characters[0]!.racialHitDice).toBe(4);
});

test('[rules.P78.selected-references] historical operations and selected consumables reject foreign identities', () => {
  const input = fixture();
  input.revision.context = {
    ...input.revision.context,
    operatedSettlementIds: ['foreign'],
  };
  expect(projectWeeklyDraft(input).requirements).toContain(
    'context:operated-settlement:foreign:reference',
  );
  input.revision.context = {
    ...input.revision.context,
    operatedSettlementIds: ['town'],
  };
  input.revision.activity.consumableIds = ['foreign'];
  expect(projectWeeklyDraft(input).requirements).toContain(
    'activity:consumable:foreign:reference',
  );
  input.revision.activity.consumableIds = [];
  expect(projectWeeklyDraft(input).status).toBe('ready');
});

test('[rules.P78.consumables] selected one-use bonuses require an explicit check target and contribute once from authoritative facts', () => {
  const { draft, snapshot, choice } = economyFixture('earn_gold');
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  snapshot.bonuses = [
    {
      bonusId: 'gift',
      source: 'turn-around',
      check: 'any',
      value: 5,
      teamId: 'team',
      phase: 'activity',
      availableWeek: 40,
      consumedWeek: null,
    },
  ];
  draft.activity.consumableIds = ['gift'];
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }).status,
  ).toBe('incomplete');
  choice.consumableIds = ['gift'];
  const result = resolve(draft, snapshot);
  // Fixers are tier 3: (10 raw + 1 secondary Loyalty + 5 gift) x 3 gp.
  expect(result.outcome!.militiaSnapshot.treasuryCopper).toBe(1004800);
  expect(result.outcome!.militiaSnapshot.bonuses[0]!.consumedWeek).toBe(40);
  expect(snapshot.bonuses[0]!.consumedWeek).toBeNull();
  if (choice.actionId !== 'earn_gold')
    throw Error('Expected Earn Gold fixture');
  choice.rolls!.check!.modifiers = [
    { sourceId: 'bonus:gift', value: 999, reason: 'Old entered modifier' },
  ];
  expect(resolve(draft, snapshot).outcome!.militiaSnapshot.treasuryCopper).toBe(
    1004800,
  );
  snapshot.bonuses[0]!.consumedWeek = 39;
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }).status,
  ).toBe('incomplete');
});

test('[rules.P78.consumable-targets] selected bonuses cannot vanish on no-check actions or be used by two choices', () => {
  const { draft, snapshot, choice } = economyFixture('earn_gold');
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  snapshot.bonuses = [
    {
      bonusId: 'gift',
      source: 'reward',
      check: 'any',
      value: 5,
      phase: 'activity',
      availableWeek: 40,
      consumedWeek: null,
    },
  ];
  choice.consumableIds = ['gift'];
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  draft.activity.slots[1]!.choice = {
    ...choice,
    choiceId: 'second-choice',
    teamId: 'second',
  };
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }).status,
  ).toBe('incomplete');
  draft.activity.slots[1]!.choice = null;
  draft.activity.slots[0]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    instruction: 'Scout',
    costCopper: 0,
    consumableIds: ['gift'],
    acknowledgements: [
      {
        acknowledgementId: 'work',
        subjectId: 'special:work',
        outcome: 'Scouted',
      },
    ],
  };
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot })
      .requirements,
  ).toContain('work:consumable:gift:check');
});

test('[rules.P05.matrix] mandatory phase rolls, targets and acknowledgements all block resolution while preserving a forecast', () => {
  const input = fixture();
  expect(projectWeeklyDraft(input).status).toBe('ready');
  delete input.revision.upkeep.rolls.check;
  let result = projectWeeklyDraft(input);
  expect(result.status).toBe('incomplete');
  expect(result.outcome).not.toBeNull();
  expect(result.finalPlan).toBeNull();
  expect(() => resolveCanonicalWeeklyDraft(input)).toThrow('incomplete');
  input.revision.upkeep.rolls.check = roll(20, 19);
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    instruction: 'Scout',
    costCopper: 0,
  };
  result = projectWeeklyDraft(input);
  expect(result.requirements).toContain('work:acknowledgement:special:work');
  input.revision.acknowledgements.push({
    acknowledgementId: 'work-receipt',
    subjectId: 'special:work',
    outcome: 'Scouted.',
  });
  expect(projectWeeklyDraft(input).status).toBe('ready');
  delete input.revision.event.chanceRoll;
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
  const target = resourceEventFixture(18);
  target.draft.context = { ...target.draft.context, firstMilitiaWeek: true };
  target.draft.event.occurrences[0]!.targets = [];
  expect(
    projectWeeklyDraft({
      revision: target.draft,
      militiaSnapshot: target.snapshot,
    }).status,
  ).toBe('incomplete');
});

test('[rules.P05.zero] zero-cost adjudication is distinct from missing cost and malformed inputs never produce a plan', () => {
  const input = fixture();
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    instruction: 'Scout',
  };
  input.revision.acknowledgements.push({
    acknowledgementId: 'work-receipt',
    subjectId: 'special:work',
    outcome: 'Scouted.',
  });
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
  input.revision.activity.slots[0]!.choice.costCopper = 0;
  expect(projectWeeklyDraft(input).status).toBe('ready');
  input.militiaSnapshot.treasuryCopper = NaN;
  expect(projectWeeklyDraft(input).finalPlan).toBeNull();
});

test('[rules.P05.optional] unattempted optional mitigation remains ready while attempted incomplete mitigation does not', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.training = 15;
  expect(resolve(draft, snapshot).status).toBe('ready');
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'mitigate' }];
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }).status,
  ).toBe('incomplete');
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'unattempted' }];
  expect(resolve(draft, snapshot).status).toBe('ready');
});

test('[rules.P05.partial] partial choices cannot commit known effects as a completed week', () => {
  const input = fixture();
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
  };
  const result = projectWeeklyDraft(input);
  expect(result.status).toBe('incomplete');
  expect(result.phases?.upkeep.outcome.training).toBe(14);
  expect(result.outcome?.week).toBe(input.revision.week);
  expect(result.finalPlan).toBeNull();
});

test('[rules.P05.upstream] all draft facts and outside campaign changes invalidate reviewed source, including changes with the same numeric forecast', () => {
  const input = fixture();
  const reviewed = resolveCanonicalWeeklyDraft(input);
  const changes: ((input: ReturnType<typeof fixture>) => void)[] = [
    (x) => {
      x.militiaSnapshot.treasuryCopper += 1;
    },
    (x) => {
      x.militiaSnapshot.characters[0]!.charisma += 1;
    },
    (x) => {
      x.militiaSnapshot.roster.teams[0]!.notes = 'Different context';
    },
    (x) => {
      x.revision.revision += 1;
    },
    (x) => {
      x.revision.acknowledgements[0]!.outcome = 'Another narrative outcome';
    },
    (x) => {
      x.revision.context = { ...x.revision.context, startDay: 8 };
    },
  ];
  for (const change of changes) {
    const changed = structuredClone(input);
    change(changed);
    expect(projectWeeklyDraft(changed).sourceKey).not.toBe(reviewed.sourceKey);
    expect(() =>
      resolveReviewedWeeklyDraft(changed, reviewed.sourceKey),
    ).toThrow();
  }
  expect(
    resolveReviewedWeeklyDraft(input, reviewed.sourceKey).finalPlan,
  ).toEqual(reviewed.finalPlan);
});

test('[rules.P06.full-plan] ready action and event plans round-trip their full source and result', () => {
  const inputs = [
    ...(
      [
        'rescue_character',
        'restore_character',
        'strike_team',
        'special',
      ] as const
    ).map((action) => characterFixture(action)),
    ...(
      [
        'earn_gold',
        'activate_black_market',
        'broker_market',
        'secure_cache',
        'special_order',
      ] as const
    ).map((action) => economyFixture(action)),
    ...[10, 18, 22, 26, 30, 34, 38, 46].map((value) =>
      resourceEventFixture(value),
    ),
  ];
  for (const { draft, snapshot } of inputs) {
    draft.context = { ...draft.context, firstMilitiaWeek: true };
    draft.event.chanceRoll ??= roll(100, 100);
    const result = resolve(draft, snapshot);
    const committed = applyCanonicalResolutionPlan(
      result.finalPlan.before,
      result.finalPlan,
    );
    expect(committed).toEqual(result.outcome);
    expect(committed.militiaSnapshot).toEqual(result.baseline!.militiaSnapshot);
    expect(committed.week).toBe(draft.week + 1);
    const record = prepareCanonicalResolutionRecord(result, 'record');
    expect(record.finalOutcome.data).toEqual(
      JSON.parse(JSON.stringify(committed)),
    );
    expect(record.source).toEqual(draft);
    expect(record.sourceMilitiaSnapshot).toEqual(snapshot);
  }
});

test('[rules.P06.compound-state] the complete committed state matches independently specified officer, rescue, cache, market, queue and buyoff effects', () => {
  const { input, before, expected } = compoundAcceptanceFixture();
  const result = resolveCanonicalWeeklyDraft(input);
  expect(
    result.phases!.activity.slots.map((slot) => slot.overAllowance),
  ).toEqual([false, false, false, false]);
  expect(result.finalPlan.effects.adjudication.rulesExceptions).toEqual([
    {
      exceptionId: 'rescuers-permission',
      subjectId: 'rescue',
      ruleId: 'team-condition',
      reason:
        'The disabled rescuers can undertake this limited rescue mission.',
    },
  ]);
  expect(result.finalPlan.before).toEqual(before);
  expect(result.outcome).toEqual(expected);
  expect(applyCanonicalResolutionPlan(before, result.finalPlan)).toEqual(
    expected,
  );
  const baseline = structuredClone(expected);
  baseline.militiaSnapshot.settlements[0]!.reputation = 'Indifferent';
  expect(result.baseline).toEqual(baseline);
  expect(
    prepareCanonicalResolutionRecord(result, 'compound').finalOutcome.data,
  ).toEqual(expected);
});

test('[rules.P06.baseline] ordered Upkeep deposits and Activity costs precede Theft and persistent buyoff, then adjustments apply', () => {
  const input = fixture();
  const draft = input.revision;
  input.militiaSnapshot.roster.officers = [
    { characterId: 'pc', role: 'ambassador' },
  ];
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 10001,
    },
  ];
  draft.activity.slots[0]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    instruction: 'Scout',
    costCopper: 3001,
  };
  draft.acknowledgements.push({
    acknowledgementId: 'work-receipt',
    subjectId: 'special:work',
    outcome: 'Scouted.',
  });
  draft.event.occurrences = [
    { eventId: 'theft', origin: { kind: 'rolled' }, tableRoll: roll(100, 74) },
  ];
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  draft.tableAdjustments = [
    {
      kind: 'militia_value',
      adjustmentId: 'reward',
      field: 'treasuryCopper',
      operation: 'add',
      value: 3,
      reason: 'Found three copper',
    },
  ];
  const result = resolveCanonicalWeeklyDraft(input);
  expect(result.baseline!.militiaSnapshot.treasuryCopper).toBe(12500);
  expect(result.outcome!.militiaSnapshot.treasuryCopper).toBe(12503);
  expect(result.outcome!.context.carriedEvents).toEqual([]);
  expect(result.outcome!.context.lastBuyoffWeek).toBe(draft.week);
  expect(
    result.finalPlan.effects.upkeep.some(
      (effect) => effect.kind === 'treasury',
    ),
  ).toBe(true);
  expect(
    result.finalPlan.effects.activity.some(
      (effect) => effect.kind === 'special_result',
    ),
  ).toBe(true);
});

test('[rules.P06.no-hidden] applying a reviewed plan copies the exact full result once and refuses stale state', () => {
  const input = fixture();
  const original = structuredClone(input);
  const result = resolveCanonicalWeeklyDraft(input);
  const committed = applyCanonicalResolutionPlan(
    result.finalPlan.before,
    result.finalPlan,
  );
  expect(() =>
    applyCanonicalResolutionPlan(committed, result.finalPlan),
  ).toThrow('changed');
  expect(input).toEqual(original);
  committed.militiaSnapshot.treasuryCopper = 0;
  expect(result.finalPlan.after.militiaSnapshot.treasuryCopper).toBe(
    original.militiaSnapshot.treasuryCopper,
  );
});

test('[rules.P07.reason] blank reasons block and full source preserves embedded and top-level adjudication in immutable history', () => {
  const input = fixture();
  input.revision.tableAdjustments = [
    {
      kind: 'militia_value',
      adjustmentId: 'reward',
      field: 'training',
      operation: 'add',
      value: 0,
      reason: ' ',
    },
  ];
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
  input.revision.tableAdjustments[0]!.reason = 'Intentional override';
  const result = resolveCanonicalWeeklyDraft(input);
  const record = prepareCanonicalResolutionRecord(result, 'record');
  expect(record.adjudication).toEqual(result.finalPlan.effects.adjudication);
  input.revision.tableAdjustments[0]!.reason = 'Changed later';
  expect(record.source.tableAdjustments[0]!.reason).toBe(
    'Intentional override',
  );
});

test('[rules.P07.distinction] a Rules Exception permits a disabled team without changing its cost or outcome arithmetic', () => {
  const input = fixture();
  input.militiaSnapshot.roster.teams[0]!.status = 'disabled';
  input.revision.upkeep.teamDecisions = [
    {
      teamId: input.militiaSnapshot.roster.teams[0]!.teamId,
      decision: 'leave',
    },
  ];
  input.revision.activity.slots = [
    {
      slotId: 'work-slot',
      choice: {
        choiceId: 'work',
        actionId: 'special',
        teamId: input.militiaSnapshot.roster.teams[0]!.teamId,
        instruction: 'Scout',
        costCopper: 7,
      },
    },
  ];
  input.revision.acknowledgements.push({
    acknowledgementId: 'work-receipt',
    subjectId: 'special:work',
    outcome: 'Scouted.',
  });
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
  input.revision.rulesExceptions = [
    {
      exceptionId: 'extra',
      subjectId: 'work',
      ruleId: 'team-condition',
      reason: 'Limited scouting approved while recovering',
    },
  ];
  const result = resolveCanonicalWeeklyDraft(input);
  expect(result.baseline!.militiaSnapshot.treasuryCopper).toBe(
    input.militiaSnapshot.treasuryCopper - 7,
  );
  expect(result.finalPlan.effects.adjudication.rulesExceptions).toEqual(
    input.revision.rulesExceptions,
  );
  input.revision.activity.slots[0]!.choice!.costCopper = undefined;
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
});

test('[rules.P07.integrity] adjustments and unused referenced entities must belong to the source even when an exception exists', () => {
  const input = fixture();
  input.revision.tableAdjustments = [
    {
      kind: 'team_status',
      adjustmentId: 'status',
      teamId: 'foreign',
      status: 'active',
      reason: 'GM permission',
    },
  ];
  expect(projectWeeklyDraft(input).requirements).toContain(
    'adjustment:status:team',
  );
  input.revision.tableAdjustments = [];
  input.revision.upkeep.nearestSettlementId = 'foreign';
  expect(projectWeeklyDraft(input).requirements).toContain(
    'upkeep:nearest-settlement:reference',
  );
  input.revision.upkeep.nearestSettlementId = 'town';
  input.militiaSnapshot.characters.push({
    ...input.militiaSnapshot.characters[0]!,
  });
  expect(projectWeeklyDraft(input).status).toBe('incomplete');
});

test('[rules.P07.source-references] dangling source asset and character references block an otherwise complete week', () => {
  const mutations: ((input: ReturnType<typeof fixture>) => void)[] = [
    (x) => {
      x.militiaSnapshot.economy!.caches[0]!.itemIds = ['foreign'];
    },
    (x) => {
      x.militiaSnapshot.economy!.items[0]!.ownerCharacterId = 'foreign';
    },
    (x) => {
      x.militiaSnapshot.characterActions = {
        people: [
          {
            characterId: 'foreign',
            status: 'available',
            location: { kind: 'headquarters' },
            directRescueRequired: false,
            capture: null,
          },
        ],
      };
    },
    (x) => {
      x.revision.context = {
        ...x.revision.context,
        orders: [
          {
            orderId: 'old',
            itemId: 'foreign',
            settlementId: 'town',
            orderedDay: 0,
            dueDay: 7,
            priceCopper: 1,
            receipt: null,
          },
        ],
      };
    },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input);
    expect(projectWeeklyDraft(input).status).toBe('incomplete');
  }
});

test('[rules.P07.order] conflicting adjustments apply in order after the baseline and ending targets a specific event occurrence', () => {
  const input = fixture();
  input.revision.context = {
    ...input.revision.context,
    carriedEvents: [
      ...input.revision.context.carriedEvents,
      {
        ...input.revision.context.carriedEvents[0]!,
        eventId: 'other',
        order: 1,
      },
    ],
  };
  input.revision.tableAdjustments = [
    {
      kind: 'militia_value',
      adjustmentId: 'set',
      field: 'treasuryCopper',
      operation: 'set',
      value: 100,
      reason: 'Correction',
    },
    {
      kind: 'militia_value',
      adjustmentId: 'add',
      field: 'treasuryCopper',
      operation: 'add',
      value: 7,
      reason: 'Reward',
    },
    {
      kind: 'event_end',
      adjustmentId: 'end',
      eventId: 'carried',
      reason: 'Resolved in play',
    },
    {
      kind: 'team_status',
      adjustmentId: 'disable',
      teamId: 'team',
      status: 'disabled',
      reason: 'Injury',
    },
    {
      kind: 'settlement_reputation',
      adjustmentId: 'town',
      settlementId: 'town',
      reputation: 'Friendly',
      reason: 'Favor',
    },
  ];
  const result = resolveCanonicalWeeklyDraft(input);
  expect(result.outcome!.militiaSnapshot.treasuryCopper).toBe(107);
  expect(result.outcome!.context.carriedEvents.map((x) => x.eventId)).toEqual([
    'other',
  ]);
  expect(result.baseline!.context.carriedEvents).toHaveLength(2);
  expect(result.outcome!.militiaSnapshot.roster.teams[0]!.status).toBe(
    'disabled',
  );
  expect(result.outcome!.militiaSnapshot.settlements[0]!.reputation).toBe(
    'Friendly',
  );
  expect(weeklySourceKey(result.baseline)).not.toBe(
    weeklySourceKey(result.outcome),
  );
});

test('[rules.P79.intermediate-identity] an earlier recruited team remains a valid reference when dismissed later in the same Activity', () => {
  const { snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 100000;
  const draft = createWeeklyDraft({
    draftId: 'recruit-dismiss',
    week: 1,
    slotIds: ['one', 'two'],
    context: {
      firstMilitiaWeek: true,
      startDay: 0,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'r',
    actionId: 'recruit_team',
    teamType: 'informants',
    rolls: { check: roll(20, 20) },
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'd',
    actionId: 'dismiss_team',
    targetTeamId: 'recruit:r',
    rolls: { check: roll(20, 20) },
  };
  draft.event.chanceRoll = roll(100, 100);
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  expect(preview.requirements).toEqual([]);
  expect(preview.status).toBe('ready');
  expect(preview.finalPlan?.after.militiaSnapshot.roster.teams).toEqual([]);
  expect(preview.phases?.activity.plan).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'recruit_team',
        team: expect.objectContaining({ teamId: 'recruit:r' }),
      }),
      expect.objectContaining({ kind: 'remove_team', teamId: 'recruit:r' }),
    ]),
  );
  draft.activity.slots.reverse();
  expect(
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot })
      .requirements,
  ).toContain('d:target-team:reference');
});
