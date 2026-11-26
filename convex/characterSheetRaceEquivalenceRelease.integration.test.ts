// @vitest-environment edge-runtime
// racial-heritage-counts-as (PRD #251): Racial Heritage's race equivalence,
// `countsAsRaces: { oneOf }` as the importer emits it for
// pf1-content/1LULpgVNjQWqUGUk (`tests/catalog/racial-heritage-counts-as.test.ts`
// proves the import), through an activated Catalog Release and the public
// reads and writes. The race control's options come from the read as the
// client builds them (`buildCharacterSheetView` over the read's catalog
// choices, `listRaceEquivalenceOptions`): the races the race picker lets the
// Character choose that the feat names, so Gnome, a shared race of the
// release that nothing else on the sheet references, is offered, and Kobold,
// an option the release does not hold, and the Tiefling, a race the feat
// does not name, are not. The options equal the race picker's list within
// the feat's options; a shared Kobold the release omits that an inactive race
// row still references stays listed by the picker, with why it cannot be
// chosen, and is not offered (race-list-release-boundary). A Human Bard 1 whose level takes the Gnome Bard
// reward and who saves Gnome counts as a gnome: the reward counts (0 to 1)
// and Gnome Trickster's gnome clause is met; without the choice, or with
// Elf, neither; a race outside the feat's options is refused. The bodies are
// shaped as the imported rows of the identities they carry; Bardic
// Performance's rule value is a fixture formula that reads the count alone.
import { expect, test } from 'vitest';
import { listRaceEquivalenceOptions } from '../src/components/character-sheet/character-sheet-races-view-model';
import { unofferedChoiceReason } from '../src/components/character-sheet/retired-catalog-choices';
import { buildCharacterSheetView } from '../src/components/character-sheet/character-sheet-view-model';
import type { CharacterSheetSnapshot } from '../src/components/character-sheet/use-character-sheet';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

const keys = {
  human: 'pf1/e6IaBxKgMxy1yKlr',
  gnome: 'pf1/efwHEwjvL9Z94MJI',
  elf: 'pf1/NgIhxRI0axrf3fcO',
  // An option of Racial Heritage the release does not hold.
  kobold: 'pf1/LMNzbqGSRAFQFE2Y',
  tiefling: 'pf1/nVjKDLZSRONzYm8f',
  bard: 'pf1/6GjOjO6r3R06fLwE',
  performance: 'pf1/ZfCUTi1MiLgR4T7I',
  heritage: 'pf1-content/1LULpgVNjQWqUGUk',
  gnomeTrickster: 'pf1-content/vOMOZeC9pwPuITj2',
} as const;

/** A body shaped as the imported row of `externalKey`. */
const body = ({
  externalKey,
  name,
  pack,
  detail,
  ...rest
}: {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  prerequisiteText?: string;
  prerequisites?: unknown[];
  countsAsRaces?: { oneOf: string[] };
  ruleValues?: unknown[];
}) => ({
  externalKey,
  upstreamKey: externalKey,
  pack,
  name,
  description: `${name}.`,
  sources: [{ book: 'PZO1115', pages: '1' }],
  modifiers: [],
  unsupported: [],
  detail,
  ...rest,
});
const raceBody = (externalKey: string, name: string, creatureType: string) =>
  body({
    externalKey,
    name,
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: [creatureType],
      creatureSubtypes: [],
      racialTraits: [],
      size: 'medium',
    },
  });
const featBody = (facts: Omit<Parameters<typeof body>[0], 'pack' | 'detail'>) =>
  body({
    ...facts,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
  });
