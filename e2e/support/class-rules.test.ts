import { expect, it } from 'vitest';
import { versionLabel } from '../../src/components/character-sheet/class-switch-copy';
import { seededClassVersionLabel } from './class-rules';

it('names a seeded class version as the sheet labels a Character-scoped definition', () => {
  for (const name of ['Rogue', 'Rogue (Unchained)']) {
    expect(seededClassVersionLabel(name)).toBe(
      versionLabel({ name, scope: 'character', isCampaignPreference: false }),
    );
  }
  expect(seededClassVersionLabel('Rogue (Unchained)')).toBe(
    'Rogue (Unchained) (this Character)',
  );
});
