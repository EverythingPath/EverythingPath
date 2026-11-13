import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useCharacterSheetSelections } from './use-character-sheet-selections';

const writes = vi.hoisted(() => ({
  fill: vi.fn(),
  clear: vi.fn(),
  edit: vi.fn(),
  settings: vi.fn(),
  move: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:fillSelectionSlot': writes.fill,
      'characterSheet:clearSelectionSlot': writes.clear,
      'characterSheet:editSelection': writes.edit,
      'characterSheet:editCreationSettings': writes.settings,
      'characterSheet:moveSelection': writes.move,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

test('slot selection acknowledges saving at its position and preserves recorded-level choice order', async () => {
  const snapshot = buildSheet();
  const catalogEntryId = snapshot.catalogEntries[0]!._id;
  let finish: (() => void) | undefined;
  writes.fill.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve('new-selection');
      }),
  );
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.fill({
      slotId: 'feat:general',
      position: 0,
      catalogEntryId,
      gainedAtClassLevel: snapshot.entries[1]!._id,
      choiceOrder: 2,
    });
  });
  expect(view.result.current.statusForSlot('feat:general', 0)).toEqual({
    kind: 'saving',
  });
  expect(view.result.current.statusForSlot('feat:general', 1)).toEqual({
    kind: 'idle',
  });
  expect(writes.fill).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    slotId: 'feat:general',
    position: 0,
    catalogEntryId,
    gainedAtClassLevel: snapshot.entries[1]!._id,
    choiceOrder: 2,
  });
  await act(async () => {
    finish?.();
    expect(await save).toBe(true);
  });
  expect(view.result.current.statusForSlot('feat:general', 0)).toEqual({
    kind: 'saved',
  });
});

test('failed removal can be retried and reordering keeps the chosen entry identity', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[1]!._id;
  writes.clear.mockRejectedValueOnce(new ConvexError('Character is read only'));
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await act(async () => {
    expect(await view.result.current.remove(entryId)).toBe(false);
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'error',
    message: "Selection wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(await view.result.current.remove(entryId)).toBe(true);
  });
  await act(async () => {
    expect(await view.result.current.edit(entryId, { choiceOrder: 1 })).toBe(
      true,
    );
  });
  expect(writes.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId,
    choiceOrder: 1,
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'saved',
  });
});

test('switching Characters clears selection acknowledgements and ignores a late response', async () => {
  const initial = buildSheet();
  let finish: (() => void) | undefined;
  writes.clear.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(null);
      }),
  );
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  const entryId = initial.entries[1]!._id;
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.remove(entryId);
  });
  view.rerender({
    snapshot: {
      ...initial,
      character: {
        ...initial.character,
        _id: 'another-character' as typeof initial.character._id,
      },
    },
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({ kind: 'idle' });
  await act(async () => {
    finish?.();
    await save;
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({ kind: 'idle' });
});

test('another player’s selected feat definition edit is acknowledged while unrelated score changes are quiet', () => {
  const sheet = buildSheet({
    adjustments: [{ id: 'feat', name: 'Power Attack', modifiers: [] }],
  });
  const initial: CharacterSheetSnapshot = {
    ...sheet,
    entries: sheet.entries.map((entry) =>
      entry.kind === 'manual'
        ? { ...entry, kind: 'feat', state: { kind: 'feat', slot: 'general' } }
        : entry,
    ),
    catalogEntries: sheet.catalogEntries.map((entry) =>
      entry.detail.kind === 'manual'
        ? { ...entry, detail: { kind: 'feat' } }
        : entry,
    ),
  };
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: {
      ...initial,
      character: { ...initial.character, strength: 14 },
      lastOperationId: 'another-player',
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'another-player',
      catalogEntries: initial.catalogEntries.map((entry) =>
        entry.detail.kind === 'feat'
          ? { ...entry, name: 'Changed feat' }
          : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('alignment and deity changes use the existing sheet settings writer and acknowledge the field group', async () => {
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await act(async () => {
    expect(
      await view.result.current.saveFacts({
        alignment: 'LG',
        deity: 'Iomedae',
      }),
    ).toBe(true);
  });
  expect(writes.settings).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    settings: {},
    alignment: 'LG',
    deity: 'Iomedae',
  });
  expect(view.result.current.factsStatus).toEqual({ kind: 'saved' });
});

test('moving a Selection reports saving, refuses duplicate submissions and retries a failed move', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[1]!._id;
  let reject: ((error: unknown) => void) | undefined;
  writes.move.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  let move: Promise<boolean> | undefined;
  act(() => {
    move = view.result.current.move(entryId, 'earlier');
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'saving',
  });
  await act(async () => {
    expect(await view.result.current.move(entryId, 'later')).toBe(false);
  });
  await act(async () => {
    reject?.(new ConvexError('Character is read only'));
    expect(await move).toBe(false);
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'error',
    message: "Selection order wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(await view.result.current.move(entryId, 'earlier')).toBe(true);
  });
  expect(writes.move).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId,
    direction: 'earlier',
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'saved',
  });
});

test('another player’s order change on a personal adjustment leaves Feats & traits quiet', () => {
  const initial = buildSheet({
    adjustments: [
      {
        id: 'adjustment',
        name: 'Recorded adjustment',
        modifiers: [],
        gainedAtClassLevel: 'level-1',
      },
    ],
  });
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'another-player',
      entries: initial.entries.map((entry) =>
        entry.kind === 'manual' ? { ...entry, choiceOrder: 2 } : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test.each(['item', 'condition'] as const)(
  'another player changing a %s or its definition leaves Feats & traits quiet',
  (kind) => {
    const initial = buildSheet({
      sheetEntries: [
        {
          id: 'unrelated-entry',
          name: 'Unrelated entry',
          detail:
            kind === 'item'
              ? { kind: 'item', consumable: false }
              : { kind: 'condition' },
          modifiers: [],
        },
      ],
    });
    const view = renderHook(
      ({ snapshot }) =>
        useCharacterSheetSelections(
          { characterId: snapshot.character._id },
          snapshot,
        ),
      { initialProps: { snapshot: initial } },
    );
    view.rerender({
      snapshot: {
        ...initial,
        lastOperationId: 'another-player',
        entries: initial.entries.map((entry) =>
          entry.kind === kind ? { ...entry, active: false } : entry,
        ),
        catalogEntries: initial.catalogEntries.map((entry) =>
          entry.detail.kind === kind
            ? { ...entry, name: 'Changed entry' }
            : entry,
        ),
      },
    });
    expect(view.result.current.hasRemoteChange).toBe(false);
  },
);

test('another player changing an unselected feat definition leaves Feats & traits quiet', () => {
  const initial = buildSheet();
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'another-player',
      catalogEntries: [
        ...initial.catalogEntries,
        {
          ...initial.baseScoresEntry,
          _id: 'unselected-feat' as typeof initial.baseScoresEntry._id,
          name: 'Unselected feat',
          ruleIdentity: 'unselected-feat',
          detail: { kind: 'feat' },
        },
      ],
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
});