const bodies = [
  raceBody(keys.human, 'Human', 'humanoid'),
  raceBody(keys.gnome, 'Gnome', 'humanoid'),
  raceBody(keys.elf, 'Elf', 'humanoid'),
  raceBody(keys.tiefling, 'Tiefling', 'outsider'),
  body({
    externalKey: keys.performance,
    name: 'Bardic Performance',
    pack: 'class-abilities',
    detail: { kind: 'classFeature' },
    ruleValues: [
      {
        kind: 'dailyMaximum',
        key: 'classFeat_bardicPerformance',
        unit: 'rounds',
        amount: { formula: '@favoredClassReward.bardicPerformanceRound' },
      },
    ],
  }),
  body({
    externalKey: keys.bard,
    name: 'Bard',
    pack: 'classes',
    detail: {
      kind: 'class',
      tag: 'bard',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'poor', ref: 'good', will: 'good' },
      classSkills: [],
      skillRanksPerLevel: 6,
      featuresByLevel: [{ classLevel: 1, externalKey: keys.performance }],
      picksByLevel: [],
    },
  }),
  featBody({
    externalKey: keys.heritage,
    name: 'Racial Heritage',
    prerequisiteText: 'Human',
    prerequisites: [{ race: [keys.human], kind: 'race' }],
    countsAsRaces: { oneOf: [keys.elf, keys.gnome, keys.kobold].sort() },
  }),
  featBody({
    externalKey: keys.gnomeTrickster,
    name: 'Gnome Trickster',
    prerequisiteText: 'Cha 13, gnome',
    prerequisites: [{ race: [keys.gnome], kind: 'race' }],
  }),
];
type Released = (typeof bodies)[number];

/** The stored identity a body starts from, before the release. */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name, detail }: Released,
) {
  const identity = {
    scope: 'global' as const,
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
  };
  switch (detail.kind) {
    case 'race':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'race', racialHitDice: 0, racialTraits: [] },
      });
    case 'feat':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'feat' },
      });
    case 'classFeature':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'classFeature' },
      });
    default:
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'good', will: 'good' },
          skillRanksPerLevel: 6,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
        },
      });
  }
}

/**
 * The bodies as an activated Catalog Release, and a Human Bard 1 with
 * Charisma 18, Bard favored, the Gnome Bard reward on the level, and Racial
 * Heritage and Gnome Trickster chosen.
 */
async function fixture({
  formerRace = false,
}: {
  /**
   * The Character chose a shared Kobold before the release, which omits it,
   * so its race row stays, inactive, once the Character is a Human.
   */
  formerRace?: boolean;
} = {}) {
  const { t, owner, scope } = await releaseFixture(modules);
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const entry of bodies)
      ids[entry.externalKey] = await insertIdentity(ctx, entry);
    if (formerRace)
      ids[keys.kobold] = await insertIdentity(
        ctx,
        raceBody(keys.kobold, 'Kobold', 'humanoid'),
      );
    return ids;
  });
  const kobold = ids[keys.kobold];
  if (kobold)
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: kobold,
      operationId: 'former-race',
    });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(await reconcile(t, scope.characterId)),
  );
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const level = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!level) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: id(keys.bard),
    hpGained: 8,
    operationId: 'bard',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 18,
    },
    operationId: 'scores',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(keys.human),
    operationId: 'race',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [id(keys.bard)],
    operationId: 'favored',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
    operationId: 'reward',
  });
  const select = (key: string) =>
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const trickster = await select(keys.gnomeTrickster);
  const heritage = await select(keys.heritage);
  const choose = (choice: string | null) =>
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: heritage,
      choice,
      operationId: `choose-${choice}`,
    });
  /** The race control's options, from the read as the client builds them. */
  const offered = async () => {
    const sheet = await read();
    const view = buildCharacterSheetView(sheet, sheet.catalogView?.definitions);
    const row = view.races.choiceRows.find(({ rowId }) => rowId === heritage);
    if (!row) throw new Error('Missing Racial Heritage choice row');
    return listRaceEquivalenceOptions(
      row.raceChoices,
      view.raceNames,
      row.choice ?? '',
    );
  };
  /** What the sheet reads now: race identities, the reward, the clause. */
  const counted = async () => {
    const { calculated } = await read();
    return {
      races: calculated.racial.countsAsRaces,
      rewards: calculated.dailyMaxima
        .filter(({ key }) => key === 'classFeat_bardicPerformance')
        .map(({ value }) => value),
      notCounted: calculated.warnings
        .filter(({ check }) => check === 'favoredClassRewardNotCounted')
        .map(({ subject }) => subject),
      gnomeClause: calculated.prerequisites
        .filter((row) => row.entryId === trickster && row.view === 'current')
        .map(({ met }) => met),
    };
  };
  return { read, id, choose, offered, counted, level: level._id };
}

/**
 * The race picker's list, as the client builds it (`listChoosableRaces`
 * through `buildCharacterSheetView`), within `oneOf`, by Rule Identity, in
 * `oneOf`'s order: what the control must offer.
 */
