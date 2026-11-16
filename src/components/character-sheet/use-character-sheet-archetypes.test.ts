import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  buildSheet,
  isClassCatalogEntry,
} from './character-sheet-test-fixture';
import { buildCastingSheet } from './casting-features-test-fixture';
import {
  castingStatusKey,
  useCharacterSheetArchetypes,
} from './use-character-sheet-archetypes';

const writes = vi.hoisted(() => ({
  selected: vi.fn(),
  replacements: vi.fn(),
  edit: vi.fn(),
  casting: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:setArchetypeSelected': writes.selected,
      'characterSheet:setArchetypePartChoices': writes.replacements,
      'characterSheet:editSelection': writes.edit,
      'characterSheet:chooseArchetypeCasting': writes.casting,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

test('archetype choices acknowledge their own saves and preserve failures for retry', async () => {
  const snapshot = buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  });
  const baseClass = snapshot.catalogEntries.find(isClassCatalogEntry);
  const baseEntry = snapshot.entries[0];
  if (!baseClass || !baseEntry) throw new Error('Missing fixture');
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  writes.selected.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  await act(async () => {
    expect(
      await result.current.setSelected({
        classEntryId: baseClass._id,
        catalogEntryId: baseClass._id,
        selected: true,
      }),
    ).toBe(false);
  });
  expect(result.current.statusFor(baseClass._id)).toEqual({
    kind: 'error',
    message: "Archetype wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(
      await result.current.setSelected({
        classEntryId: baseClass._id,
        catalogEntryId: baseClass._id,
        selected: false,
      }),
    ).toBe(true);
    expect(await result.current.setPartChoices(baseEntry._id, null)).toBe(true);
  });
  expect(writes.selected).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    classEntryId: baseClass._id,
    catalogEntryId: baseClass._id,
    selected: false,
  });
  expect(writes.replacements).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: baseEntry._id,
    replacementChoices: null,
  });
  expect(result.current.statusFor(baseClass._id)).toEqual({ kind: 'saved' });
});

test('another player’s class change announces changed archetype availability while base-score edits do not', () => {
  const initial = buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  });
  const baseClass = initial.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.name === 'Rogue',
  );
  if (!baseClass) throw new Error('Missing class');
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetArchetypes(
        { characterId: initial.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: buildSheet({
      levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
      scores: {
        strength: 14,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      lastOperationId: 'base-edit',
    }),
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'class-edit',
      entries: initial.entries.map((entry) =>
        entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, classEntryId: baseClass._id } }
          : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('each class exposes its compatible cards and only the selected Catalog Copy is marked selected', () => {
  const initial = buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    adjustments: [{ id: 'selection', name: 'Placeholder', modifiers: [] }],
    hasRaces: true,
    extraCatalog: [
      {
        _id: 'archer',
        name: 'Archer',
        ruleIdentity: 'archer',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [],
          adds: [],
        },
      },
      {
        _id: 'archer-copy',
        name: 'Archer Copy',
        ruleIdentity: 'archer',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [],
          adds: [],
        },
      },
      {
        _id: 'scout',
        name: 'Scout',
        ruleIdentity: 'scout',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['rogue'],
          replaces: [],
          adds: [],
        },
      },
    ],
  });
  const copy = initial.catalogEntries.find(
    (entry) => entry.name === 'Archer Copy',
  );
  if (!copy) throw new Error('Missing copy');
  const snapshot = {
    ...initial,
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual'
        ? {
            ...entry,
            kind: 'archetype' as const,
            catalogEntryId: copy._id,
            state: { kind: 'archetype' as const },
          }
        : entry,
    ),
  };
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  expect(result.current.classes.map((entry) => entry.name)).toEqual([
    'Fighter',
  ]);
  expect(
    result.current.classes[0]?.options.map((option) => [
      option.definition.name,
      option.selected,
    ]),
  ).toEqual([
    ['Archer', false],
    ['Archer Copy', true],
  ]);
  expect(result.current.classes[0]?.options[0]?.selection?._id).toBe(
    result.current.classes[0]?.options[1]?.selection?._id,
  );
});

test('browser Archetypes remain selectable while referenced copies and calculated effects come from the sheet', () => {
  const initial = buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    adjustments: [{ id: 'selection', name: 'Placeholder', modifiers: [] }],
    hasRaces: true,
    extraCatalog: [
      {
        _id: 'archer',
        name: 'Archer',
        ruleIdentity: 'archer',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [],
          adds: [],
        },
      },
      {
        _id: 'archer-copy',
        name: 'Archer Copy',
        ruleIdentity: 'archer',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [],
          adds: [],
        },
      },
    ],
  });
  const archer = initial.catalogEntries.find(
    (entry) => entry.name === 'Archer',
  );
  const copy = initial.catalogEntries.find(
    (entry) => entry.name === 'Archer Copy',
  );
  if (!archer || !copy) throw new Error('Missing fixture');
  const snapshot = {
    ...initial,
    catalogEntries: initial.catalogEntries.filter(
      (entry) => entry._id !== archer._id,
    ),
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual'
        ? {
            ...entry,
            kind: 'archetype' as const,
            catalogEntryId: copy._id,
            state: { kind: 'archetype' as const },
          }
        : entry,
    ),
  };
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
      [archer, { ...copy, name: 'Stale browser name' }],
    ),
  );
  expect(
    result.current.classes[0]?.options.map((option) => [
      option.definition.name,
      option.selected,
    ]),
  ).toEqual([
    ['Archer', false],
    ['Archer Copy', true],
  ]);
  expect(
    result.current.classes[0]?.options.every(
      (option) => option.application === undefined,
    ),
  ).toBe(true);
  expect(
    snapshot.catalogEntries.some((entry) => entry._id === archer._id),
  ).toBe(false);
});

