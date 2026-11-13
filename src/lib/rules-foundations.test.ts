import { expect, test } from 'vitest';
import {
  projectRulesFoundations,
  type FoundationInput,
} from './rules-foundations';

function input(overrides: Partial<FoundationInput> = {}): FoundationInput {
  return {
    rank: 1,
    training: 0,
    focus: 'Loyalty',
    week: 4,
    roster: { people: [], teams: [], officers: [] },
    characters: [],
    slots: [],
    checks: [],
    settlements: [],
    operatingSettlementId: null,
    bonuses: [],
    queuedEffects: [],
    ...overrides,
  };
}

test('[rules.F04.shrink] rank one preserves complete occupied extra choices', () => {
  const slots = [
    {
      slotId: 'one',
      choice: { choiceId: 'a', actionId: 'drill_militia' as const },
    },
    {
      slotId: 'two',
      choice: {
        choiceId: 'b',
        actionId: 'earn_gold' as const,
        teamId: 'patrons-2',
        costCopper: 12,
      },
    },
  ];
  const result = projectRulesFoundations(input({ slots }));
  expect(result.capacity.actions).toBe(1);
  expect(result.slots.map((x) => x.choice)).toEqual(slots.map((x) => x.choice));
  expect(result.slots.map((x) => x.overAllowance)).toEqual([false, true]);
});

// Literal rows from Table 6-1, independent of the implementation tables.
const rows = [
  [1, 0, 2, 0, 1, 2],
  [2, 10, 3, 0, 2, 2],
  [3, 15, 3, 1, 2, 3],
  [4, 20, 4, 1, 2, 3],
  [5, 30, 4, 1, 2, 4],
  [6, 40, 5, 2, 2, 4],
  [7, 55, 5, 2, 3, 4],
  [8, 75, 6, 2, 3, 5],
  [9, 105, 6, 3, 3, 5],
  [10, 160, 7, 3, 3, 5],
  [11, 235, 7, 3, 4, 6],
  [12, 330, 8, 4, 4, 6],
  [13, 475, 8, 4, 4, 6],
  [14, 665, 9, 4, 4, 6],
  [15, 855, 9, 5, 5, 7],
  [16, 1350, 10, 5, 5, 7],
  [17, 1900, 10, 5, 5, 7],
  [18, 2700, 11, 6, 5, 7],
  [19, 3850, 11, 6, 6, 7],
  [20, 5350, 12, 6, 6, 8],
] as const;
for (const [rank, training, focused, secondary, actions, teams] of rows) {
  test(`[rules.F02.rank-${rank}-threshold] training boundary at rank ${rank}`, () => {
    for (const [value, expected] of [
      [training - 1, Math.max(1, rank - 1)],
      [training, rank],
      [training + 1, rank],
    ]) {
      expect(
        projectRulesFoundations(
          input({
            training: Math.max(0, value!),
            roster: {
              people: [{ characterId: 'pc', kind: 'pc', hitDice: 20 }],
              officers: [],
              teams: [],
            },
            characters: [character('pc', { level: 20 })],
          }),
        ).progression.eligibleRank,
      ).toBe(expected);
    }
  });
  test(`[rules.F03.rank-${rank}-focus] all three focuses at rank ${rank}`, () => {
    for (const focus of ['Loyalty', 'Secrecy', 'Security'] as const) {
      const result = projectRulesFoundations(input({ rank, focus }));
      expect(result.organizationChecks).toEqual({
        loyalty: focus === 'Loyalty' ? focused : secondary,
        secrecy: focus === 'Secrecy' ? focused : secondary,
        security: focus === 'Security' ? focused : secondary,
      });
    }
  });
  test(`[rules.F04.rank-${rank}-actions] action capacity at rank ${rank}`, () => {
    expect(projectRulesFoundations(input({ rank })).capacity.actions).toBe(
      actions,
    );
  });
  test(`[rules.F05.rank-${rank}-teams] team capacity at rank ${rank}`, () => {
    expect(projectRulesFoundations(input({ rank })).capacity.teams).toBe(teams);
  });
}
function character(
  characterId: string,
  overrides: Partial<FoundationInput['characters'][number]> = {},
): FoundationInput['characters'][number] {
  return {
    characterId,
    level: 1,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    isActive: true,
    ...overrides,
  };
}
test('[rules.F02.retention] lost training never lowers current rank', () => {
  expect(
    projectRulesFoundations(input({ rank: 8 })).progression.eligibleRank,
  ).toBe(8);
});
test('[rules.F02.pc-cap] current active PCs cap advancement; no PC does not invent a cap', () => {
  const source = input({
    training: 5350,
    roster: {
      people: [
        { characterId: 'pc', kind: 'pc', hitDice: 2 },
        { characterId: 'npc', kind: 'npc', hitDice: 20 },
      ],
      officers: [],
      teams: [],
    },
    characters: [
      character('pc', { level: 4 }),
      character('npc', { level: 20 }),
    ],
  });
  expect(projectRulesFoundations(source).progression.eligibleRank).toBe(4);
  source.characters[0]!.isActive = false;
  expect(projectRulesFoundations(source).requirements).toContain(
    'highest-level-pc',
  );
  expect(projectRulesFoundations(source).progression.eligibleRank).toBe(1);
});

