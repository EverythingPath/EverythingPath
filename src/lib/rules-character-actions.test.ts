import { assert, expect, test } from 'vitest';
import { characterFixture } from '../../tests/rules/character-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { projectActivity } from './rules-activity';
import { stagedActionChoiceSchema } from './weekly-draft-facts';

test('[rules.A16.rescue] rescue updates the tracked person and floors odd failed level Notoriety', () => {
  const { draft, snapshot, choice } = characterFixture('rescue_character');
  assert(choice.actionId === 'rescue_character');
  snapshot.characters.find((entry) => entry.characterId === 'pc')!.level = 5;
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.characterActions?.people[0]).toMatchObject({
    status: 'available',
    location: { kind: 'headquarters' },
    capture: null,
    rescuedWeek: draft.week,
  });
  expect(result.outcome.notoriety).toBe(15);
  choice.rolls = { check: roll(20, 1) };
  result = projectActivity(draft, snapshot);
  expect(result.outcome.notoriety).toBe(12);
  expect(result.outcome.characterActions).toEqual(snapshot.characterActions);
  snapshot.characterActions!.people[0]!.capture = {
    source: 'raid',
    week: draft.week - 1,
  };
  choice.rolls = { check: roll(20, 7) };
  expect(projectActivity(draft, snapshot).plan).toContainEqual(
    expect.objectContaining({ kind: 'rescue_result', dc: 8, succeeded: true }),
  );
});

test('[rules.A16.eligibility] rescue requires owned captured targets, destination and reasoned direct-rescue exceptions', () => {
  const { draft, snapshot, choice } = characterFixture('rescue_character');
  if (choice.actionId !== 'rescue_character') throw Error('fixture');
  choice.destination = { kind: 'refuge', settlementId: 'town' };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:active-refuge:exception',
  );
  snapshot.settlements[0]!.refugeActivatedWeek = draft.week;
  snapshot.settlements[0]!.refugeActiveUntilWeek = draft.week;
  snapshot.characterActions!.people[0]!.directRescueRequired = true;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:direct-rescue:exception',
  );
  draft.rulesExceptions = [
    {
      exceptionId: 'direct',
      subjectId: 'character',
      ruleId: 'direct-rescue',
      reason: 'GM permits rescue',
    },
  ];
  expect(projectActivity(draft, snapshot).ready).toBe(true);
  choice.characterId = 'foreign';
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:character',
  );
});

test('[rules.A17.restore] all paid scroll costs and free party outcomes retain recipients and acknowledgements', () => {
  for (const [mode, cost] of [
    ['break_enchantment', 112500],
    ['raise_dead', 612500],
    ['restoration', 170000],
    ['stone_to_flesh', 165000],
    ['ability_damage', 0],
    ['hit_points', 0],
    ['restorative_effect', 0],
  ] as const) {
    const { draft, snapshot, choice } = characterFixture('restore_character');
    if (choice.actionId !== 'restore_character') throw Error('fixture');
    choice.mode = mode;
    choice.effect = 'Remove paralysis';
    choice.effectLevel = 3;
    const result = projectActivity(draft, snapshot);
    expect(result.ready, mode).toBe(true);
    expect(result.outcome.treasuryCopper, mode).toBe(
      snapshot.treasuryCopper - cost,
    );
    expect(result.plan).toContainEqual(
      expect.objectContaining({
        kind: 'restoration',
        costCopper: cost,
        characterIds: ['pc'],
      }),
    );
    expect(result.outcome.characterActions?.people[0]).toMatchObject({
      status: 'recovering',
      restoredWeek: draft.week,
    });
  }
});