test('replacement failures use plural copy and Selection notes and choices are editable with retry feedback', async () => {
  const snapshot = buildSheet();
  const entry = snapshot.entries[0];
  if (!entry) throw new Error('Missing fixture');
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  writes.replacements.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  await act(async () => {
    expect(await result.current.setPartChoices(entry._id, [])).toBe(false);
  });
  expect(result.current.statusFor(entry._id)).toEqual({
    kind: 'error',
    message:
      "Replacement choices weren't saved: Character is read only. Try again.",
  });
  writes.edit.mockRejectedValueOnce(new ConvexError('Character is read only'));
  await act(async () => {
    expect(
      await result.current.editSelection({
        entryId: entry._id,
        notes: 'Retained',
        choice: 'Longbow',
      }),
    ).toBe(false);
  });
  expect(result.current.statusFor(entry._id)).toEqual({
    kind: 'error',
    message: "Archetype wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(
      await result.current.editSelection({
        entryId: entry._id,
        notes: 'Retained',
        choice: null,
      }),
    ).toBe(true);
  });
  expect(writes.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    entryId: entry._id,
    notes: 'Retained',
    choice: null,
    operationId: expect.any(String),
  });
  expect(result.current.statusFor(entry._id)).toEqual({ kind: 'saved' });
});

test('an Archetype bound to a different class remains retained instead of appearing selected on its usual class card', () => {
  const initial = buildSheet({
    hasRaces: true,
    levels: [
      { id: 'fighter-level', hp: 10, classId: 'fighter' },
      { id: 'rogue-level', hp: 8, classId: 'rogue' },
    ],
    adjustments: [{ id: 'selection', name: 'Placeholder', modifiers: [] }],
    extraCatalog: [
      {
        _id: 'archer',
        name: 'Archer',
        ruleIdentity: 'archer',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [],
          adds: [],
        },
      },
    ],
  });
  const archer = initial.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'archer',
  );
  const rogue = initial.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'rogue',
  );
  if (!archer || !rogue) throw new Error('Missing fixture');
  const snapshot = {
    ...initial,
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual'
        ? {
            ...entry,
            kind: 'archetype' as const,
            catalogEntryId: archer._id,
            state: { kind: 'archetype' as const, classEntryId: rogue._id },
          }
        : entry,
    ),
  };
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const option = result.current.classes.find(
    (group) => group.name === 'Fighter',
  )?.options[0];
  expect(option?.selected).toBe(false);
  expect(option?.selection).toBeUndefined();
  expect(result.current.selections).toHaveLength(1);
  expect(result.current.selections[0]).toMatchObject({
    state: { classEntryId: rogue._id },
  });
});