test('[rules.F03.composition] rank, negative officers, managers and context compose exactly once per occurrence', () => {
  const source = input({
    rank: 2,
    roster: {
      people: [
        { characterId: 'a', kind: 'pc', hitDice: 3 },
        { characterId: 'b', kind: 'pc', hitDice: 5 },
      ],
      officers: [
        { role: 'ambassador', characterId: 'a' },
        { role: 'ambassador', characterId: 'b' },
        { role: 'overseer', characterId: 'a' },
        { role: 'strategist', characterId: 'a' },
        { role: 'strategist', characterId: 'b' },
      ],
      teams: [team('first'), team('second')],
    },
    characters: [
      character('a', { constitution: 6, charisma: 8 }),
      character('b', { constitution: 4, charisma: 6 }),
    ],
    slots: [
      {
        slotId: '1',
        choice: { choiceId: 'one', actionId: 'earn_gold', teamId: 'first' },
      },
      { slotId: '2', choice: null },
      {
        slotId: '3',
        choice: { choiceId: 'two', actionId: 'earn_gold', teamId: 'second' },
      },
    ],
    checks: [
      {
        checkId: 'one-check',
        phase: 'activity',
        check: 'loyalty',
        choiceId: 'one',
        die: 10,
      },
      {
        checkId: 'two-check',
        phase: 'activity',
        check: 'loyalty',
        choiceId: 'two',
        die: 10,
      },
    ],
    queuedEffects: [
      {
        effectId: 'penalty',
        sourceId: 'event-a',
        startsWeek: 4,
        endsWeek: 4,
        effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
      },
    ],
  });
  const result = projectRulesFoundations(source);
  expect(result.capacity.actions).toBe(3);
  expect(result.organizationChecks).toEqual({
    loyalty: 2,
    secrecy: 1,
    security: 1,
  });
  expect(result.checks.map((x) => x.total)).toEqual([10, 12]);
  expect(result.checks[1]?.modifiers.map((x) => x.source)).toContain(
    'strategist',
  );
});
function team(
  teamId: string,
  overrides: Partial<FoundationInput['roster']['teams'][number]> = {},
): FoundationInput['roster']['teams'][number] {
  return {
    teamId,
    teamType: 'patrons',
    name: teamId,
    status: 'active',
    rewardCapExempt: false,
    managerCharacterId: 'a',
    notes: '',
    ...overrides,
  };
}
test('[rules.O01.commandants] distinct commandants stack their Hit Dice override, zero included, or else their level', () => {
  const source = input({
    roster: {
      people: [
        { characterId: 'a', kind: 'pc', hitDice: 3 },
        { characterId: 'b', kind: 'npc', hitDice: 7 },
      ],
      officers: [
        { role: 'commandant', characterId: 'a' },
        { role: 'commandant', characterId: 'b' },
      ],
      teams: [],
    },
    characters: [character('a'), character('b', { level: 2 })],
  });
  const bonus = () =>
    projectRulesFoundations(source).officers.commandantTrainingBonus;
  expect(bonus()).toBe(10);
  // Blank follows the record's level; zero is an explicit override.
  source.roster.people[1]!.hitDice = null;
  expect(bonus()).toBe(5);
  expect(projectRulesFoundations(source).requirements).toEqual([]);
  source.characters[1]!.level = 6;
  expect(bonus()).toBe(9);
  source.roster.people[1]!.hitDice = 0;
  expect(bonus()).toBe(3);
  // An archived commandant still counts, with its warning.
  source.characters[1]!.isActive = false;
  source.roster.people[1]!.hitDice = null;
  expect(bonus()).toBe(9);
  expect(projectRulesFoundations(source).warnings).toContain(
    'officer:b:archived',
  );
  // A missing character stays a blocking integrity problem.
  source.characters.pop();
  expect(bonus()).toBe(3);
  expect(projectRulesFoundations(source).requirements).toContain(
    'officer:b:character',
  );
});
test('[rules.O04.one-use] overseer support selects one event occurrence rather than one individual check', () => {
  const source = input({
    roster: {
      people: [{ characterId: 'a', kind: 'pc', hitDice: 3 }],
      officers: [{ role: 'overseer', characterId: 'a' }],
      teams: [],
    },
    characters: [character('a', { strength: 18 })],
    checks: [
      {
        checkId: 'raid-1',
        eventId: 'first-raid',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'a',
      },
      {
        checkId: 'raid-2',
        eventId: 'second-raid',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'a',
      },
    ],
  });
  const result = projectRulesFoundations(source);
  expect(result.checks.map((x) => x.total)).toEqual([15, 11]);
  expect(result.requirements).toContain('raid-2:overseer-already-used');
});