test('[rules.A17.readiness] restoration requires presence, effect level, owned state and separate cost exceptions', () => {
  const { draft, snapshot, choice } = characterFixture('restore_character');
  if (choice.actionId !== 'restore_character') throw Error('fixture');
  delete choice.targetPresent;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:target-present',
  );
  choice.targetPresent = true;
  choice.mode = 'restorative_effect';
  expect(projectActivity(draft, snapshot).requirements).toEqual(
    expect.arrayContaining(['character:effect', 'character:effect-level']),
  );
  choice.effect = 'Greater restoration';
  choice.effectLevel = 7;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:restorative-level:exception',
  );
  choice.mode = 'restoration';
  choice.costCopper = 1;
  expect(projectActivity(draft, snapshot).outcome.treasuryCopper).toBe(
    snapshot.treasuryCopper - 170000,
  );
  snapshot.treasuryCopper = 0;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:treasury:exception',
  );
});

test('[rules.A09.information] tier bonus applies once and a natural one can succeed while gaining Notoriety', () => {
  const { draft, snapshot, choice } = characterFixture('gather_information');
  assert(choice.actionId === 'gather_information');
  for (const [teamType, bonus] of [
    ['informants', 2],
    ['conspirators', 4],
    ['scholars', 6],
  ] as const) {
    snapshot.roster.teams[0]!.teamType = teamType;
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.checks[0]?.modifiers).toContainEqual({
      source: 'gather-tier',
      value: bonus,
    });
  }
  choice.rolls = {
    check: {
      ...roll(20, 1),
      modifiers: [
        { sourceId: 'gather-tier', value: 6, reason: 'Computed' },
        { sourceId: 'table', value: 10, reason: 'Table modifier' },
      ],
    },
    notoriety: roll(6, 4),
  };
  const result = projectActivity(draft, snapshot);
  expect(result.plan).toContainEqual(
    expect.objectContaining({
      kind: 'information',
      total: 20,
      succeeded: true,
    }),
  );
  expect(result.outcome.notoriety).toBe(14);
});

test('[rules.A11.knowledge] knowledge records achieved DC with rank exactly once and recomputes upstream rank', () => {
  const { draft, snapshot, choice } = characterFixture('knowledge_check');
  assert(choice.actionId === 'knowledge_check');
  choice.rolls!.check!.modifiers = [
    { sourceId: 'knowledge-rank', value: 3, reason: 'Computed' },
  ];
  const result = projectActivity(draft, snapshot);
  expect(result.plan).toContainEqual(
    expect.objectContaining({ kind: 'information', achievedDc: 16 }),
  );
  snapshot.rank = 1;
  expect(projectActivity(draft, snapshot).plan).toContainEqual(
    expect.objectContaining({ kind: 'information', achievedDc: 13 }),
  );
});

test('[rules.A23.support] support lasts at least one round, rounds down higher ranks, and preserves following week, once and extraction quantities', () => {
  const { draft, snapshot, choice } = characterFixture('strike_team');
  if (choice.actionId !== 'strike_team') throw Error('fixture');
  for (const [rank, rounds] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
  ] as const) {
    snapshot.rank = rank;
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.plan).toContainEqual(
      expect.objectContaining({
        kind: 'strike_support',
        rounds,
        availableWeek: draft.week + 1,
        expiresWeek: draft.week + 1,
        uses: 1,
        attackBonus: 2,
        damageBonus: 2,
        saveBonus: 2,
      }),
    );
  }
  choice.mode = 'extraction';
  expect(projectActivity(draft, snapshot).plan).toContainEqual(
    expect.objectContaining({
      kind: 'strike_extraction',
      stabilizeBleeding: true,
      gentleReposeCasterLevel: 12,
      extractBodiesTo: 'headquarters',
    }),
  );
});

test('[rules.A20.special] special records explicit zero or paid cost and story result without inventing resource rewards', () => {
  const { draft, snapshot, choice } = characterFixture('special');
  expect(projectActivity(draft, snapshot).plan).toContainEqual(
    expect.objectContaining({ kind: 'special_result', costCopper: 0 }),
  );
  choice.costCopper = 2300;
  expect(projectActivity(draft, snapshot).outcome.treasuryCopper).toBe(
    snapshot.treasuryCopper - 2300,
  );
  delete choice.costCopper;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'character:cost',
  );
});

