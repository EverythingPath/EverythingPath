// @vitest-environment node
// racial-heritage-counts-as (PRD #251): the Advanced Player's Guide's Racial
// Heritage (pf1-content/1LULpgVNjQWqUGUk, an import key of campaign-mvp-v1):
// "Choose another humanoid race. You count as both human and that race for
// any effects related to race." The importer gives it `countsAsRaces:
// { oneOf }` of every imported race whose creature type is humanoid, other
// than the Human race, so its saved choice joins the sheet's race identities
// (`resolveCharacterSheetRacialFacts`), which the favored-class reward count
// and race prerequisites read. A pinned tree's import, read by the sheet's
// calculation.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { afterAll, expect, test } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import type { RaceEquivalenceChoice } from '../../scripts/catalog/map';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { sheetCatalog } from './rule-value-sheets';
import { materializePinnedTree, pinnedPath } from './pinned-sources';

const heritage = 'pf1-content/1LULpgVNjQWqUGUk';
// Gnome Trickster: "Prerequisites: Cha 13, gnome, gnome magic racial trait".
const gnomeTrickster = 'pf1-content/vOMOZeC9pwPuITj2';
const bard = 'pf1/6GjOjO6r3R06fLwE';
const races = {
  human: 'pf1/e6IaBxKgMxy1yKlr',
  gnome: 'pf1/efwHEwjvL9Z94MJI',
  elf: 'pf1/NgIhxRI0axrf3fcO',
  halfElf: 'pf1/cCepRrfH5SalFfT4',
  // Outsider (native): not a humanoid race.
  tiefling: 'pf1/nVjKDLZSRONzYm8f',
} as const;

const tree = await materializePinnedTree([
  'pf1/packs/classes/bard.6GjOjO6r3R06fLwE.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  'pf1-content/src/pf-feats/Gnome_Trickster_vOMOZeC9pwPuITj2.yaml',
]);
afterAll(() => tree.dispose());
// The pinned record (sha256 e4878656… in feats-334's legal inventory), from
// the store.
const heritageFile = 'src/pf-feats/Racial_Heritage_1LULpgVNjQWqUGUk.yaml';
await copyFile(
  pinnedPath('pf1-content', heritageFile),
  `${tree.contentPath}/${heritageFile}`,
);
const artifact = await importCatalog({
  systemPath: tree.systemPath,
  contentPath: tree.contentPath,
  remaps: JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  ) as unknown,
  curation: reviewedCuration,
  // A partial pinned tree, not the verified whole corpus.
  wholeCorpus: false,
});
const imported = (key: string) => {
  const entry = artifact.catalog.entries.find(
    (row) => row.externalKey === key,
  );
  if (!entry) throw new Error(`${key} was not imported`);
  return importedCatalogEntrySchema.parse(entry);
};

test('the imported Racial Heritage counts as one of the humanoid races other than Human, chosen', () => {
  // Gnome, Elf and Half-Elf are humanoid; Human is the feat's own race and
  // the Tiefling is a native outsider.
  expect(imported(heritage).countsAsRaces).toEqual({
    oneOf: [races.halfElf, races.elf, races.gnome].sort(),
  });
  // A release body carries it as the importer emits it.
  expect(
    importedCatalogEntrySchema.parse(
      JSON.parse(JSON.stringify(imported(heritage))),
    ).countsAsRaces,
  ).toEqual({ oneOf: [races.halfElf, races.elf, races.gnome].sort() });
  // No other imported entry gains a race equivalence, and none reports one
  // (Gnome Trickster: no rule names it).
  expect(
    artifact.catalog.entries
      .filter((entry) => entry.countsAsRaces !== undefined)
      .map((entry) => entry.externalKey),
  ).toEqual([heritage]);
  expect(
    artifact.catalog.entries.flatMap((entry) =>
      entry.unsupported
        .filter(({ field }) => field === 'countsAsRaces')
        .map(() => entry.externalKey),
    ),
  ).toEqual([]);
});

