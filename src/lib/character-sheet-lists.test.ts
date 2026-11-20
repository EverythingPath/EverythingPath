import { describe, expect, it } from 'vitest';
import { listAll } from './character-sheet-lists';

describe('listAll', () => {
  it('joins names as the sheet’s messages list them', () => {
    expect(listAll([])).toBe('');
    expect(listAll(['Chainmail (medium armor)'])).toBe(
      'Chainmail (medium armor)',
    );
    expect(listAll(['Brood', 'Twin'])).toBe('Brood and Twin');
    expect(listAll(['Full plate', 'Chainmail', 'Mystery mail'])).toBe(
      'Full plate, Chainmail and Mystery mail',
    );
  });
});
