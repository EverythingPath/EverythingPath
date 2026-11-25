// @vitest-environment node
// rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
// the reviewed list of favored-class rewards the sheet counts
// (`src/lib/catalog/data/reviewed-favored-class-rewards.json`) holds only
// rewards that change a per-day number and are in the release scope today:
// each is the campaign-mvp-v1 inventory's racial favored class row of its
// PCGen line, with that row's class, races and fraction, and the pinned
// PCGen line says so. rotation-7 left no reviewed curation record whose
// formula reads the count; reward-terms-1 gives Bardic Performance's per-day
// record the one term, checked on its promotion review (phase 2).
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { ZodError } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  parseFavoredClassRewardList,
  reviewedFavoredClassRewards,
} from '../../src/lib/character-sheet-favored-class-rewards';
import { parseCuration } from '../../scripts/catalog/curation';
import { launchManifestCopies } from './launch-manifest';

const read = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const manifest = launchManifestCopies(
  JSON.parse(await read('scripts/catalog/scopes/campaign-mvp-v1.json')),
)();
const pcgenRoot = 'tests/fixtures/pinned/pcgen/data/pathfinder/paizo/';

// PCGen's PREFACT template facts for the listed races (IsGnome …).
const pcgenRaceFacts: Record<string, string> = {
  dwarf: 'IsDwarf',
  gnome: 'IsGnome',
  'half-elf': 'IsHalfElf',
  'half-orc': 'IsHalfOrc',
  halfling: 'IsHalfling',
  human: 'IsHuman',
};

test('the list is seven of the release scope’s per-day rewards from the Advanced Player’s Guide, each by id (reward-target: with the two domain rewards)', () => {
  expect(
    reviewedFavoredClassRewards.rewards.map((reward) => [
      reward.id,
      reward.class,
      reward.races,
      `${reward.fraction.numerator}/${reward.fraction.denominator}`,
      reward.source.pcgen.replace(/^.*:/, 'line '),
    ]),
  ).toEqual([
    [
      'bardicPerformanceRound',
      'bard',
      ['gnome', 'half-elf'],
      '1/1',
      'line 142',
    ],
    ['bomb', 'alchemist', ['gnome'], '1/2', 'line 148'],
    [
      'clericDomainPowerUse',
      'cleric',
      ['dwarf', 'halfling'],
      '1/2',
      'line 150',
    ],
    ['stunningFist', 'monk', ['halfling'], '1/2', 'line 162'],
    ['druidDomainPowerUse', 'druid', ['half-elf'], '1/2', 'line 168'],
    ['kiPoint', 'monk', ['human'], '1/4', 'line 199'],
    ['rageRound', 'barbarian', ['dwarf', 'half-orc'], '1/1', 'line 213'],
  ]);
});

test.each(reviewedFavoredClassRewards.rewards)(
  '$id is its inventory row’s class, races and fraction, and its PCGen line names a per-day number',
  async (reward) => {
    const contract = manifest.semanticContracts.find(
      (row) => row.id === `rule/core/favored-class/${reward.source.pcgen}`,
    );
    if (!contract) throw new Error(`No inventory row for ${reward.id}`);
    expect(contract.channel).toBe('racial favored class');
    const className = reviewedFavoredClassRewards.classes[reward.class]?.name;
    const raceFacts = reward.races.map(
      (race) => `${pcgenRaceFacts[race]}=true`,
    );
    expect(contract.nativeRequirements).toEqual([
      `PREABILITY:1,CATEGORY=Special Ability,${className}`,
      `PRECLASS:1,${className}=1`,
      `PREFACT:1,TEMPLATES,${raceFacts.join(',')}`,
    ]);
    // The row's root is its first race's Foundry record.
    expect(
      reviewedFavoredClassRewards.races[reward.races[0] ?? '']?.foundry,
    ).toContain(contract.root);
    const fractions = contract.parameters.find(
      (parameter) => parameter.name === 'source fractions',
    )?.values;
    expect(fractions ?? ['1/1']).toEqual([
      `${reward.fraction.numerator}/${reward.fraction.denominator}`,
    ]);
    const [file, line] = reward.source.pcgen.split(':');
    const row = (await read(`${pcgenRoot}${file}`)).split('\n')[
      Number(line) - 1
    ];
    expect(row).toMatch(/^Bonus /);
    expect(row).toMatch(/(per day|ki pool)/);
  },
);

