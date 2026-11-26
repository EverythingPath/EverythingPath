// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pinnedPath } from './catalog/pinned-sources';
import {
  levelTwelveSpellFiles,
  readPinnedSpellFiles,
  readPinnedSpells,
} from './level-twelve-sheets';

// pbl-store-topup fix r1: the level-twelve sheets read a committed list of
// Spell files, the 1,259 the store held at 9ea73b38, so a Spell added to the
// append-only store never changes which ones they use.

it('reads every listed Spell, in the list’s order, which is file order', () => {
  expect(levelTwelveSpellFiles).toHaveLength(1_259);
  expect([...levelTwelveSpellFiles].sort()).toEqual(levelTwelveSpellFiles);
  expect(new Set(levelTwelveSpellFiles).size).toBe(1_259);
  const spells = readPinnedSpells();
  expect(spells).toHaveLength(1_259);
  // Each listed file's own record ID, read apart from the reader, in list order.
  expect(spells.map(({ key }) => key)).toEqual(
    levelTwelveSpellFiles.map((file) => {
      const text = readFileSync(
        pinnedPath('pf1', `packs/spells/${file}`),
        'utf8',
      );
      return `pf1/${/^_id: *(\S+)$/m.exec(text)?.[1]}`;
    }),
  );
});

it('fails naming a listed Spell the store does not hold', () => {
  expect(() =>
    readPinnedSpellFiles(['fireball.0000000000000000.yaml']),
  ).toThrow(
    'Pinned store lacks pf1/packs/spells/fireball.0000000000000000.yaml.',
  );
});