test('[rules.F05.rewards] repeated teams retain identities, conditions and manager limits', () => {
  const source = input({
    roster: {
      people: [{ characterId: 'a', kind: 'pc', hitDice: 1 }],
      officers: [],
      teams: [
        team('first'),
        team('second', { status: 'missing' }),
        team('reward', { status: 'disabled', rewardCapExempt: true }),
      ],
    },
    characters: [character('a', { charisma: 8 })],
  });
  const result = projectRulesFoundations(source);
  expect(result.capacity.countedTeams).toBe(2);
  expect(
    result.teams.map((x) => [
      x.teamId,
      x.available,
      x.manager?.maxTeams,
      x.manager?.managedTeams,
    ]),
  ).toEqual([
    ['first', true, 1, 3],
    ['second', false, 1, 3],
    ['reward', false, 1, 3],
  ]);
  expect(result.warnings).toContain('manager:a:capacity');
});
test('[rules.T03.upgrade] team trees retain inherited actions and destination costs', () => {
  const source = input({
    roster: {
      people: [],
      officers: [],
      teams: [
        team('m', { teamType: 'infiltrators', managerCharacterId: null }),
        team('s', { teamType: 'spies', managerCharacterId: null }),
        team('t', { teamType: 'merchants', managerCharacterId: null }),
      ],
    },
  });
  const result = projectRulesFoundations(source);
  expect(result.teams[0]).toMatchObject({
    tier: 2,
    actions: ['reduceDanger', 'rescueCharacter'],
    upgrades: [
      { teamType: 'guardians', costCopper: 100000 },
      { teamType: 'specialists', costCopper: 100000 },
    ],
  });
  expect(result.teams[1]).toMatchObject({
    tier: 3,
    actions: ['covertAction', 'secureCache', 'spreadPropaganda'],
    upgrades: [],
  });
  expect(result.teams[2]?.upgrades).toEqual([
    { teamType: 'blackMarketeers', costCopper: 20000 },
    { teamType: 'fixers', costCopper: 20000 },
  ]);
});
test('[rules.T05.upgrade-act] recruited teams may act, used or newly upgraded teams may not', () => {
  const source = input({
    roster: {
      people: [],
      officers: [],
      teams: [
        team('new', { managerCharacterId: null }),
        team('upgraded', { managerCharacterId: null }),
        team('used', { managerCharacterId: null }),
      ],
    },
    activity: { usedTeamIds: ['used'], upgradedTeamIds: ['upgraded'] },
  });
  expect(projectRulesFoundations(source).teams.map((x) => x.available)).toEqual(
    [true, false, false],
  );
});

