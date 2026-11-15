import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { useCharacterSheetGrants } from './use-character-sheet-grants';

const writes = vi.hoisted(() => ({
  kept: vi.fn(),
  discard: vi.fn(),
  grant: vi.fn(),
  selection: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:setDormantEntryKept': writes.kept,
      'characterSheet:discardDormantEntry': writes.discard,
      'characterSheet:editGrantState': writes.grant,
      'characterSheet:editSelection': writes.selection,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

const row: GrantEntryView = {
  rowId: 'grant:armor',
  target: { grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' } },
  name: 'Armor Training 1',
  kind: 'classFeature',
  origin: 'grant',
  recorded: false,
  active: true,
  kept: false,
  dormant: true,
  counting: false,
  gainedAtClassLevel: null,
  unplaced: false,
  status: 'dormant',
  choice: 'heavy armor',
  notes: '',
  sourceLabel: 'Fighter 3',
  reason: 'Replaced by Weapon Master',
  canKeep: true,
  canDiscard: false,
  canEditChoice: true,
  replaced: [],
};

test('catalog targets retain Grant Keys and resolve stored selections without treating derived row IDs as stored IDs', () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Blessing', modifiers: [] }],
  });
  const stored = snapshot.entries.find((entry) => entry.kind === 'manual');
  if (!stored) throw new Error('Missing adjustment');
  const view = renderHook(() =>
    useCharacterSheetGrants({ characterId: snapshot.character._id }, snapshot),
  );
  expect(view.result.current.getCatalogDetachTarget(row.target)).toEqual({
    kind: 'grant',
    grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
  });
  expect(
    view.result.current.getCatalogDetachTarget({ entryId: stored._id }),
  ).toEqual({ kind: 'entry', entryId: stored._id });
  expect(
    view.result.current.getCatalogDetachTarget({ entryId: 'derived:missing' }),
  ).toBeUndefined();
});

test('Keep acknowledges saving on its own row and uses the Grant Key for an unstored replacement', async () => {
  let resolve: (() => void) | undefined;
  writes.kept.mockReturnValue(
    new Promise<null>((done) => {
      resolve = () => done(null);
    }),
  );
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterSheetGrants({ characterId: snapshot.character._id }, snapshot),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = result.current.setKept(row, true);
  });
  expect(result.current.statusFor(row.rowId)).toEqual({ kind: 'saving' });
  expect(result.current.statusFor('other')).toEqual({ kind: 'idle' });
  expect(writes.kept).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target: row.target,
    kept: true,
  });
  await act(async () => {
    resolve?.();
    expect(await save).toBe(true);
  });
  expect(result.current.statusFor(row.rowId)).toEqual({ kind: 'saved' });
});

test('editing a Grant records its choice and notes without switching it to a Selection', async () => {
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterSheetGrants({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(
      await result.current.edit(row, {
        choice: 'strength',
        notes: 'Table choice',
        active: false,
      }),
    ).toBe(true),
  );
  expect(writes.grant).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
    state: { choice: 'strength', notes: 'Table choice', active: false },
  });
  expect(writes.selection).not.toHaveBeenCalled();
});

test.each([
  {
    error: new ConvexError('Character is read only'),
    message:
      "Armor Training 1 wasn't saved: Character is read only. Try again.",
  },
  {
    error: new Error('Connection lost'),
    message:
      'Armor Training 1 may not have been saved. Check it before trying again.',
  },
])(
  'a failed control keeps the entry available for retry ($message)',
  async ({ error, message }) => {
    writes.kept.mockRejectedValueOnce(error);
    const snapshot = buildSheet();
    const { result } = renderHook(() =>
      useCharacterSheetGrants(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    );
    await act(async () =>
      expect(await result.current.setKept(row, true)).toBe(false),
    );
    expect(result.current.statusFor(row.rowId)).toEqual({
      kind: 'error',
      message,
    });
    await act(async () =>
      expect(await result.current.setKept(row, true)).toBe(true),
    );
    expect(result.current.statusFor(row.rowId)).toEqual({ kind: 'saved' });
  },
);

test('Unkeep and Discard use a dormant Selection’s row identity', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'selection', name: 'Armor Training 1', modifiers: [] }],
  });
  const selection: GrantEntryView = {
    ...row,
    target: { entryId: 'selection' },
    rowId: 'selection',
    origin: 'selection',
    recorded: true,
    canDiscard: true,
  };
  const { result } = renderHook(() =>
    useCharacterSheetGrants({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    await result.current.setKept(selection, false);
    await result.current.discard(selection);
  });
  expect(writes.kept).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target: { entryId: 'selection' },
    kept: false,
  });
  expect(writes.discard).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target: { entryId: 'selection' },
  });
});

test('an unrelated catalog update does not announce a change to this sheet’s Grants', () => {
  const initial = buildSheet({
    levels: [{ id: 'first', hp: 10, classId: 'fighter' }],
  });
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetGrants({ characterId: initial.character._id }, snapshot),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: {
      ...initial,
      catalogEntries: initial.catalogEntries.map((catalog) =>
        catalog._id === 'rogue'
          ? { ...catalog, name: `${catalog.name} revised` }
          : catalog,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('remote source and catalog changes are announced, including a catalog update after a local save', async () => {
  const initial = buildSheet({
    levels: [{ id: 'first', hp: 10, classId: 'fighter' }],
  });
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetGrants({ characterId: initial.character._id }, snapshot),
    { initialProps: { snapshot: initial } },
  );
  await act(async () => {
    await view.result.current.setKept(row, true);
  });
  const ownOperationId = writes.kept.mock.calls[0]?.[0].operationId as string;
  const local = buildSheet({
    levels: [{ id: 'first', hp: 10, classId: 'rogue' }],
    lastOperationId: ownOperationId,
  });
  view.rerender({ snapshot: local });
  expect(view.result.current.hasRemoteChange).toBe(false);
  const changedCatalog = {
    ...local,
    catalogEntries: local.catalogEntries.map((catalog) => ({
      ...catalog,
      name: `${catalog.name} revised`,
    })),
  };
  view.rerender({ snapshot: changedCatalog });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: buildSheet({ levels: [], lastOperationId: 'other-player' }),
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('another player reordering a class feature raises the shared entry notice', () => {
  const sheet = buildSheet({
    adjustments: [{ id: 'feature', name: 'Combat talent', modifiers: [] }],
  });
  const initial = {
    ...sheet,
    entries: sheet.entries.map((entry) =>
      entry.kind === 'manual'
        ? {
            ...entry,
            kind: 'classFeature' as const,
            state: { kind: 'classFeature' as const },
            choiceOrder: 0,
          }
        : entry,
    ),
  };
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetGrants(
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
        entry.kind === 'classFeature' ? { ...entry, choiceOrder: 1 } : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});
