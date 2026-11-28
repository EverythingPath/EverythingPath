import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { useCharacterSheetEntries } from './use-character-sheet-entries';
import { buildCharacterSheetView } from './character-sheet-view-model';
import {
  buildSheet,
  representativeWeapon,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';

const remote = vi.hoisted(() => ({ edit: vi.fn() }));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'characterSheet:editSheetEntry'
      ? remote.edit
      : vi.fn(),
}));

// CRB p. 307: magic weapon, +1 enhancement on one weapon's attack and damage.
const magicWeapon = (onItem?: { entry: string }): CatalogSheetEntry => ({
  id: 'magic-weapon',
  name: 'Magic weapon',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 1,
    itemTarget: 'weapon',
  },
  modifiers: [
    {
      target: 'attack',
      bonusType: 'enhancement',
      value: 1,
      condition: { weapon: '$target' },
    },
  ],
  ...(onItem ? { onItem } : {}),
});

test('a Spell Effect row carries its default caster level, duration and target choices', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      magicWeapon({ entry: 'sword' }),
    ],
  });
  const row = buildCharacterSheetView(snapshot).sheetEntries.find(
    (entry) => entry.name === 'Magic weapon',
  );
  expect(row?.spellEffect).toMatchObject({
    defaultCasterLevel: 1,
    duration: 'temporary',
    target: {
      itemTarget: 'weapon',
      status: 'available',
      name: 'Longsword',
      options: [
        expect.objectContaining({ name: 'Longsword', suitable: true }),
        expect.objectContaining({ name: 'Unarmed strike', suitable: true }),
      ],
    },
  });
});

test('choosing and clearing a Spell Effect target sends only its target', async () => {
  remote.edit.mockReset().mockResolvedValue(null);
  const snapshot = buildSheet({
    sheetEntries: [representativeWeapon('longsword', 'sword'), magicWeapon()],
  });
  const effect = snapshot.entries.find((row) => row.kind === 'spellEffect');
  const sword = snapshot.entries.find((row) => row.kind === 'item');
  if (!effect || !sword) throw new Error('Missing fixture rows');
  const view = renderHook(() =>
    useCharacterSheetEntries({ characterId: snapshot.character._id }, snapshot),
  );
  await act(() =>
    view.result.current.sheetEntries.setTarget(effect._id, {
      entry: sword._id,
      end: null,
    }),
  );
  expect(remote.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: effect._id,
    onItem: { entry: sword._id },
  });
  await act(() =>
    view.result.current.sheetEntries.setTarget(effect._id, {
      entry: 'unarmed',
      end: null,
    }),
  );
  expect(remote.edit).toHaveBeenLastCalledWith(
    expect.objectContaining({ onItem: { entry: 'unarmed' } }),
  );
  await act(() => view.result.current.sheetEntries.setTarget(effect._id, null));
  expect(remote.edit).toHaveBeenLastCalledWith(
    expect.objectContaining({ onItem: null }),
  );
  // A target that left Gear is refused before anything is sent.
  remote.edit.mockClear();
  await act(async () => {
    await view.result.current.sheetEntries.setTarget(effect._id, {
      entry: 'gone',
      end: null,
    });
  });
  expect(remote.edit).not.toHaveBeenCalled();
  expect(view.result.current.sheetEntries.status.kind).toBe('error');
});