test('five reputation rows apply operating context and copper prices', () => {
  const expected = [
    [5, 5, 0, 10501],
    [2, 0, 5, 10001],
    [0, 0, 0, 10001],
    [-2, 0, -5, 10001],
    [0, -5, 0, 9501],
  ];
  for (const [i, reputation] of (
    ['Hostile', 'Unfriendly', 'Indifferent', 'Friendly', 'Helpful'] as const
  ).entries()) {
    const source = input({
      settlements: [settlement('home', { reputation })],
      operatingSettlementId: 'home',
      purchases: [
        { purchaseId: 'p', settlementId: 'home', priceCopper: 10001 },
      ],
    });
    const result = projectRulesFoundations(source);
    expect([
      result.settlements[0]?.socialDcModifier,
      result.settlements[0]?.pricePercent,
      result.eventChanceModifier,
      result.purchases[0]?.costCopper,
    ]).toEqual(expected[i]);
    source.operatingSettlementId = null;
    expect(projectRulesFoundations(source).eventChanceModifier).toBe(0);
  }
});
function settlement(
  settlementId: string,
  overrides: Partial<FoundationInput['settlements'][number]> = {},
): FoundationInput['settlements'][number] {
  return {
    settlementId,
    name: settlementId,
    reputation: 'Indifferent',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
    ...overrides,
  };
}
test('[rules.F07.helpful] Helpful and carried bonuses apply once to a selected Activity check', () => {
  const source = input({
    settlements: [settlement('home', { reputation: 'Helpful' })],
    operatingSettlementId: 'home',
    bonuses: [
      {
        bonusId: 'gift',
        source: 'Reward',
        check: 'loyalty',
        value: 3,
        availableWeek: 4,
        consumedWeek: null,
      },
    ],
    slots: [
      { slotId: 'one', choice: { choiceId: 'one', actionId: 'drill_militia' } },
      { slotId: 'two', choice: { choiceId: 'two', actionId: 'drill_militia' } },
    ],
    checks: [
      {
        checkId: 'one',
        choiceId: 'one',
        phase: 'activity',
        check: 'loyalty',
        die: 10,
        helpful: true,
        bonusIds: ['gift', 'gift'],
      },
      {
        checkId: 'two',
        choiceId: 'two',
        phase: 'activity',
        check: 'loyalty',
        die: 10,
        helpful: true,
        bonusIds: ['gift'],
      },
    ],
  });
  const result = projectRulesFoundations(source);
  expect(result.checks.map((x) => x.total)).toEqual([17, 12]);
  expect(result.requirements).toContain('two:helpful-already-used');
  expect(result.requirements).toContain('two:bonus:gift:unavailable');
});
test('[rules.F07.effective] temporary shifts and active refuge determine effective reputation', () => {
  const source = input({
    settlements: [
      settlement('home', {
        reputation: 'Hostile',
        temporaryReputationShift: 1,
        refugeActivatedWeek: 4,
        refugeActiveUntilWeek: 4,
      }),
    ],
    operatingSettlementId: 'home',
  });
  expect(projectRulesFoundations(source).settlements[0]?.reputation).toBe(
    'Indifferent',
  );
  source.week = 5;
  expect(projectRulesFoundations(source).eventChanceModifier).toBe(5);
  source.settlements[0]!.reputation = null;
  expect(projectRulesFoundations(source).requirements).toContain(
    'settlement:home:reputation',
  );
});
test('whole counts round down with zero allowed, prices retain copper', () => {
  const source = input({
    rank: 1,
    purchases: [
      {
        purchaseId: 'p',
        settlementId: 'home',
        priceCopper: 105,
        marketDay: true,
      },
    ],
    settlements: [settlement('home', { reputation: 'Helpful' })],
  });
  expect(projectRulesFoundations(source).strikeTeamRounds).toBe(0);
  expect(projectRulesFoundations({ ...source, rank: 3 }).strikeTeamRounds).toBe(
    1,
  );
  expect(projectRulesFoundations(source).purchases[0]?.costCopper).toBe(95);
});

