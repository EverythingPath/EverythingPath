// @vitest-environment node
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { materializePinnedTree } from './pinned-sources';

// #726: the one reviewed change replacement, Intimidating Prowess's Strength
// formula, applies only to that record's exact raw change (CRB p. 128 adds the
// Strength modifier with no floor).
const prowessPath = 'packs/feats/intimidating-prowess.O0jbkTJcIji9BNiF.yaml';
const buletteLeapPath = 'src/pf-feats/Bulette_Leap_iz70tTKUwyHkxh5s.yaml';
const rawChange = `    - _id: zy5pz0i8
      formula: max(0, @abilities.str.mod)
      target: skill.int
      type: untyped`;

/** Imports the pinned Intimidating Prowess, rewritten by `edit`, and Bulette Leap. */
async function importProwess({
  edit = (text) => text,
  key = 'O0jbkTJcIji9BNiF',
}: {
  edit?: (text: string) => string;
  key?: string;
} = {}) {
  const tree = await materializePinnedTree([
    `pf1/${prowessPath}`,
    `pf1-content/${buletteLeapPath}`,
  ]);
  try {
    const path = join(tree.systemPath, prowessPath);
    const text = await readFile(path, 'utf8');
    expect(text).toContain(rawChange);
    await writeFile(path, edit(text).replaceAll('O0jbkTJcIji9BNiF', key));
    await rename(path, path.replace('O0jbkTJcIji9BNiF', key));
    const artifact = await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps: [],
      curation,
    });
    const modifiersOf = (externalKey: string) =>
      artifact.catalog.entries.find(
        (entry) => entry.externalKey === externalKey,
      )?.modifiers;
    return {
      prowess: modifiersOf(`pf1/${key}`),
      buletteLeap: modifiersOf('pf1-content/iz70tTKUwyHkxh5s'),
    };
  } finally {
    await tree.dispose();
  }
}

const clamped = { formula: 'max(0, @ability.str.mod)' };

it('replaces the exact raw change on Intimidating Prowess with the Strength modifier', async () => {
  expect((await importProwess()).prowess).toEqual([
    {
      target: 'skill.int',
      bonusType: 'untyped',
      value: { formula: '@ability.str.mod' },
    },
  ]);
});

it.each([
  [
    'target',
    (text: string) => text.replace('target: skill.int', 'target: skill.dip'),
    { target: 'skill.dip', bonusType: 'untyped', value: clamped },
  ],
  [
    'formula',
    (text: string) =>
      text.replace('max(0, @abilities.str.mod)', 'max(0, @abilities.dex.mod)'),
    {
      target: 'skill.int',
      bonusType: 'untyped',
      value: { formula: 'max(0, @ability.dex.mod)' },
    },
  ],
  [
    'type',
    (text: string) => text.replace('type: untyped', 'type: competence'),
    { target: 'skill.int', bonusType: 'competence', value: clamped },
  ],
])(
  'imports the upstream change as it is when its %s differs',
  async (_field, edit, modifier) => {
    expect((await importProwess({ edit })).prowess).toEqual([modifier]);
  },
);

it('imports the identical raw change on another record key as it is', async () => {
  expect((await importProwess({ key: 'O0jbkTJcIji9BNiG' })).prowess).toEqual([
    { target: 'skill.int', bonusType: 'untyped', value: clamped },
  ]);
});

it("leaves Bulette Leap's curated output with the same formula untouched", async () => {
  // #358's checked record: the Strength modifier on Acrobatics jumps during
  // Bulette Charge Style, written by the curator, not a raw change.
  expect((await importProwess()).buletteLeap).toContainEqual(
    expect.objectContaining({ target: 'skill.acr', value: clamped }),
  );
});
