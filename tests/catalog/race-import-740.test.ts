// @vitest-environment node
import { expect, test } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import { materializePinnedTree } from './pinned-sources';
import {
  alternateRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import { resolve } from 'node:path';

test('Oversized Goblins replaces the complete base adjustments and uses Medium size until removed', async () => {
  const goblin = 'pf1/bOv30pyHB1gFbSTj';
  const oversized = 'pf1-content/xPtJg4WPKxVRmVdM';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/race-ability-721/pf1'),
    contentPath: resolve('tests/fixtures/race-ability-721/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  const definition = artifact.catalog.entries.find(
    (entry) => entry.externalKey === oversized,
  );
  expect(definition?.detail).toMatchObject({
    replaces: [raceAbilityTraitKey(goblin)],
    size: 'medium',
  });
  expect(definition?.modifiers).toEqual([
    { target: 'ability.str', bonusType: 'racial', value: 2 },
    { target: 'ability.dex', bonusType: 'racial', value: 2 },
    { target: 'ability.cha', bonusType: 'racial', value: -2 },
  ]);
  const race = artifact.catalog.entries.find(
    (entry) => entry.externalKey === goblin,
  );
  if (race?.detail.kind !== 'race') throw new Error('Missing Goblin');
  const needed = new Set([
    goblin,
    oversized,
    ...(race.detail.racialTraits ?? []),
  ]);
  const definitions = artifact.catalog.entries
    .filter((entry) => needed.has(entry.externalKey))
    .map(sheetDefinition);
  const row = alternateRow(oversized);
  const input = raceSheet({ race: goblin, definitions, entries: [row] });
  const selected = calculateCharacterSheet(input);
  expect(selected.racial.size).toBe('medium');
  expect(selected.abilities.strength.score).toBe(12);
  expect(selected.abilities.dexterity.score).toBe(12);
  expect(selected.abilities.charisma.score).toBe(8);
  expect(
    selected.breakdowns['skill.ste'].applied.some(
      (modifier) => modifier.bonusType === 'size',
    ),
  ).toBe(false);
  const base = calculateCharacterSheet(
    raceSheet({ race: goblin, definitions }),
  );
  expect(base.racial.size).toBe('small');
  expect(base.abilities.strength.score).toBe(8);
  expect(base.abilities.dexterity.score).toBe(14);
  expect(
    calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'racialTrait' && entry._id === row._id
          ? { ...entry, active: false }
          : entry,
      ),
    }).abilities,
  ).toEqual(base.abilities);
  expect(calculateCharacterSheet(input).abilities).toEqual(selected.abilities);
});

const tiefling = 'pf1/nVjKDLZSRONzYm8f';
const devilSpawn = 'pf1-content/izCRmMUEyikdfpiq';
const files = {
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml':
    '1f258d31b77f9f8df3521c150ffdbf998e974d9f8fc98b3b70e05ba5859f71f3',
  'pf1-content/src/pf-racial-traits/Devil_Spawn__Hellspawn__izCRmMUEyikdfpiq.yaml':
    'b200a0e72d87af3a69a71b0b455534edd4e4056e10545a8f3c8e69aa849ba699',
  'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml':
    'd07bb59280aac70098b0c8de52e4fec8b96e92ab67f9ef833145420ef9559320',
  'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml':
    '1e5c0ca354e3b4c1bc676d22dd5323fc8d19593b1e89e267ed5e92500646c827',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml':
    '92c962c2e647d4f466dde9b64e370b3d9c02bb0604193cff06771e32e622b762',
};

test('the authentic #400 curated Devil-Spawn ability line replaces the derived local Tiefling trait and restores it when removed', async () => {
  const tree = await materializePinnedTree(Object.keys(files), {
    sha256: files,
  });
  try {
    const imported = await importCatalog({
      ...tree,
      remaps: [],
      curation: reviewedCuration,
    });
    const alternate = imported.catalog.entries.find(
      (entry) => entry.externalKey === devilSpawn,
    );
    expect(alternate?.detail).toMatchObject({
      replaces: [raceAbilityTraitKey(tiefling)],
    });
    expect(alternate?.modifiers).toEqual([
      { target: 'ability.con', bonusType: 'racial', value: 2 },
      { target: 'ability.wis', bonusType: 'racial', value: 2 },
      { target: 'ability.cha', bonusType: 'racial', value: -2 },
    ]);
    const sheet = (selected: boolean) =>
      calculateCharacterSheet(
        raceSheet({
          race: tiefling,
          definitions: imported.catalog.entries.map(sheetDefinition),
          entries: selected ? [alternateRow(devilSpawn)] : [],
        }),
      );
    const base = sheet(false);
    expect(base.abilities.dexterity.score).toBe(12);
    expect(base.abilities.intelligence.score).toBe(12);
    expect(base.abilities.constitution.score).toBe(10);
    const replaced = sheet(true);
    expect(replaced.abilities.dexterity.score).toBe(10);
    expect(replaced.abilities.intelligence.score).toBe(10);
    expect(replaced.abilities.constitution.score).toBe(12);
    expect(replaced.abilities.wisdom.score).toBe(12);
    expect(replaced.abilities.charisma.score).toBe(8);
    expect(
      replaced.breakdowns['ability.con'].applied.filter(
        (modifier) => modifier.bonusType === 'racial',
      ),
    ).toHaveLength(1);
    expect(sheet(false).abilities).toEqual(base.abilities);
  } finally {
    await tree.dispose();
  }
});