test('[rules.F09.xp-rounding] crossed boons list PC recipients and floor each XP share', () => {
  const roster: FoundationInput['roster'] = {
    people: [
      { characterId: 'a', kind: 'pc', hitDice: 1 },
      { characterId: 'b', kind: 'pc', hitDice: 1 },
      { characterId: 'c', kind: 'pc', hitDice: 1 },
      { characterId: 'npc', kind: 'npc', hitDice: 20 },
    ],
    officers: [],
    teams: [],
  };
  const result = projectRulesFoundations(
    input({
      rank: 9,
      training: 160,
      roster,
      characters: roster.people.map((p) =>
        character(p.characterId, { level: 10 }),
      ),
    }),
  );
  expect(result.progression.boons).toEqual([
    {
      rank: 10,
      kind: 'xp',
      xp: 3200,
      xpPerPc: 1066,
      characterIds: ['a', 'b', 'c'],
    },
  ]);
});
test('[rules.F09.packages] every crossed boon retains its prescribed package', () => {
  const result = projectRulesFoundations(
    input({
      training: 5350,
      roster: {
        people: [{ characterId: 'pc', kind: 'pc', hitDice: 20 }],
        teams: [],
        officers: [],
      },
      characters: [character('pc', { level: 20 })],
    }),
  );
  const boons = result.progression.boons;
  expect(boons.filter((x) => x.kind === 'skilled').map((x) => x.rank)).toEqual([
    2, 7, 12, 17,
  ]);
  expect(boons.filter((x) => x.kind === 'gift').map((x) => x.gift)).toEqual([
    'potion',
    '750 gp',
    'armor or wand',
    '3,000 gp',
    'wand or weapon',
    '8,000 gp',
    'magic item',
  ]);
  expect(
    boons.filter((x) => x.kind === 'title').map((x) => [x.title, x.feats]),
  ).toEqual([
    ['Director', ['Alertness', 'Deceitful', 'Persuasive', 'Stealthy']],
    ['Captain', ['Great Fortitude', 'Iron Will', 'Lightning Reflexes']],
    ['Commander', ['Fleet', 'Improved Initiative', 'Toughness']],
    ['Champion', ['Any feat the PC qualifies for']],
  ]);
  expect(
    boons
      .filter((x) => x.kind === 'gift')
      .map((x) => [x.maxValueCopper, x.fullyChargedWands]),
  ).toEqual([
    [30000, false],
    [75000, false],
    [120000, true],
    [300000, false],
    [500000, true],
    [800000, false],
    [1000000, false],
  ]);
  expect(boons.filter((x) => x.kind === 'xp').map((x) => x.xpPerPc)).toEqual([
    1200, 3200, 6400, 25600,
  ]);
});
test('[rules.O06.capacity] a PC or an NPC holding a role manages up to their Charisma modifier; an NPC holding none manages one', () => {
  for (const kind of ['pc', 'npc'] as const)
    for (const officers of [
      [],
      [{ role: 'marshal' as const, characterId: 'a' }],
    ]) {
      const result = projectRulesFoundations(
        input({
          roster: {
            people: [{ characterId: 'a', kind, hitDice: 1 }],
            teams: [team('a'), team('b'), team('c')],
            officers,
          },
          characters: [character('a', { charisma: 16 })],
        }),
      );
      const maxTeams = kind === 'pc' || officers.length ? 3 : 1;
      expect(
        result.teams[0]?.manager,
        `${kind} ${officers.length}`,
      ).toMatchObject({
        maxTeams,
        bonus: 3,
        managedTeams: 3,
      });
      expect(result.warnings.includes('manager:a:capacity')).toBe(maxTeams < 3);
    }
});
test('[rules.O05.ordered] recalculating with the projected rank and roster changes the designated occurrence', () => {
  const source = input({
    rank: 1,
    roster: {
      people: [{ characterId: 'a', kind: 'pc', hitDice: 1 }],
      teams: [],
      officers: [{ role: 'strategist', characterId: 'a' }],
    },
    characters: [character('a')],
    slots: [
      { slotId: '1', choice: { choiceId: 'one', actionId: 'drill_militia' } },
      { slotId: '2', choice: { choiceId: 'two', actionId: 'drill_militia' } },
    ],
    checks: [
      {
        checkId: 'roll',
        phase: 'activity',
        check: 'loyalty',
        choiceId: 'two',
        die: 10,
      },
    ],
  });
  expect(projectRulesFoundations(source).checks[0]?.total).toBe(14);
  source.rank = 2;
  expect(projectRulesFoundations(source).checks[0]?.total).toBe(13);
  source.rank = 1;
  source.roster.officers = [];
  const removed = projectRulesFoundations(source);
  expect(removed.checks[0]?.total).toBe(12);
  expect(removed.slots[1]?.overAllowance).toBe(true);
});
test('queued effect windows, consumed bonuses and absent rolls retain explicit requirements', () => {
  const source = input({
    queuedEffects: [
      {
        effectId: 'one',
        sourceId: 'same-event',
        startsWeek: 4,
        endsWeek: 4,
        effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
      },
      {
        effectId: 'duplicate',
        sourceId: 'same-event',
        startsWeek: 4,
        endsWeek: 4,
        effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
      },
      {
        effectId: 'expired',
        sourceId: 'old-event',
        startsWeek: 2,
        endsWeek: 3,
        effect: { kind: 'check_modifier', check: 'loyalty', value: 5 },
      },
    ],
    checks: [{ checkId: 'roll', phase: 'upkeep', check: 'loyalty' }],
  });
  const result = projectRulesFoundations(source);
  expect(result.checks[0]).toMatchObject({ modifier: 0, total: null });
  expect(result.requirements).toContain('roll:roll');
  source.checks[0]!.die = 0.5;
  expect(projectRulesFoundations(source).requirements).toContain(
    'roll:invalid-roll',
  );
});

