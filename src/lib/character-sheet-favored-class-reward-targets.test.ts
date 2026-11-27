// reward-target (PRD #251; ORCH research reward-power-choice.md, design D1):
// a targeted favored-class reward's selection names the per-day maximum it
// adds to, by that maximum's output key. `@favoredClassReward.<id>`,
// evaluated in a rule value whose key is K, counts the counting Class Levels
// that chose the reward with target K, and is 0 for any other key. The
// rewards are PCGen roleplaying_game/advanced_players_guide/
// apg_abilities_race.lst:150 (Dwarf or Halfling Cleric, "Select one domain
// power granted at 1st level … The cleric adds 1/2 to the number of uses per
// day of that domain power") and :168 (Half-Elf Druid). The fixtures have the
// imported shape: Foundry classes/cleric.SjFqQceVeVBzBwgn and
// druid.7eZQP0MzeO2svmVF, races/dwarf.nEltI9y37rKJTeWo, half-elf
// .cCepRrfH5SalFfT4 and human.e6IaBxKgMxy1yKlr; the powers' per-day maxima
// are fixtures on the keys of Fire Bolt (pf1/V57hEfKt1MroRI91) and Rebuke
// Death (pf1/8iWGEKKdoKTHsDy5) whose formula reads the count alone, which no
// committed record does.
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type FavoredClassBonus,
  type SheetEntry,
} from './character-sheet';
import {
  favoredClassRewardsFitting,
  reviewedFavoredClassRewards,
} from './character-sheet-favored-class-rewards';
import { getConditionDefinition } from './character-sheet-conditions';

const fireBolt = 'classFeat_fireBolt';
const rebukeDeath = 'classFeat_rebukeDeath';
const count = '@favoredClassReward.clericDomainPowerUse';

const power = (
  id: string,
  name: string,
  ruleValues: CharacterSheetCatalogEntry['ruleValues'],
): CharacterSheetCatalogEntry => ({
  _id: id,
  scope: 'global',
  ruleIdentity: `fixture/${id}`,
  name,
  modifiers: [],
  detail: { kind: 'classFeature' },
  ruleValues,
});
const perDay = (key: string, formula: string) =>
  [{ kind: 'dailyMaximum', key, unit: 'uses', amount: { formula } }] as const;

const powers = {
  'fire-bolt': power('fire-bolt', 'Fire Bolt', perDay(fireBolt, count)),
  'rebuke-death': power(
    'rebuke-death',
    'Rebuke Death',
    perDay(rebukeDeath, count),
  ),
  // Channel Energy's uses: a per-day maximum on a key no domain reward lists.
  channel: power(
    'channel',
    'Channel Energy',
    perDay('classFeat_channelEnergy', count),
  ),
};
type Power = keyof typeof powers;

const classEntry = ({
  id,
  ruleIdentity,
  name,
  features,
}: {
  id: string;
  ruleIdentity: string;
  name: string;
  features: readonly Power[];
}): CharacterSheetCatalogEntry => ({
  _id: id,
  ruleIdentity,
  name,
  modifiers: [],
  detail: {
    kind: 'class',
    classKind: 'base',
    tag: id,
    hitDie: 8,
    bab: 'threeQuarters',
    saves: { fort: 'good', ref: 'poor', will: 'good' },
    skillRanksPerLevel: 2,
    featuresByLevel: features.map((catalogEntryId) => ({
      classLevel: 1,
      catalogEntryId,
    })),
  },
});
const race = (id: string, ruleIdentity: string, name: string) =>
  ({
    _id: id,
    ruleIdentity,
    name,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
  }) satisfies CharacterSheetCatalogEntry;
const races = {
  dwarf: race('dwarf', 'pf1/nEltI9y37rKJTeWo', 'Dwarf'),
  human: race('human', 'pf1/e6IaBxKgMxy1yKlr', 'Human'),
};

type Level = FavoredClassBonus | null;

