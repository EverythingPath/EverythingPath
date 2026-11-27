import { expect, test } from 'vitest';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';
import { formatGrantKeyId } from '~/lib/character-sheet-grants';
import { calculateCharacterSheetPreview } from './calculate-character-sheet-preview';
import { buildSheet } from './character-sheet-test-fixture';

// #411: CRB p. 22 elf after a release retired Keen Senses. Local previews
// count the Grant only for a Character that already had it, as saves do.
test('local previews apply the selected release to a retired Grant target', () => {
  const sheet = buildSheet({ race: { key: 'elf' } });
  const keenSenses = formatGrantKeyId({
    source: 'elf',
    entry: 'elf-keen-senses',
  });
  const perception = (retainedGrantIds: string[]) =>
    calculateCharacterSheetPreview({
      ...sheet,
      catalogView: {
        releaseNumber: 1,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        resources: { castingTables: undefined },
        legalInputs: null,
        retired: {
          ruleIdentities: ['elf-keen-senses'],
          retainedGrantIds,
        },
        definitions: [],
        advisories: [],
      },
    }).breakdowns['skill.per'].total;
  expect(
    calculateCharacterSheetPreview(sheet).breakdowns['skill.per'].total,
  ).toBe(2);
  expect(perception([keenSenses])).toBe(2);
  expect(perception([])).toBe(0);
});