test('unresolved Activity choices leave totals incomplete without reserving one-use bonuses', () => {
  const result = projectRulesFoundations(
    input({
      settlements: [settlement('home', { reputation: 'Helpful' })],
      operatingSettlementId: 'home',
      checks: [
        {
          checkId: 'missing',
          choiceId: 'gone',
          phase: 'activity',
          check: 'loyalty',
          die: 10,
          helpful: true,
        },
      ],
    }),
  );
  expect(result.checks[0]?.total).toBeNull();
  expect(result.requirements).toContain('missing:choice');
  expect(result.checkUsage.helpful).toBe(false);
});
test('one-use support remains consumed across an intervening projected officer change', () => {
  const source = input({
    roster: {
      people: [
        { characterId: 'a', kind: 'pc', hitDice: 1 },
        { characterId: 'b', kind: 'pc', hitDice: 1 },
      ],
      teams: [],
      officers: [{ role: 'overseer', characterId: 'a' }],
    },
    characters: [
      character('a', { strength: 16 }),
      character('b', { strength: 20 }),
    ],
    checks: [
      {
        checkId: 'first',
        eventId: 'first-event',
        phase: 'event',
        check: 'security',
        overseerCharacterId: 'a',
        die: 10,
      },
    ],
  });
  const first = projectRulesFoundations(source);
  const second = projectRulesFoundations({
    ...source,
    checkUsage: first.checkUsage,
    roster: {
      ...source.roster,
      officers: [{ role: 'overseer', characterId: 'b' }],
    },
    checks: [
      {
        checkId: 'second',
        eventId: 'second-event',
        phase: 'event',
        check: 'security',
        overseerCharacterId: 'b',
        die: 10,
      },
    ],
  });
  expect(first.checks[0]?.total).toBe(14);
  expect(second.checks[0]?.total).toBe(11);
  expect(second.requirements).toContain('second:overseer-already-used');
});

