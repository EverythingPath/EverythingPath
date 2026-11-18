import { expect, test } from 'vitest';
import { describeCollectionNote } from './spellcasting-parts';

test('the witch collection note follows familiar book recording facts instead of its heading', () => {
  expect(describeCollectionNote({ record: 'book', bookType: 'familiar' })).toBe(
    'Witch Spells stay with the witch through familiar replacement and restoration.',
  );
  expect(
    describeCollectionNote({ record: 'known', bookType: 'familiar' }),
  ).toBe(null);
  expect(
    describeCollectionNote({ record: 'book', bookType: 'spellbook' }),
  ).toBe(null);
  expect(describeCollectionNote(undefined)).toBe(null);
});
