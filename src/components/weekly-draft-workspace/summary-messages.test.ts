import { expect, test } from 'vitest';
import { summaryMessage } from './summary-messages';

test('an unresolved companion value the week requires names its character and the value to supply', () => {
  const view = {
    adjustments: [],
    options: { subjectId: [{ value: 'eidolon', label: 'Ixa' }] },
  };
  expect(
    summaryMessage(
      'upkeep:attrition:officer:eidolon:unresolved-constitution',
      view,
    ),
  ).toBe(
    'Ixa: Constitution can’t be calculated from this character’s sheet yet. Supply it on the sheet before confirming the week.',
  );
  expect(
    summaryMessage('drill:commandant:eidolon:unresolved-hit-dice', view),
  ).toBe(
    'Ixa: Hit Dice can’t be calculated from this character’s sheet yet. Supply them on the sheet, or enter a roster Hit Dice override, before confirming the week.',
  );
});
