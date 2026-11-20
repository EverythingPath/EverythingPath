import { expect, test } from 'vitest';
import {
  areCharacterSheetsAvailable,
  characterSheetSubject,
} from './character-sheet-availability';

const fixture = { namespace: 'sheet' };

test.each([
  // Before activation only E2E fixture campaigns and demo grants open sheets.
  ['legacy', { kind: 'campaign', campaign: {} }, false],
  ['legacy', { kind: 'campaign', campaign: null }, false],
  ['legacy', { kind: 'campaign', campaign: { e2eFixture: fixture } }, true],
  ['legacy', { kind: 'privateCharacter', character: {} }, false],
  [
    'legacy',
    { kind: 'privateCharacter', character: { sheetDemo: true } },
    true,
  ],
  ['legacy', { kind: 'privateCreation', user: {} }, false],
  ['legacy', { kind: 'privateCreation', user: null }, false],
  [
    'legacy',
    { kind: 'privateCreation', user: { characterSheetDemo: true } },
    true,
  ],
  // Sheet authority opens every subject; fixtures and demo grants stay open.
  ['sheet', { kind: 'campaign', campaign: {} }, true],
  ['sheet', { kind: 'campaign', campaign: { e2eFixture: fixture } }, true],
  ['sheet', { kind: 'privateCharacter', character: {} }, true],
  ['sheet', { kind: 'privateCreation', user: {} }, true],
  ['sheet', { kind: 'privateCreation', user: null }, true],
] as const)('%s authority, %j: %s', (authority, subject, expected) => {
  expect(areCharacterSheetsAvailable(authority, subject)).toBe(expected);
});

test("a Character's subject is its campaign, or the Character itself when private", () => {
  expect(
    characterSheetSubject({ sheetDemo: true }, { e2eFixture: fixture }),
  ).toEqual({
    kind: 'campaign',
    campaign: { e2eFixture: fixture },
  });
  expect(characterSheetSubject({ sheetDemo: true }, null)).toEqual({
    kind: 'privateCharacter',
    character: { sheetDemo: true },
  });
});