test('[rules.A17.stale] missing acknowledgements remain incomplete and replacement removes all prior recovery effects', () => {
  for (const action of [
    'rescue_character',
    'restore_character',
    'gather_information',
    'knowledge_check',
    'strike_team',
    'special',
  ] as const) {
    const { draft, snapshot, choice } = characterFixture(action);
    choice.acknowledgements = [];
    expect(projectActivity(draft, snapshot).requirements).toContain(
      `character:acknowledgement:${action}:character`,
    );
    draft.activity.slots[0]!.choice = {
      choiceId: 'replacement',
      actionId: 'special',
      instruction: 'Wait',
      costCopper: 0,
      acknowledgements: [
        {
          acknowledgementId: 'wait',
          subjectId: 'special:replacement',
          outcome: 'Waited',
        },
      ],
    };
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.characterActions).toEqual(snapshot.characterActions);
    expect(
      result.plan.every(
        (entry) => !('choiceId' in entry) || entry.choiceId === 'replacement',
      ),
    ).toBe(true);
  }
  expect(
    stagedActionChoiceSchema.safeParse({
      choiceId: 'new',
      actionId: 'special',
      destination: { kind: 'headquarters' },
    }).success,
  ).toBe(false);
});

test('[rules.A17.death] healing and non-resurrection scrolls preserve dead recipients, while raise dead restores life', () => {
  for (const mode of [
    'ability_damage',
    'hit_points',
    'restoration',
    'raise_dead',
  ] as const) {
    const { draft, snapshot, choice } = characterFixture('restore_character');
    if (choice.actionId !== 'restore_character') throw Error('fixture');
    snapshot.characterActions!.people[0]!.status = 'dead';
    choice.mode = mode;
    expect(
      projectActivity(draft, snapshot).outcome.characterActions?.people[0]
        ?.status,
    ).toBe(mode === 'raise_dead' ? 'recovering' : 'dead');
  }
});

test('[rules.A17.ordered] rescue to a refuge makes subsequent restoration eligible and an upstream failed rescue invalidates it', () => {
  const { draft, snapshot, choice } = characterFixture('rescue_character');
  if (choice.actionId !== 'rescue_character') throw Error('fixture');
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'healers',
    teamType: 'spellcasters',
  });
  snapshot.characterActions!.people[0]!.location = {
    kind: 'elsewhere',
    location: 'Enemy camp',
  };
  snapshot.settlements[0]!.refugeActivatedWeek = draft.week;
  snapshot.settlements[0]!.refugeActiveUntilWeek = draft.week;
  choice.destination = { kind: 'refuge', settlementId: 'town' };
  const heal = characterFixture('restore_character').choice;
  heal.choiceId = 'heal';
  heal.teamId = 'healers';
  heal.acknowledgements = [
    {
      acknowledgementId: 'heal',
      subjectId: 'restore_character:heal',
      outcome: 'Restoration applied',
    },
  ];
  draft.activity.slots[1]!.choice = heal;
  expect(projectActivity(draft, snapshot).ready).toBe(true);
  expect(
    projectActivity(draft, snapshot).outcome.characterActions?.people[0],
  ).toMatchObject({
    status: 'recovering',
    rescuedWeek: draft.week,
    restoredWeek: draft.week,
  });
  choice.rolls = { check: roll(20, 1) };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'heal:character-captured:exception',
  );
  expect(
    projectActivity(draft, snapshot).plan.some(
      (entry) => entry.kind === 'restoration',
    ),
  ).toBe(false);
});

test('[rules.A09.repeat] independent information choices keep their own DC boundaries and outcomes', () => {
  const { draft, snapshot, choice } = characterFixture('gather_information');
  assert(choice.actionId === 'gather_information');
  snapshot.roster.teams[0]!.teamType = 'informants';
  choice.rolls = { check: roll(20, 9) };
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  const second = structuredClone(choice);
  second.choiceId = 'second';
  second.teamId = 'second';
  second.rolls = { check: roll(20, 10) };
  second.acknowledgements = [
    {
      acknowledgementId: 'second',
      subjectId: 'gather_information:second',
      outcome: 'Learned the route',
    },
  ];
  draft.activity.slots[1]!.choice = second;
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.plan).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'information',
        choiceId: 'character',
        total: 14,
        succeeded: false,
      }),
      expect.objectContaining({
        kind: 'information',
        choiceId: 'second',
        total: 15,
        succeeded: true,
      }),
    ]),
  );
});