test('a race-equivalence result is no rule, the fact or the issue, never a fact with an issue or with no race', () => {
  const variants: RaceEquivalenceChoice[] = [
    { kind: 'noRule' },
    { kind: 'fact', countsAsRaces: { oneOf: [races.gnome] } },
    { kind: 'issue', issue: { field: 'countsAsRaces', reason: 'stale' } },
  ];
  const refused = [
    {
      kind: 'fact',
      countsAsRaces: { oneOf: [races.gnome] },
      // @ts-expect-error: a fact carries no issue.
      issue: { field: 'countsAsRaces', reason: 'stale' },
    },
    // @ts-expect-error: a fact names at least one race.
    { kind: 'fact', countsAsRaces: { oneOf: [] } },
    {
      kind: 'issue',
      issue: { field: 'countsAsRaces', reason: 'stale' },
      // @ts-expect-error: an issue carries no fact.
      countsAsRaces: { oneOf: [races.gnome] },
    },
  ] satisfies RaceEquivalenceChoice[];
  expect(variants.map(({ kind }) => kind)).toEqual(['noRule', 'fact', 'issue']);
  expect(refused).toHaveLength(3);
});

/** A race definition as a release prepares it for the sheet. */
function raceDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = imported(key);
  return {
    _id: key,
    ruleIdentity: key,
    name: entry.name,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [] },
  };
}
/** A feat definition with its imported prerequisites and race equivalence. */
function featDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = imported(key);
  return {
    _id: key,
    ruleIdentity: key,
    name: entry.name,
    modifiers: [],
    detail: { kind: 'feat' },
    ...(entry.prerequisites && { prerequisites: entry.prerequisites }),
    ...(entry.countsAsRaces && { countsAsRaces: entry.countsAsRaces }),
  };
}

/**
 * A Human Bard 1 with Charisma 18 and Bard as the favored class, whose level
 * takes the Gnome Bard's reward, with Gnome Trickster and, when `heritage`
 * is given, Racial Heritage with that saved choice (`null`: none).
 */
function humanBard({ heritage: choice }: { heritage?: string | null } = {}) {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base', favoredClassIds: [bard] },
    },
    {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: races.human,
      state: { kind: 'race' },
    },
    {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: bard,
        position: 1,
        hpGained: 8,
        favoredClassBonus: {
          choice: 'reward',
          reward: 'bardicPerformanceRound',
        },
      },
    },
    {
      _id: 'trickster-row',
      kind: 'feat',
      active: true,
      catalogEntryId: gnomeTrickster,
      state: { kind: 'feat' },
    },
    ...(choice === undefined
      ? []
      : [
          {
            _id: 'heritage-row',
            kind: 'feat' as const,
            active: true,
            catalogEntryId: heritage,
            state: {
              kind: 'feat' as const,
              ...(choice === null ? {} : { choice }),
            },
          },
        ]),
  ];
  return calculateCharacterSheet({
    characterKind: 'pc',
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: ability === 'charisma' ? 18 : 10,
        })),
      },
      ...sheetCatalog(artifact).filter((entry) => entry._id === bard),
      ...Object.values(races).map(raceDefinition),
      featDefinition(heritage),
      featDefinition(gnomeTrickster),
    ],
  });
}
type Sheet = ReturnType<typeof humanBard>;
const notCounted = (sheet: Sheet) =>
  sheet.warnings
    .filter(({ check }) => check === 'favoredClassRewardNotCounted')
    .map(({ subject }) => subject);
/** Gnome Trickster's current `race` clause: met or not. */
const gnomeClause = (sheet: Sheet) =>
  sheet.prerequisites
    .filter(
      (check) =>
        check.entryId === 'trickster-row' &&
        check.view === 'current' &&
        'race' in check.clause,
    )
    .map(({ clause, met }) => ({ clause, met }));

test('Gnome Trickster requires a gnome race', () => {
  expect(featDefinition(gnomeTrickster).prerequisites).toContainEqual(
    expect.objectContaining({ race: [races.gnome] }),
  );
});