test.each(['Catalog Copy', 'Unchained counterpart'])(
  'an Archetype binding follows the same class family through a %s',
  (variant) => {
    const baseline = buildSheet({
      levels: [{ id: 'rogue-level', hp: 8, classId: 'rogue' }],
    });
    const rogue = baseline.catalogEntries.find(
      (entry) => isClassCatalogEntry(entry) && entry.name === 'Rogue',
    );
    if (!rogue || !isClassCatalogEntry(rogue)) throw new Error('Missing Rogue');
    const initial = buildSheet({
      hasRaces: true,
      levels: [{ id: 'rogue-level', hp: 8, classId: 'rogue' }],
      adjustments: [{ id: 'selection', name: 'Placeholder', modifiers: [] }],
      extraCatalog: [
        {
          ...rogue,
          _id: 'bound-class',
          name: variant,
          ruleIdentity:
            variant === 'Catalog Copy' ? rogue.ruleIdentity : 'rogue-uc',
          detail: {
            ...rogue.detail,
            counterpartOf: variant === 'Catalog Copy' ? undefined : rogue._id,
          },
        },
        {
          _id: 'scout',
          name: 'Scout',
          ruleIdentity: 'scout',
          modifiers: [],
          detail: {
            kind: 'archetype',
            classEntryIds: [rogue._id],
            replaces: [],
            adds: [],
          },
        },
      ],
    });
    const scout = initial.catalogEntries.find(
      (entry) => entry.name === 'Scout',
    );
    const boundClass = initial.catalogEntries.find(
      (entry) => entry.name === variant,
    );
    if (!scout || !boundClass) throw new Error('Missing fixture');
    const snapshot = {
      ...initial,
      entries: initial.entries.map((entry) =>
        entry.kind === 'manual'
          ? {
              ...entry,
              kind: 'archetype' as const,
              catalogEntryId: scout._id,
              state: {
                kind: 'archetype' as const,
                classEntryId: boundClass._id,
              },
            }
          : entry,
      ),
    };
    const { result } = renderHook(() =>
      useCharacterSheetArchetypes(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    );
    const option = result.current.classes[0]?.options[0];
    expect(option?.selected).toBe(true);
    expect(option?.selection?._id).toBe(result.current.selections[0]?._id);
  },
);

test('notes and choice edits send only the changed field and acknowledge one pending save per Selection', async () => {
  const snapshot = buildSheet();
  const entry = snapshot.entries[0];
  if (!entry) throw new Error('Missing fixture');
  let finish: (() => void) | undefined;
  writes.edit.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = () => resolve(null);
    }),
  );
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = result.current.editSelection({
      entryId: entry._id,
      notes: 'Bow drills',
    });
  });
  expect(result.current.statusFor(entry._id)).toEqual({ kind: 'saving' });
  expect(result.current.statusFor('other')).toEqual({ kind: 'idle' });
  await act(async () => {
    expect(
      await result.current.editSelection({
        entryId: entry._id,
        choice: 'Longbow',
      }),
    ).toBe(false);
  });
  expect(writes.edit).toHaveBeenCalledTimes(1);
  expect(writes.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: entry._id,
    notes: 'Bow drills',
  });
  await act(async () => {
    finish?.();
    expect(await pending).toBe(true);
  });
  await act(async () => {
    expect(
      await result.current.editSelection({ entryId: entry._id, choice: null }),
    ).toBe(true);
  });
  expect(writes.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: entry._id,
    choice: null,
  });
  expect(result.current.statusFor(entry._id)).toEqual({ kind: 'saved' });
});

test('uncertain replacement saves use readable plural feedback', async () => {
  const snapshot = buildSheet();
  const entry = snapshot.entries[0];
  if (!entry) throw new Error('Missing fixture');
  writes.replacements.mockRejectedValueOnce(new Error('Connection lost'));
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await act(async () => {
    expect(await result.current.setPartChoices(entry._id, [])).toBe(false);
  });
  expect(result.current.statusFor(entry._id)).toEqual({
    kind: 'error',
    message:
      'Replacement choices may not have been saved. Check it before trying again.',
  });
});

// Two classes each wait for a casting choice: Skirmisher (APG p. 128)
// against Dandy (UI p. 41) on a ranger, Questioner (MTT p. 26) against
// Psychic Detective (OA p. 119) on an investigator. No published pair of
// classes conflicts on one property key, so scoping is shown across keys.
test('each class’s casting choice saves with its own class-scoped acknowledgement', async () => {
  const snapshot = buildCastingSheet({
    levels: [
      ...Array.from({ length: 8 }, () => 'ranger'),
      ...Array.from({ length: 7 }, () => 'investigator'),
    ],
    archetypes: [
      { key: 'ranger-skirmisher' },
      { key: 'ranger-dandy' },
      { key: 'investigator-questioner' },
      { key: 'investigator-psychic-detective' },
    ],
  });
  const { result } = renderHook(() =>
    useCharacterSheetArchetypes(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  expect(
    result.current.castings.map(({ classEntryId, properties }) => [
      classEntryId,
      properties
        .filter((property) => property.status === 'unresolved')
        .map((property) => property.key),
    ]),
  ).toEqual([
    ['ranger', ['presence']],
    ['investigator', ['spellKind', 'spellList']],
  ]);
  const skirmisher = snapshot.entries.find(
    (entry) =>
      entry.kind === 'archetype' &&
      entry.catalogEntryId === 'ranger-skirmisher',
  );
  const questioner = snapshot.entries.find(
    (entry) =>
      entry.kind === 'archetype' &&
      entry.catalogEntryId === 'investigator-questioner',
  );
  if (!skirmisher || !questioner) throw new Error('Missing Selections');
  writes.casting.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  await act(async () => {
    expect(
      await result.current.chooseCasting({
        classEntryId: 'ranger',
        entryId: skirmisher._id,
        property: 'presence',
      }),
    ).toBe(false);
  });
  expect(
    result.current.statusFor(castingStatusKey('ranger', 'presence')),
  ).toEqual({
    kind: 'error',
    message: "Casting choice wasn't saved: Character is read only. Try again.",
  });
  expect(
    result.current.statusFor(castingStatusKey('investigator', 'presence')),
  ).toEqual({ kind: 'idle' });
  await act(async () => {
    expect(
      await result.current.chooseCasting({
        classEntryId: 'investigator',
        entryId: questioner._id,
        property: 'spellList',
      }),
    ).toBe(true);
  });
  expect(writes.casting).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: questioner._id,
    property: 'spellList',
  });
  expect(
    result.current.statusFor(castingStatusKey('investigator', 'spellList')),
  ).toEqual({ kind: 'saved' });
  expect(
    result.current.statusFor(castingStatusKey('ranger', 'presence')),
  ).toMatchObject({ kind: 'error' });
});
