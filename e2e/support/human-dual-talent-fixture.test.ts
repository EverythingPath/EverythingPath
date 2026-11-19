// @vitest-environment node
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { sheetDefinition } from '../../tests/fixtures/racial-traits-719/sheet';
import { humanDualTalentCatalog } from '../fixtures/human-dual-talent';

test('the isolated Human and Dual Talent graph matches pinned source-derived definitions', async () => {
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/racial-traits-719/pf1'),
    contentPath: resolve('tests/fixtures/racial-traits-719/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  expect(humanDualTalentCatalog.map((entry) => entry._id).sort()).toEqual([
    'pf1-content/BFszTUJLlDS1ZDB8',
    'pf1-content/LwDcZanOEHqVaYoh',
    'pf1-content/SRBfqkzIldwETAHB',
    'pf1-content/eNIYJNbM6UL7OdyE',
    'pf1-content/uAJ9hLZYdH2JX7J8',
    'pf1/e6IaBxKgMxy1yKlr',
  ]);
  for (const fixture of humanDualTalentCatalog) {
    const source = artifact.catalog.entries.find(
      (entry) => entry.externalKey === fixture._id,
    );
    if (!source) throw new Error('Missing pinned Human fixture source');
    expect(fixture).toEqual({
      ...sheetDefinition(source),
      sources: source.sources,
    });
  }
});
