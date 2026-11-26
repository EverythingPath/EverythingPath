// @vitest-environment node
// pbl-reseed-generic fix r1 (PRD #251): a heritage case names the test path
// it takes by its kind, and the type refuses a case that would silently skip
// that path's assertion.
import { expect, it } from 'vitest';
import { abilityKeys } from '../../src/lib/character-sheet-abilities';
import { heritageCases, type HeritageCase } from './race-heritage-cases';

const source = {
  name: 'Example',
  externalKey: 'pf1-content/example',
  race: 'pf1/example',
  raceFile: 'pf1/packs/races/example.yaml',
  path: 'pf1-content/src/pf-racial-traits/Example.yaml',
  folderFiles: [],
  sourceSha256: '0'.repeat(64),
};

it('refuses a case without a kind, a shapechange without a valid ability and an ability on a path that does not check it', () => {
  const illegal: HeritageCase[] = [
    // @ts-expect-error a case names its path
    { ...source, ordinaryScores: [10, 10, 10, 10, 10, 10] },
    {
      ...source,
      kind: 'shapechanged',
      ordinaryScores: [10, 10, 10, 10, 10, 10],
      // @ts-expect-error the shapechange path needs an ability key
      shapechangedAbility: '',
    },
    // @ts-expect-error the shapechange path needs its ability
    { ...source, kind: 'shapechanged', ordinaryScores: [10] },
    {
      ...source,
      kind: 'mapped',
      ordinaryScores: [10, 10, 10, 10, 10, 10],
      // @ts-expect-error a mapped case checks no shapechange
      shapechangedAbility: 'strength',
    },
    // @ts-expect-error a mapped case needs its expected scores
    { ...source, kind: 'mapped' },
  ];
  expect(illegal).toHaveLength(5);
});

it('holds the nine cases: six mapped, one shapechanged and two withheld', () => {
  expect(heritageCases.map(({ kind }) => kind).sort()).toEqual([
    'mapped',
    'mapped',
    'mapped',
    'mapped',
    'mapped',
    'mapped',
    'shapechanged',
    'withheldSourceConflict',
    'withheldSourceConflict',
  ]);
  for (const row of heritageCases)
    if (row.kind === 'shapechanged')
      expect(abilityKeys).toContain(row.shapechangedAbility);
});