function sheet({
  levels,
  features = ['fire-bolt', 'rebuke-death'],
  raceKey = 'dwarf',
}: {
  levels: Level[];
  features?: readonly Power[];
  raceKey?: keyof typeof races;
}) {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base', favoredClassIds: ['cleric'] },
    },
    {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: raceKey,
      state: { kind: 'race' },
    },
    ...levels.map(
      (favoredClassBonus, index): SheetEntry => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: index + 1,
          classEntryId: 'cleric',
          hpGained: 5,
          favoredClassBonus,
        },
      }),
    ),
  ];
  return {
    characterKind: 'pc' as const,
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      classEntry({
        id: 'cleric',
        ruleIdentity: 'pf1/SjFqQceVeVBzBwgn',
        name: 'Cleric',
        features: [...features, 'channel'],
      }),
      ...Object.values(powers),
      ...Object.values(races),
    ],
  };
}

const domainUse = (target?: string): FavoredClassBonus => ({
  choice: 'reward',
  reward: 'clericDomainPowerUse',
  ...(target === undefined ? {} : { target }),
});

function maxima(input: ReturnType<typeof sheet>) {
  return Object.fromEntries(
    calculateCharacterSheet(input).dailyMaxima.map((row) => [
      row.key,
      row.value,
    ]),
  );
}
function notCounted(input: ReturnType<typeof sheet>) {
  return calculateCharacterSheet(input).warnings.filter(
    (warning) => warning.check === 'favoredClassRewardNotCounted',
  );
}

test('the reviewed list holds the two domain rewards as targeted rewards, with the powers each may add to', () => {
  const targeted = reviewedFavoredClassRewards.rewards.flatMap((reward) =>
    'targets' in reward
      ? [
          [
            reward.id,
            reward.class,
            reward.races,
            reward.targets.map((target) => [target.key, target.name]),
          ],
        ]
      : [],
  );
  expect(targeted).toEqual([
    [
      'clericDomainPowerUse',
      'cleric',
      ['dwarf', 'halfling'],
      [
        [fireBolt, 'Fire Bolt'],
        [rebukeDeath, 'Rebuke Death'],
        ['classFeat_touchOfGlory', 'Touch of Glory'],
        ['classFeat_restorativeTouch', 'Restorative Touch'],
      ],
    ],
    ['druidDomainPowerUse', 'druid', ['half-elf'], [[fireBolt, 'Fire Bolt']]],
  ]);
});

test('a Dwarf Cleric with two levels that chose Fire Bolt counts 2 in Fire Bolt’s rule value and 0 in Rebuke Death’s and in Channel Energy’s', () => {
  const input = sheet({ levels: [domainUse(fireBolt), domainUse(fireBolt)] });
  expect(maxima(input)).toEqual({
    [fireBolt]: 2,
    [rebukeDeath]: 0,
    classFeat_channelEnergy: 0,
  });
  expect(notCounted(input)).toEqual([]);
});

test('each selection names its own power: one level for Fire Bolt and one for Rebuke Death count 1 and 1', () => {
  const input = sheet({
    levels: [domainUse(fireBolt), domainUse(rebukeDeath), { choice: 'hp' }],
  });
  expect(maxima(input)).toMatchObject({ [fireBolt]: 1, [rebukeDeath]: 1 });
  expect(notCounted(input)).toEqual([]);
});