function pickerWithin(sheet: CharacterSheetSnapshot, oneOf: readonly string[]) {
  const choices = sheet.catalogView?.definitions ?? [];
  const view = buildCharacterSheetView(sheet, choices);
  const definitions = [...choices, ...sheet.catalogEntries];
  const picker = view.races.raceOptions.flatMap((option) => {
    const identity = definitions.find(
      (definition) => definition._id === option.catalogEntryId,
    )?.ruleIdentity;
    return identity && option.unavailableReason === null
      ? [{ value: identity, label: option.name }]
      : [];
  });
  return oneOf.flatMap(
    (identity) => picker.find(({ value }) => value === identity) ?? [],
  );
}
const heritageOptions = [keys.elf, keys.gnome, keys.kobold].sort();

test('the control offers exactly the race picker’s races within the options, also on a sheet whose inactive race row references a shared race the release omits', async () => {
  const { read, id, offered } = await fixture({ formerRace: true });
  const sheet = await read();
  expect(sheet.entries.filter((entry) => entry.kind === 'race')).toContainEqual(
    expect.objectContaining({ active: false, catalogEntryId: id(keys.kobold) }),
  );
  expect(await offered()).toEqual(pickerWithin(sheet, heritageOptions));
});

test('a shared Kobold the release omits, referenced only by an inactive race row, is listed with why it cannot be chosen and is not offered by the control', async () => {
  const { read, offered } = await fixture({ formerRace: true });
  const sheet = await read();
  const view = buildCharacterSheetView(sheet, sheet.catalogView?.definitions);
  expect(
    view.races.raceOptions.filter(({ name }) => name === 'Kobold'),
  ).toEqual([
    expect.objectContaining({ unavailableReason: unofferedChoiceReason }),
  ]);
  expect(pickerWithin(sheet, heritageOptions)).not.toContainEqual(
    expect.objectContaining({ value: keys.kobold }),
  );
  expect(await offered()).toEqual([
    { value: keys.elf, label: 'Elf' },
    { value: keys.gnome, label: 'Gnome' },
  ]);
});

test('the released Racial Heritage keeps its race options, and the race control offers those the race picker lets the Human choose', async () => {
  const { read, id, offered } = await fixture();
  const sheet = await read();
  expect(
    sheet.catalogEntries.find((entry) => entry._id === id(keys.heritage))
      ?.countsAsRaces,
  ).toEqual({ oneOf: [keys.elf, keys.gnome, keys.kobold].sort() });
  // Nothing on the sheet but the release's catalog choices holds Gnome.
  expect(
    sheet.catalogEntries.some((entry) => entry.ruleIdentity === keys.gnome),
  ).toBe(false);
  expect(await offered()).toEqual([
    { value: keys.elf, label: 'Elf' },
    { value: keys.gnome, label: 'Gnome' },
  ]);
});

test('Racial Heritage (Gnome), chosen from the control, counts the Gnome Bard reward and meets a gnome prerequisite; no choice or Elf does neither', async () => {
  const { choose, offered, counted, level } = await fixture();
  const notGnome = {
    races: [keys.human],
    rewards: [0],
    notCounted: [level],
    gnomeClause: [false],
  };
  expect(await counted()).toEqual(notGnome);
  const gnome = (await offered()).find(({ label }) => label === 'Gnome');
  if (!gnome) throw new Error('Gnome is not offered');
  await choose(gnome.value);
  expect(await counted()).toEqual({
    races: [keys.human, keys.gnome].sort(),
    rewards: [1],
    notCounted: [],
    gnomeClause: [true],
  });
  await choose(keys.elf);
  expect(await counted()).toEqual({
    ...notGnome,
    races: [keys.human, keys.elf].sort(),
  });
  await choose(null);
  expect(await counted()).toEqual(notGnome);
});

test('a race outside Racial Heritage’s options, or a race name, is refused', async () => {
  const { choose, counted, read, level } = await fixture();
  await choose(keys.gnome);
  const before = await read();
  for (const choice of [keys.tiefling, keys.human, 'Gnome'])
    await expect(choose(choice)).rejects.toThrow(
      'Choose one of the available races',
    );
  expect((await read()).entries).toEqual(before.entries);
  expect((await counted()).notCounted).not.toContain(level);
});
