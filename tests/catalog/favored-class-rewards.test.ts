// @vitest-environment node
// rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
// the reviewed list of favored-class rewards the sheet counts
// (`src/lib/catalog/data/reviewed-favored-class-rewards.json`) holds only
// rewards that change a per-day number and are in the release scope today:
// each is the campaign-mvp-v1 inventory's racial favored class row of its
// PCGen line, with that row's class, races and fraction, and the pinned
// PCGen line says so. No reviewed curation record's formula reads the count
// in this slice.
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { ZodError } from 'zod';
import {
  parseFavoredClassRewardList,
  reviewedFavoredClassRewards,
} from '../../src/lib/character-sheet-favored-class-rewards';
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

test('the list is five of the release scope’s per-day rewards from the Advanced Player’s Guide, each by id', () => {
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
    ['stunningFist', 'monk', ['halfling'], '1/2', 'line 162'],
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
    [{ ...first, class: 'cleric' }],
    [{ ...first, races: ['elf'] }],
    [{ ...first, fraction: { numerator: 2, denominator: 3 } }],
    [{ ...first, fraction: { numerator: 1, denominator: 0 } }],
    [{ ...first, id: 'bardic-round' }],
  ])
    expect(() => parseFavoredClassRewardList({ ...base, rewards })).toThrow(
      ZodError,
    );
});

test('no reviewed curation record’s formula reads a favored-class reward count in this slice', async () => {
  for (const path of [
    'scripts/catalog/reviewed-curation.json',
    'src/lib/catalog/data/reviewed-conditions.json',
  ])
    expect(await read(path)).not.toContain('@favoredClassReward');
});