test('a level whose power the sheet no longer has adds nothing and warns, naming the power; the warning’s fingerprint holds the power', () => {
  const input = sheet({
    features: ['fire-bolt'],
    levels: [domainUse(fireBolt), domainUse(rebukeDeath)],
  });
  expect(maxima(input)).toEqual({
    [fireBolt]: 1,
    classFeat_channelEnergy: 0,
  });
  const [warning] = notCounted(input);
  expect(notCounted(input)).toHaveLength(1);
  expect(warning).toMatchObject({
    kind: 'rules',
    subject: 'level-2',
    target: {
      kind: 'classLevel',
      entryId: 'level-2',
      field: 'favoredClassBonus',
    },
    message:
      'Level 2: +1/2 use per day of a 1st-level domain power isn’t counted: there’s no Rebuke Death on your sheet.',
  });
  const other = notCounted(
    sheet({
      features: [],
      levels: [domainUse(fireBolt), domainUse(fireBolt)],
    }),
  )[1];
  expect(other?.message).toBe(
    'Level 2: +1/2 use per day of a 1st-level domain power isn’t counted: there’s no Fire Bolt on your sheet.',
  );
  expect(other?.fingerprint).not.toBe(warning?.fingerprint);
});

test('a targeted reward saved without a power, or with one the list does not give it, adds nothing and warns', () => {
  const input = sheet({
    levels: [domainUse(), domainUse('classFeat_channelEnergy')],
  });
  expect(maxima(input)).toMatchObject({
    [fireBolt]: 0,
    [rebukeDeath]: 0,
    classFeat_channelEnergy: 0,
  });
  expect(notCounted(input).map((warning) => warning.message)).toEqual([
    'Level 1: +1/2 use per day of a 1st-level domain power isn’t counted: no power is chosen for it.',
    'Level 2: +1/2 use per day of a 1st-level domain power isn’t counted: it can’t add to the power chosen for it.',
  ]);
});

test('a Human Cleric who chose Fire Bolt counts none and warns why, as an untargeted reward does', () => {
  const input = sheet({ raceKey: 'human', levels: [domainUse(fireBolt)] });
  expect(maxima(input)).toMatchObject({ [fireBolt]: 0 });
  expect(notCounted(input).map((warning) => warning.message)).toEqual([
    'Level 1: +1/2 use per day of a 1st-level domain power isn’t counted: your race isn’t Dwarf or Halfling.',
  ]);
});

test('the rewards that fit a Cleric level are the Cleric’s domain reward for a Dwarf or a Halfling and none for a Human; a Half-Elf Druid’s is the Druid’s', () => {
  const ids = (classIdentity: string, raceIdentity: string) =>
    favoredClassRewardsFitting({
      classIdentities: [classIdentity],
      raceIdentities: [raceIdentity],
    }).map((row) => row.id);
  expect(ids('pf1/SjFqQceVeVBzBwgn', 'pf1/nEltI9y37rKJTeWo')).toEqual([
    'clericDomainPowerUse',
  ]);
  expect(ids('pf1/SjFqQceVeVBzBwgn', 'pf1/Hf31mrYb3uucNyLO')).toEqual([
    'clericDomainPowerUse',
  ]);
  expect(ids('pf1/SjFqQceVeVBzBwgn', 'pf1/e6IaBxKgMxy1yKlr')).toEqual([]);
  expect(ids('pf1/7eZQP0MzeO2svmVF', 'pf1/cCepRrfH5SalFfT4')).toEqual([
    'druidDomainPowerUse',
  ]);
});

// Fix r1: the count per target is an own-key lookup, so a rule value whose
// key names an Object property reads 0 like any other key.
test.each(['constructor', '__proto__', 'toString'])(
  'a rule value of the key %s reads 0 for a targeted reward, whatever the levels chose',
  (key) => {
    const input = sheet({ levels: [domainUse(fireBolt), domainUse(fireBolt)] });
    input.catalogEntries.push(power('odd-key', 'Odd key', perDay(key, count)));
    input.entries.push({
      _id: 'odd-key-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'odd-key',
      state: { kind: 'manual' },
    });
    const rows = calculateCharacterSheet(input).dailyMaxima;
    expect(rows.find((row) => row.key === key)?.value).toBe(0);
    expect(rows.find((row) => row.key === fireBolt)?.value).toBe(2);
  },
);