test('a Human Bard with Racial Heritage (Gnome) counts as a gnome: the Gnome Bard reward counts and the gnome race clause is met', () => {
  const sheet = humanBard({ heritage: races.gnome });
  expect(sheet.racial.countsAsRaces).toEqual(
    [races.human, races.gnome].sort(),
  );
  expect(notCounted(sheet)).toEqual([]);
  expect(gnomeClause(sheet)).toEqual([
    { clause: expect.objectContaining({ race: [races.gnome] }), met: true },
  ]);
});

test('without the feat, with no choice saved or with another race chosen, the Human Bard does not count as a gnome', () => {
  for (const sheet of [
    humanBard(),
    humanBard({ heritage: null }),
    humanBard({ heritage: races.elf }),
  ]) {
    expect(sheet.racial.countsAsRaces).not.toContain(races.gnome);
    expect(notCounted(sheet)).toEqual(['level-1']);
    expect(gnomeClause(sheet)).toEqual([
      { clause: expect.objectContaining({ race: [races.gnome] }), met: false },
    ]);
  }
  // Elf chosen: an Elf, not a Gnome.
  expect(humanBard({ heritage: races.elf }).racial.countsAsRaces).toEqual(
    [races.human, races.elf].sort(),
  );
});

test('a saved choice that is not one of the humanoid races adds nothing', () => {
  for (const choice of [races.tiefling, races.human, 'Gnome', 'gnome']) {
    const sheet = humanBard({ heritage: choice });
    expect(sheet.racial.countsAsRaces).toEqual([races.human]);
    expect(notCounted(sheet)).toEqual(['level-1']);
  }
});

/**
 * Racial Heritage imported beside `raceFiles` from a copy of its pinned
 * record with `edit` applied to the text: the feat's facts and issues.
 */
async function importEdited(
  raceFiles: readonly string[],
  edit: (text: string) => string = (text) => text,
) {
  const edited = await materializePinnedTree(
    raceFiles.map((file) => `pf1/packs/races/${file}.yaml`),
  );
  try {
    const text = await readFile(
      pinnedPath('pf1-content', heritageFile),
      'utf8',
    );
    await writeFile(`${edited.contentPath}/${heritageFile}`, edit(text));
    const result = await importCatalog({
      systemPath: edited.systemPath,
      contentPath: edited.contentPath,
      remaps: [],
      curation: reviewedCuration,
      wholeCorpus: false,
    });
    const feat = result.catalog.entries.find(
      (row) => row.externalKey === heritage,
    );
    return {
      countsAsRaces: feat?.countsAsRaces,
      issues: feat?.unsupported.filter(
        ({ field }) => field === 'countsAsRaces',
      ),
    };
  } finally {
    await edited.dispose();
  }
}
const humanGnome = ['human.e6IaBxKgMxy1yKlr', 'gnome.efwHEwjvL9Z94MJI'];

test('a changed choice or effect sentence imports Racial Heritage without the fact, naming the rule and the missing sentence', async () => {
  // The record's text, unchanged, gives the fact.
  expect(await importEdited(humanGnome)).toEqual({
    countsAsRaces: { oneOf: [races.gnome] },
    issues: [],
  });
  for (const [from, to, missing] of [
    [
      'Choose another humanoid race.',
      'Choose another Small humanoid race.',
      'Choose another humanoid race.',
    ],
    [
      // The record's folded text breaks the line after "You".
      'count as both human and that race',
      'count as that race',
      'You count as both human and that race for any effects related to race.',
    ],
  ] as const) {
    const result = await importEdited(humanGnome, (text) =>
      text.replace(from, to),
    );
    expect(result).toEqual({
      countsAsRaces: undefined,
      issues: [
        {
          field: 'countsAsRaces',
          reason: `The reviewed race equivalence of Racial Heritage no longer matches its description, which lacks: ${missing}`,
        },
      ],
    });
  }
});

test('with Human the only humanoid race imported, Racial Heritage has no options and says so', async () => {
  expect(
    await importEdited(['human.e6IaBxKgMxy1yKlr', 'tiefling.nVjKDLZSRONzYm8f']),
  ).toEqual({
    countsAsRaces: undefined,
    issues: [
      {
        field: 'countsAsRaces',
        reason:
          'The reviewed race equivalence of Racial Heritage has no humanoid race other than Human in these inputs.',
      },
    ],
  });
});
