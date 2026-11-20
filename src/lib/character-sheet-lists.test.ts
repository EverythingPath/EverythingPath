import { describe, expect, it } from 'vitest';
import { listAll, listAny } from './character-sheet-lists';

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

describe('listAny', () => {
  it('joins the options a choice may be as alternatives', () => {
    expect(listAny([])).toBe('');
    expect(listAny(['Cleric'])).toBe('Cleric');
    expect(listAny(['Rage', 'Barbarian'])).toBe('Rage or Barbarian');
    expect(listAny(['Cleric', 'Oracle', 'Paladin'])).toBe(
      'Cleric, Oracle or Paladin',
    );
  });
});