/**
 * Fix r1, r4: a selection counts only on one of the fitting reward's listed
 * targets among the calculation's `favoredClassRewardTargets`, the keys of
 * the per-day maxima the sheet's daily-maxima resolution yields, whatever
 * their reward (here Channel Energy's too, which no domain reward lists).
 * Under a Combined Form worn armor does not function
 * (`combinedFormEntries`), so a fixture armor giving Fire Bolt's per-day
 * maximum gives the sheet no Fire Bolt while fused, and a level that named it
 * counts nothing and warns.
 */
test('the powers the sheet has are the calculation’s: under a Combined Form a worn armor’s per-day maximum is not one', () => {
  const input = sheet({ features: [], levels: [domainUse(fireBolt)] });
  input.catalogEntries.push({
    _id: 'fire-armor',
    ruleIdentity: 'fixture/fire-armor',
    name: 'Fire armor',
    scope: 'global',
    modifiers: [],
    detail: {
      kind: 'item',
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 4,
        armorCheckPenalty: 2,
        asf: 20,
      },
    },
    ruleValues: perDay(fireBolt, count),
  });
  input.entries.push({
    _id: 'worn-fire-armor',
    kind: 'item',
    active: true,
    catalogEntryId: 'fire-armor',
    state: { kind: 'item' },
  });
  const ordinary = calculateCharacterSheet(input);
  expect(ordinary.favoredClassRewardTargets).toEqual([
    'classFeat_channelEnergy',
    fireBolt,
  ]);
  expect(notCounted(input)).toEqual([]);
  const fused = calculateCharacterSheet(input, {
    combinedForm: {
      replacedClassRuleIdentity: 'pf1/SjFqQceVeVBzBwgn',
      baseAttackBonus: 0,
      physicalScores: {
        strength: { score: 10, damagePenalty: 0 },
        dexterity: { score: 10, damagePenalty: 0 },
        constitution: { score: 10, damagePenalty: 0 },
      },
      armorBonus: 0,
      naturalArmor: 0,
      size: 'medium',
      skillBonuses: [],
      shieldedMeld: null,
    },
  });
  expect(fused.favoredClassRewardTargets).toEqual(['classFeat_channelEnergy']);
  expect(
    fused.warnings
      .filter(({ check }) => check === 'favoredClassRewardNotCounted')
      .map(({ message }) => message),
  ).toEqual([
    'Level 1: +1/2 use per day of a 1st-level domain power isn’t counted: there’s no Fire Bolt on your sheet.',
  ]);
});

// Fix r2, after racial-heritage-counts-as: Racial Heritage's saved race joins
// the races a reward is matched against, so a Human Cleric with Racial
// Heritage (Dwarf) counts the Cleric domain reward for its power. The feat is
// a fixture of the imported shape (`countsAsRaces: { oneOf }`, a saved
// choice).
test('a Human Cleric with Racial Heritage (Dwarf) counts a level that chose Fire Bolt', () => {
  const input = sheet({ raceKey: 'human', levels: [domainUse(fireBolt)] });
  expect(maxima(input)).toMatchObject({ [fireBolt]: 0 });
  input.catalogEntries.push({
    _id: 'racial-heritage',
    ruleIdentity: 'fixture/racial-heritage',
    name: 'Racial Heritage',
    modifiers: [],
    detail: { kind: 'feat' },
    countsAsRaces: { oneOf: ['pf1/nEltI9y37rKJTeWo'] },
  });
  input.entries.push({
    _id: 'heritage-row',
    kind: 'feat',
    active: true,
    catalogEntryId: 'racial-heritage',
    state: { kind: 'feat', choice: 'pf1/nEltI9y37rKJTeWo' },
  });
  expect(maxima(input)).toMatchObject({ [fireBolt]: 1, [rebukeDeath]: 0 });
  expect(notCounted(input)).toEqual([]);
});