test('each listed race is a Foundry record the inventory roots a racial favored class row in, and each listed class a racial favored class row names', () => {
  const roots = new Set(
    manifest.semanticContracts
      .filter((row) => row.channel === 'racial favored class')
      .map((row) => row.root),
  );
  for (const race of Object.values(reviewedFavoredClassRewards.races))
    for (const identity of race.foundry) expect(roots).toContain(identity);
  for (const [key, group] of Object.entries(
    reviewedFavoredClassRewards.classes,
  )) {
    const [identity] = group.foundry;
    expect(
      manifest.semanticContracts.some(
        (row) =>
          row.channel === 'racial favored class' &&
          row.nativeRequirements.includes(`PRECLASS:1,${group.name}=1`),
      ),
      key,
    ).toBe(true);
    expect(identity).toMatch(/^pf1\//);
  }
});

test('the list refuses a repeated or malformed id, an unlisted class or race, and a fraction other than one over 1 to 6', () => {
  const base = structuredClone(reviewedFavoredClassRewards);
  const [first] = base.rewards;
  if (!first) throw new Error('Empty list');
  for (const rewards of [
    [first, first],
    [{ ...first, class: 'wizard' }],
    [{ ...first, races: ['elf'] }],
    [{ ...first, fraction: { numerator: 2, denominator: 3 } }],
    [{ ...first, fraction: { numerator: 1, denominator: 0 } }],
    [{ ...first, id: 'bardic-round' }],
  ])
    expect(() => parseFavoredClassRewardList({ ...base, rewards })).toThrow(
      ZodError,
    );
});

test('one reviewed curation record’s formula reads a favored-class reward count: Bardic Performance’s per-day maximum, checked (reward-terms-1); no reviewed condition’s does', async () => {
  const reading = (reviewedCuration.ruleValues ?? []).flatMap(
    ({ externalKey, status, outputs }) =>
      outputs.flatMap(({ ruleValue }) =>
        typeof ruleValue.amount === 'object' &&
        'formula' in ruleValue.amount &&
        ruleValue.amount.formula.includes('@favoredClassReward')
          ? [[externalKey, status, ruleValue.kind, ruleValue.amount.formula]]
          : [],
      ),
  );
  expect(reading).toEqual([
    [
      'pf1/ZfCUTi1MiLgR4T7I',
      'checked',
      'dailyMaximum',
      '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) + @favoredClassReward.bardicPerformanceRound',
    ],
  ]);
  // No other formula of the file names it (a note record's Modifier among
  // them); the two records' rationales name it.
  expect(
    (await read('scripts/catalog/reviewed-curation.json'))
      .split('\n')
      .filter(
        (line) =>
          line.includes('"formula":') && line.includes('@favoredClassReward'),
      ),
  ).toHaveLength(1);
  expect(
    await read('src/lib/catalog/data/reviewed-conditions.json'),
  ).not.toContain('@favoredClassReward');
});

// reward-target: a targeted reward lists the per-day maxima it may add to,
// each once, by a rule value's key and the power's name.
test('the list refuses a targeted reward with no targets, a target listed twice and a malformed target key', () => {
  const base = structuredClone(reviewedFavoredClassRewards);
  const cleric = base.rewards.find(
    (reward) => reward.id === 'clericDomainPowerUse',
  );
  if (!cleric || !('targets' in cleric)) throw new Error('No domain reward');
  const [fireBolt] = cleric.targets;
  for (const targets of [
    [],
    [fireBolt, fireBolt],
    [{ ...fireBolt, key: 'class feat' }],
    [{ ...fireBolt, name: '' }],
  ])
    expect(() =>
      parseFavoredClassRewardList({
        ...base,
        rewards: [{ ...cleric, targets }],
      }),
    ).toThrow(ZodError);
});

/**
 * reward-target: where reviewed rule values' formulas are validated, the
 * curation records' schema (`ruleValueRecordSchema` in
 * scripts/catalog/curation.ts), a formula that reads a targeted reward in a
 * rule value whose key is not one of the reward's targets is refused: it
 * would always read 0. Fire Bolt's identity is Foundry
 * class-abilities/fire-bolt (pf1/V57hEfKt1MroRI91); the descriptions' hash
 * is a placeholder no committed record has.
 */
function perDayRecord(
  ruleValue:
    | {
        kind: 'dailyMaximum';
        key: string;
        unit: 'uses';
        amount: { formula: string };
      }
    | { kind: 'dice'; die: 6; amount: { formula: string } },
) {
  return {
    records: [],
    ruleValues: [
      {
        externalKey: 'pf1/V57hEfKt1MroRI91',
        descriptionSha256: '0'.repeat(64),
        status: 'drafted',
        rationale: 'Fixture (favored-class-rewards.test.ts).',
        outputs: [{ kind: 'ruleValue', ruleValue }],
      },
    ],
  };
}
const uses = (key: string, formula: string) =>
  perDayRecord({
    kind: 'dailyMaximum',
    key,
    unit: 'uses',
    amount: { formula },
  });

test('a rule-value record reading a targeted reward is accepted on a key the reward lists and refused on any other', () => {
  for (const [key, term] of [
    ['classFeat_fireBolt', 'clericDomainPowerUse'],
    ['classFeat_fireBolt', 'druidDomainPowerUse'],
    ['classFeat_restorativeTouch', 'clericDomainPowerUse'],
    // An untargeted reward reads its count under any key, as before.
    ['classFeat_bomb', 'bomb'],
  ] as const)
    expect(
      parseCuration(
        uses(
          key,
          `3 + @ability.wis.mod + floor(@favoredClassReward.${term} / 2)`,
        ),
      ).ruleValues,
    ).toHaveLength(1);
  expect(() =>
    parseCuration(
      uses(
        'classFeat_rebukeDeath',
        '3 + @ability.wis.mod + floor(@favoredClassReward.druidDomainPowerUse / 2)',
      ),
    ),
  ).toThrow(
    '@favoredClassReward.druidDomainPowerUse reads 0 in a rule value of classFeat_rebukeDeath: the reward adds only to classFeat_fireBolt.',
  );
  expect(() =>
    parseCuration(
      uses(
        'classFeat_channelEnergy',
        '@favoredClassReward.clericDomainPowerUse',
      ),
    ),
  ).toThrow(
    '@favoredClassReward.clericDomainPowerUse reads 0 in a rule value of classFeat_channelEnergy: the reward adds only to classFeat_fireBolt, classFeat_rebukeDeath, classFeat_touchOfGlory or classFeat_restorativeTouch.',
  );
  expect(() =>
    parseCuration(
      perDayRecord({
        kind: 'dice',
        die: 6,
        amount: { formula: '1 + @favoredClassReward.clericDomainPowerUse' },
      }),
    ),
  ).toThrow(
    '@favoredClassReward.clericDomainPowerUse reads 0 in a rule value without a key: the reward adds only to classFeat_fireBolt, classFeat_rebukeDeath, classFeat_touchOfGlory or classFeat_restorativeTouch.',
  );
});

// Fix r1: the check reads a formula's variables through the sheet's own
// parser (`formulaVariables`), so a formula it cannot parse is refused as not
// parsing rather than scanned by a second pattern.
test('a rule-value record whose formula the sheet cannot parse is refused as not parsing', () => {
  expect(() =>
    parseCuration(
      uses(
        'classFeat_fireBolt',
        '3 + floor(@favoredClassReward.clericDomainPowerUse / 2',
      ),
    ),
  ).toThrow(
    'The formula 3 + floor(@favoredClassReward.clericDomainPowerUse / 2 does not parse: Expected ).',
  );
});
