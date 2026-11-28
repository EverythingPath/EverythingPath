// @vitest-environment node
import { expect, test } from 'vitest';
import { importReleasedEntries } from '../../tests/catalog/released-entries';
import { sheetDefinition } from '../../tests/catalog/released-race-sheet';
import { humanDualTalentCatalog } from '../fixtures/human-dual-talent';

test('the isolated Human and Dual Talent graph matches pinned source-derived definitions', async () => {
  // The Human and its five Racial Traits, imported from the pinned store: the
  // Human's granted traits and the traits' race are among them.
  const keys = [
    'pf1-content/BFszTUJLlDS1ZDB8',
    'pf1-content/LwDcZanOEHqVaYoh',
    'pf1-content/SRBfqkzIldwETAHB',
    'pf1-content/eNIYJNbM6UL7OdyE',
    'pf1-content/uAJ9hLZYdH2JX7J8',
    'pf1/e6IaBxKgMxy1yKlr',
  ];
  const { entries } = await importReleasedEntries(keys);
  expect(humanDualTalentCatalog.map((entry) => entry._id).sort()).toEqual(keys);
  for (const fixture of humanDualTalentCatalog) {
    const source = entries.get(fixture._id);
    if (!source) throw new Error('Missing pinned Human fixture source');
    expect(fixture).toEqual({
      ...sheetDefinition(source),
      sources: source.sources,
    });
  }
});