test('whole-number dice outside the rules range remain calculable with advisory warnings', () => {
  for (const die of [0, 21]) {
    const result = projectRulesFoundations(
      input({
        checks: [{ checkId: 'roll', phase: 'upkeep', check: 'loyalty', die }],
      }),
    );
    expect(result.checks[0]?.total).toBe(die === 0 ? 2 : 23);
    expect(result.warnings).toContain('roll:roll-range');
    expect(result.requirements).not.toContain('roll:invalid-roll');
  }
});

test('reactive team checks apply their manager once, including alongside Overseer support', () => {
  const result = projectRulesFoundations(
    input({
      roster: {
        people: [{ characterId: 'a', kind: 'pc', hitDice: 1 }],
        teams: [team('saboteurs', { teamType: 'saboteurs' })],
        officers: [{ role: 'overseer', characterId: 'a' }],
      },
      characters: [character('a', { charisma: 16, dexterity: 14 })],
      checks: [
        {
          checkId: 'sabotage',
          eventId: 'sabotaged-event',
          phase: 'event',
          check: 'secrecy',
          teamId: 'saboteurs',
          overseerCharacterId: 'a',
          die: 10,
        },
      ],
    }),
  );
  expect(result.checks[0]?.total).toBe(16);
  expect(
    result.checks[0]?.modifiers.filter((x) => x.source === 'manager:a'),
  ).toHaveLength(1);
});

test('[rules.O04.support-identity] occurrence support carries across phase checks without allowing officer swaps or another event', () => {
  const source = input({
    roster: {
      people: [
        { characterId: 'a', kind: 'pc', hitDice: 3 },
        { characterId: 'b', kind: 'pc', hitDice: 3 },
      ],
      officers: [
        { role: 'overseer', characterId: 'a' },
        { role: 'overseer', characterId: 'b' },
      ],
      teams: [],
    },
    characters: [
      character('a', { strength: 18, charisma: 16 }),
      character('b', { strength: 20 }),
    ],
    checks: [
      {
        checkId: 'first',
        eventId: 'chosen',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'a',
      },
    ],
  });
  const first = projectRulesFoundations(source);
  const later = projectRulesFoundations({
    ...source,
    checkUsage: first.checkUsage,
    checks: [
      {
        checkId: 'mitigation',
        eventId: 'chosen',
        phase: 'persistent',
        check: 'loyalty',
        die: 10,
      },
      {
        checkId: 'swap',
        eventId: 'chosen',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'b',
      },
      {
        checkId: 'other',
        eventId: 'another',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'a',
      },
      {
        checkId: 'unknown',
        phase: 'event',
        check: 'security',
        die: 10,
        overseerCharacterId: 'a',
      },
    ],
  });
  expect(first.checks[0]!.total).toBe(15);
  expect(later.checks.map((check) => check.total)).toEqual([15, 11, 11, 11]);
  expect(later.requirements).toContain('swap:overseer-conflict');
  expect(later.requirements).toContain('other:overseer-already-used');
  expect(later.requirements).toContain('unknown:overseer-event');
  expect(later.checkUsage.overseerEventId).toBe('chosen');
  expect(later.checkUsage.overseerCharacterId).toBe('a');
});
