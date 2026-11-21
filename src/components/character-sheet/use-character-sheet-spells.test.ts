import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import type { Id } from '@convex/_generated/dataModel';
import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';

import { useCharacterSheetSpells } from './use-character-sheet-spells';

const writes = vi.hoisted(() => ({ record: vi.fn(), remove: vi.fn() }));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheetSpells:record': writes.record,
      'characterSheetSpells:remove': writes.remove,
    })[getFunctionName(reference)],
}));
beforeEach(() => {
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  );
});

const spell = {
  catalogEntryId: 'shield' as Id<'catalogEntry'>,
  name: 'Shield',
};

test('recording acknowledges only that Spell and sends its explicit off-list level', async () => {
  let finish: (() => void) | undefined;
  writes.record.mockReturnValue(
    new Promise<void>((done) => {
      finish = done;
    }),
  );
  const snapshot = buildSheet({
    levels: [{ id: 'wizard-level', hp: 6, classId: 'wizard' }],
  });
  const view = renderHook(() =>
    useCharacterSheetSpells({ characterId: snapshot.character._id }, snapshot),
  );
  let saved: Promise<boolean> | undefined;
  act(() => {
    saved = view.result.current.record({
      castingClassId: 'wizard',
      spell,
      level: 3,
    });
  });
  expect(
    view.result.current.statusForSpell('wizard', spell.catalogEntryId),
  ).toEqual({ kind: 'saving' });
  expect(view.result.current.statusForSpell('wizard', 'other')).toEqual({
    kind: 'idle',
  });
  expect(writes.record).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    castingClassId: 'wizard',
    catalogEntryId: 'shield',
    level: 3,
    operationId: expect.any(String),
  });
  await act(async () => {
    finish?.();
    expect(await saved).toBe(true);
  });
  expect(
    view.result.current.statusForSpell('wizard', spell.catalogEntryId),
  ).toEqual({ kind: 'saved' });
});

test('a rejected Spell write stays available for retry and scope changes discard its acknowledgement', async () => {
  writes.record.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  const snapshot = buildSheet({
    levels: [{ id: 'wizard-level', hp: 6, classId: 'wizard' }],
  });
  const view = renderHook(
    ({ characterId }) => useCharacterSheetSpells({ characterId }, snapshot),
    {
      initialProps: { characterId: snapshot.character._id },
    },
  );
  await act(async () => {
    expect(
      await view.result.current.record({ castingClassId: 'wizard', spell }),
    ).toBe(false);
  });
  expect(view.result.current.statusForSpell('wizard', 'shield')).toEqual({
    kind: 'error',
    message: "Shield wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(
      await view.result.current.record({ castingClassId: 'wizard', spell }),
    ).toBe(true);
  });
  view.rerender({ characterId: 'other-character' as Id<'character'> });
  expect(view.result.current.statusForSpell('wizard', 'shield')).toEqual({
    kind: 'idle',
  });
});

test('orphaned Spells remain removable and remote collection changes are acknowledged', async () => {
  const initial = buildSheet({
    sheetEntries: [
      {
        id: 'spell-entry',
        name: 'Shield',
        modifiers: [],
        detail: { kind: 'spell', levels: { wizard: 1 } },
      },
    ],
  });
  initial.entries = initial.entries.map((entry) =>
    entry.kind === 'spell'
      ? { ...entry, state: { kind: 'spell', level: 1 } }
      : entry,
  );
  initial.calculated = calculateCharacterSheet({
    ...initial,
    characterKind: 'pc',
  });
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSpells(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    {
      initialProps: { snapshot: initial },
    },
  );
  await act(async () => {
    expect(
      await view.result.current.remove({
        entryId: 'spell-entry',
        name: 'Shield',
      }),
    ).toBe(true);
  });
  expect(writes.remove).toHaveBeenCalledWith({
    characterId: initial.character._id,
    entryId: 'spell-entry',
    operationId: expect.any(String),
  });
  const remote = buildSheet({ lastOperationId: 'other-player' });
  view.rerender({ snapshot: remote });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('editing a recorded off-list level keeps the Spell identity and reports its own save', async () => {
  const snapshot = buildSheet({
    levels: [{ id: 'caster', classId: 'wizard', hp: 6 }],
    sheetEntries: [
      {
        id: 'off-list',
        name: 'Bless',
        modifiers: [],
        detail: { kind: 'spell', levels: { cleric: 1 } },
      },
    ],
  });
  const wizard = snapshot.catalogEntries.find(
    (entry) => entry._id === 'wizard',
  );
  if (!wizard) throw new Error('Wizard fixture is unavailable');
  snapshot.entries = snapshot.entries.map((entry) =>
    entry.kind === 'spell'
      ? {
          ...entry,
          state: { kind: 'spell', castingClassId: wizard._id, level: 1 },
        }
      : entry,
  );
  const view = renderHook(() =>
    useCharacterSheetSpells({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(
      await view.result.current.editLevel({
        entryId: 'off-list',
        name: 'Bless',
        level: 3,
      }),
    ).toBe(true);
  });
  expect(writes.record).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    castingClassId: 'wizard',
    catalogEntryId: 'off-list-catalog',
    level: 3,
    operationId: expect.any(String),
  });
  expect(view.result.current.statusForEntry('off-list')).toEqual({
    kind: 'saved',
  });
});