test('[rules.A17.multiple] distinct spellcasters restore a mixed party and aggregate paid costs without reviving dead allies', () => {
  const { draft, snapshot, choice } = characterFixture('restore_character');
  if (choice.actionId !== 'restore_character') throw Error('fixture');
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'fallen',
  });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'fallen',
  });
  snapshot.characterActions!.people.push({
    ...snapshot.characterActions!.people[0]!,
    characterId: 'fallen',
    status: 'dead',
  });
  choice.mode = 'hit_points';
  let result = projectActivity(draft, snapshot);
  expect(result.plan).toContainEqual(
    expect.objectContaining({
      kind: 'restoration',
      scope: 'party',
      characterIds: ['pc', 'fallen'],
    }),
  );
  expect(result.outcome.characterActions!.people.map((p) => p.status)).toEqual([
    'recovering',
    'dead',
  ]);
  choice.mode = 'restoration';
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  const second = structuredClone(choice);
  second.choiceId = 'second';
  second.teamId = 'second';
  second.mode = 'raise_dead';
  second.characterId = 'fallen';
  second.acknowledgements = [
    {
      acknowledgementId: 'second',
      subjectId: 'restore_character:second',
      outcome: 'Raise dead applied with its spell conditions',
    },
  ];
  draft.activity.slots[1]!.choice = second;
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(217500);
  expect(result.outcome.characterActions!.people.map((p) => p.status)).toEqual([
    'recovering',
    'recovering',
  ]);
});

test('[rules.A71.inputs] each action retains every required selection and schema rejects malformed action facts', () => {
  const cases = [
    ['rescue_character', 'characterId', 'character'],
    ['rescue_character', 'destination', 'destination'],
    ['restore_character', 'mode', 'mode'],
    ['restore_character', 'characterId', 'character'],
    ['restore_character', 'targetPresent', 'target-present'],
    ['gather_information', 'subject', 'subject'],
    ['knowledge_check', 'subject', 'subject'],
    ['strike_team', 'mode', 'mode'],
    ['strike_team', 'location', 'location'],
    ['special', 'instruction', 'instruction'],
    ['special', 'costCopper', 'cost'],
  ] as const;
  for (const [action, key, required] of cases) {
    const { draft, snapshot, choice } = characterFixture(action);
    const partial = Object.fromEntries(
      Object.entries(choice).filter(([field]) => field !== key),
    );
    draft.activity.slots[0]!.choice = stagedActionChoiceSchema.parse(partial);
    expect(
      projectActivity(draft, snapshot).requirements,
      `${action}:${key}`,
    ).toContain(`character:${required}`);
  }
  expect(
    stagedActionChoiceSchema.safeParse({
      ...characterFixture('restore_character').choice,
      effectLevel: -1,
    }).success,
  ).toBe(false);
  expect(
    stagedActionChoiceSchema.safeParse({
      ...characterFixture('rescue_character').choice,
      destination: { kind: 'refuge' },
    }).success,
  ).toBe(false);
});

test('[rules.A16.raid-expiry] Raid special DC expires back to ordinary rescue without permanently barring the captured target', () => {
  const { draft, snapshot, choice } = characterFixture('rescue_character');
  assert(choice.actionId === 'rescue_character');
  snapshot.characters[0]!.level = 5;
  snapshot.characterActions!.people[0]!.capture = {
    source: 'raid',
    week: draft.week - 2,
  };
  choice.rolls = { check: roll(20, 20) };
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.plan).toContainEqual(
    expect.objectContaining({ kind: 'rescue_result', dc: 15, succeeded: true }),
  );
});