/**
 * Fix r3: the powers the sheet has are the maxima its daily-maxima
 * resolution yields, after every suppression it applies. A homebrew Grappled
 * Condition that gives Fire Bolt's per-day maximum (the fixture of
 * character-sheet-joined-maximum.test.ts) is the sheet's only Fire Bolt;
 * Pinned replaces Grappled, which drops the maximum.
 */
function grappledFireBolt(pinned: boolean) {
  const input = sheet({ features: [], levels: [domainUse(fireBolt)] });
  for (const conditionKey of ['grappled', 'pinned'] as const)
    input.catalogEntries.push({
      _id: conditionKey,
      ruleIdentity: getConditionDefinition(conditionKey).ruleIdentity,
      name: conditionKey === 'grappled' ? 'Grappled' : 'Pinned',
      scope: 'global',
      modifiers: [],
      detail: { kind: 'condition', conditionKey },
      ...(conditionKey === 'grappled'
        ? { ruleValues: perDay(fireBolt, `3 + ${count}`) }
        : {}),
    });
  for (const conditionKey of pinned ? ['grappled', 'pinned'] : ['grappled'])
    input.entries.push({
      _id: `${conditionKey}-row`,
      kind: 'condition',
      active: true,
      catalogEntryId: conditionKey,
      state: { kind: 'condition' },
    } as SheetEntry);
  // Fix r4: a keyed dice value on Fire Bolt's key that no condition
  // suppresses, reading the count itself, so the count is seen directly
  // whether or not the maximum is on the sheet.
  input.catalogEntries.push(
    power('fire-bolt-dice', 'Fire Bolt dice', [
      { kind: 'dice', die: 6, key: fireBolt, amount: { formula: count } },
    ]),
  );
  input.entries.push({
    _id: 'fire-bolt-dice-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'fire-bolt-dice',
    state: { kind: 'manual' },
  });
  return input;
}
/** What the unsuppressed dice value on Fire Bolt's key reads: the count. */
const fireBoltCount = (result: ReturnType<typeof calculateCharacterSheet>) =>
  result.featureNumbers.find(({ entryId }) => entryId === 'fire-bolt-dice-row')
    ?.count;

test('a power whose only maximum a replaced Condition gives is not on the sheet: Pinned drops Grappled’s Fire Bolt, and the level that chose it adds nothing and warns; without Pinned both return', () => {
  const grappled = calculateCharacterSheet(grappledFireBolt(false));
  expect(grappled.favoredClassRewardTargets).toContain(fireBolt);
  expect(fireBoltCount(grappled)).toBe(1);
  expect(grappled.dailyMaxima.find((row) => row.key === fireBolt)?.value).toBe(
    4,
  );
  expect(
    grappled.warnings.filter(
      ({ check }) => check === 'favoredClassRewardNotCounted',
    ),
  ).toEqual([]);
  const pinned = calculateCharacterSheet(grappledFireBolt(true));
  expect(pinned.dailyMaxima.map((row) => row.key)).not.toContain(fireBolt);
  expect(pinned.favoredClassRewardTargets).not.toContain(fireBolt);
  expect(fireBoltCount(pinned)).toBe(0);
  expect(
    pinned.warnings
      .filter(({ check }) => check === 'favoredClassRewardNotCounted')
      .map(({ message }) => message),
  ).toEqual([
    'Level 1: +1/2 use per day of a 1st-level domain power isn’t counted: there’s no Fire Bolt on your sheet.',
  ]);
});

// Fix r3: a key's presence never depends on the count: a maximum whose own
// formula reads the reward is on the sheet whether the count is 0 or not.
test('a maximum whose formula reads the reward is a power on the sheet, with no level or two counting for it', () => {
  for (const levels of [
    [{ choice: 'hp' } as const],
    [domainUse(fireBolt), domainUse(fireBolt)],
  ]) {
    const result = calculateCharacterSheet(sheet({ levels }));
    expect(result.favoredClassRewardTargets).toEqual([
      'classFeat_channelEnergy',
      fireBolt,
      rebukeDeath,
    ]);
  }
});
