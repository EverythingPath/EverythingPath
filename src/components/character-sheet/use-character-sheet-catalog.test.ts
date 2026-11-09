import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import { useCharacterSheetCatalog } from './use-character-sheet-catalog';
import { usePersonalAdjustmentForm } from './use-personal-adjustment-form';
import { useCatalogDefinitionForm } from './use-catalog-definition-form';
import type { CatalogDefinition } from './sheet-catalog-context';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';

const remote = vi.hoisted(() => ({
  definitions: undefined as unknown,
  advisories: undefined as unknown,
  create: vi.fn(),
  edit: vi.fn(),
  save: vi.fn(),
  customize: vi.fn(),
  detach: vi.fn(),
  select: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) =>
    args === 'skip'
      ? undefined
      : getFunctionName(reference) === 'catalogCopies:list'
        ? remote.definitions
        : remote.advisories,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'catalogCopies:createOneOff': remote.create,
      'catalogCopies:editDefinition': remote.edit,
      'catalogCopies:saveToCatalog': remote.save,
      'catalogCopies:customizeForCampaign': remote.customize,
      'catalogCopies:detach': remote.detach,
      'characterSheet:selectEntry': remote.select,
    })[getFunctionName(reference)],
}));
beforeEach(() => {
  remote.definitions = [];
  remote.advisories = [];
  for (const write of [
    remote.create,
    remote.edit,
    remote.save,
    remote.customize,
    remote.detach,
    remote.select,
  ])
    write.mockReset().mockResolvedValue(null);
});

test('definition controls and copy advisories come from the same complete sheet release', () => {
  const initial = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Blessing', modifiers: [] }],
  });
  const definition = initial.catalogEntries.find(
    (entry) => entry.name === 'Blessing',
  );
  if (!definition) throw new Error('Missing definition');
  const snapshot = {
    ...initial,
    catalogView: {
      releaseNumber: 1,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      definitions: [definition],
      advisories: [
        {
          catalogEntryId: definition._id,
          originalId: definition._id,
          originalName: 'Original blessing',
        },
      ],
    },
  };
  remote.definitions = [{ ...definition, name: 'New release blessing' }];
  remote.advisories = [];
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  expect(view.result.current.definitions?.[0]?.name).toBe('Blessing');
  expect(view.result.current.advisories?.[0]?.originalName).toBe(
    'Original blessing',
  );
});

test('catalog definition edits preserve racial ability placeholders and unedited spellcasting conditions', async () => {
  const snapshot = buildSheet({ race: { key: 'human' } });
  const original = snapshot.catalogEntries.find(
    (entry) => entry._id === 'human-ability',
  );
  if (!original) throw new Error('Missing racial ability');
  const definition = {
    ...original,
    detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    modifiers: [
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 1,
        condition: { school: 'evocation', castingClass: 'wizard' },
      },
    ],
  } satisfies CatalogDefinition;
  remote.definitions = [definition];
  const view = renderHook(() => {
    const catalog = useCharacterSheetCatalog(
      { characterId: snapshot.character._id },
      snapshot,
    );
    return useCatalogDefinitionForm({
      definition,
      save: (input) => catalog.editForForm(definition._id, input),
    });
  });
  expect(view.result.current.form.getValues('modifiers')).toHaveLength(1);
  act(() => {
    view.result.current.form.setValue('name', 'Campaign ability', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('modifiers.0.value', '3', {
      shouldDirty: true,
    });
  });
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(remote.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    catalogEntryId: definition._id,
    name: 'Campaign ability',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 3,
        condition: { school: 'evocation', castingClass: 'wizard' },
      },
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
    ],
  });
});

test('definition editing uses persisted catalog fields when the sheet projects campaign references', () => {
  const initial = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Blessing', modifiers: [] }],
  });
  const raw = initial.catalogEntries.find((entry) => entry.name === 'Blessing');
  if (!raw) throw new Error('Missing definition');
  const stored = initial.entries.find((entry) => entry.kind === 'manual');
  if (!stored) throw new Error('Missing entry');
  const projected = { ...raw, name: 'Projected for calculation' };
  remote.definitions = [raw];
  const snapshot = {
    ...initial,
    catalogEntries: initial.catalogEntries.map((entry) =>
      entry._id === raw._id ? projected : entry,
    ),
  };
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  expect(
    view.result.current.getDefinitionForTarget({
      kind: 'entry',
      entryId: stored._id,
    }),
  ).toEqual(raw);
});

test('definition edits wait for raw catalog fields instead of writing projected sheet references', async () => {
  const initial = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Blessing', modifiers: [] }],
  });
  const definition = initial.catalogEntries.find(
    (entry) => entry.name === 'Blessing',
  );
  const stored = initial.entries.find((entry) => entry.kind === 'manual');
  if (!definition || !stored) throw new Error('Missing adjustment');
  const modifier = {
    target: 'save.will' as const,
    bonusType: 'morale' as const,
    value: 2,
    condition: { whileActive: definition._id },
  };
  const raw = {
    ...definition,
    detail: { kind: 'manual' as const },
    modifiers: [modifier],
  };
  const projected = {
    ...raw,
    modifiers: [
      {
        ...modifier,
        condition: { whileActive: initial.baseScoresEntry._id },
      },
    ],
  };
  const snapshot = {
    ...initial,
    catalogEntries: initial.catalogEntries.map((entry) =>
      entry._id === raw._id ? projected : entry,
    ),
  };
  remote.definitions = undefined;
  const view = renderHook(() => {
    const catalog = useCharacterSheetCatalog(
      { characterId: snapshot.character._id },
      snapshot,
    );
    const current = catalog.getDefinitionForTarget({
      kind: 'entry',
      entryId: stored._id,
    });
    return {
      catalog,
      editor: useCatalogDefinitionForm({
        definition: current,
        save: (input) => catalog.editForForm(raw._id, input),
      }),
    };
  });
  for (const unavailable of [undefined, []]) {
    remote.definitions = unavailable;
    view.rerender();
    expect(view.result.current.catalog.capabilitiesFor(raw._id).canEdit).toBe(
      false,
    );
    expect(() =>
      view.result.current.catalog.editForForm(raw._id, {
        name: 'Attempted edit',
      }),
    ).toThrow('not available for editing');
    expect(remote.edit).not.toHaveBeenCalled();
  }
  remote.definitions = [raw];
  view.rerender();
  expect(view.result.current.catalog.capabilitiesFor(raw._id).canEdit).toBe(
    true,
  );
  act(() =>
    view.result.current.editor.form.setValue('name', 'Campaign blessing', {
      shouldDirty: true,
    }),
  );
  await act(async () =>
    expect(await view.result.current.editor.save()).toBe('saved'),
  );
  expect(remote.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    catalogEntryId: raw._id,
    name: 'Campaign blessing',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 2,
        condition: { whileActive: raw._id },
      },
    ],
  });
});

test('a customized definition form omits the curated stacking exception from its edit request', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Blessing', modifiers: [] }],
  });
  const original = snapshot.catalogEntries.find(
    (entry) => entry.name === 'Blessing',
  );
  if (!original) throw new Error('Missing definition');
  const definition = {
    ...original,
    scope: 'campaign' as const,
    campaignId: snapshot.character.campaignId,
    characterId: undefined,
    copiedFrom: original._id,
    campaignPreference: true as const,
    modifiers: [
      {
        target: 'save.will' as const,
        bonusType: 'morale' as const,
        value: 2,
        stacksWithinEntry: true as const,
      },
    ],
  };
  remote.definitions = [definition];
  const view = renderHook(() => {
    const catalog = useCharacterSheetCatalog(
      { characterId: snapshot.character._id },
      snapshot,
    );
    return usePersonalAdjustmentForm({
      adjustment: definition,
      save: (input) => catalog.editForForm(definition._id, input),
    });
  });
  act(() =>
    view.result.current.form.setValue('name', 'Campaign blessing', {
      shouldDirty: true,
    }),
  );
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(remote.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    catalogEntryId: definition._id,
    name: 'Campaign blessing',
    modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
  });
});

test('catalog selection adds accessible global, campaign and Character definitions with local acknowledgement', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'local', name: 'Battle blessing', modifiers: [] }],
  });
  const local = snapshot.catalogEntries.find(
    (row) => row.name === 'Battle blessing',
  );
  if (!local) throw new Error('Missing definition');
  const global = {
    ...local,
    _id: 'global' as typeof local._id,
    scope: 'global' as const,
  };
  const campaign = {
    ...local,
    _id: 'campaign' as typeof local._id,
    scope: 'campaign' as const,
  };
  remote.definitions = [global, campaign, local];
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  for (const definition of [global, campaign, local]) {
    remote.select.mockResolvedValueOnce(`selected-${definition._id}`);
    await act(async () => {
      expect(
        await view.result.current.select({
          catalogEntryId: definition._id,
          choice: 'Shield',
          notes: 'Kept at the table',
          active: false,
        }),
      ).toBe(true);
    });
    expect(remote.select).toHaveBeenLastCalledWith({
      characterId: snapshot.character._id,
      operationId: expect.any(String),
      catalogEntryId: definition._id,
      choice: 'Shield',
      notes: 'Kept at the table',
      active: false,
    });
    expect(
      view.result.current.statusFor(
        view.result.current.selectionKey(definition._id),
      ),
    ).toEqual({ kind: 'saved' });
    expect(view.result.current.createdEntryId).toBe(
      `selected-${definition._id}`,
    );
  }
});

test('catalog selection excludes nonselectable definitions and keeps a refused choice available for retry', async () => {
  const snapshot = buildSheet({
    levels: [{ id: 'fighter-level', hp: 10, classId: 'fighter' }],
    adjustments: [{ id: 'local', name: 'Battle blessing', modifiers: [] }],
  });
  remote.definitions = snapshot.catalogEntries;
  const local = snapshot.catalogEntries.find(
    (row) => row.name === 'Battle blessing',
  );
  const fighter = snapshot.catalogEntries.find(
    (row) => row.detail.kind === 'class',
  );
  if (!local || !fighter) throw new Error('Missing definitions');
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  expect(view.result.current.capabilitiesFor(fighter._id).canSelect).toBe(
    false,
  );
  expect(view.result.current.capabilitiesFor(local._id).canSelect).toBe(true);
  await act(async () =>
    expect(
      await view.result.current.select({ catalogEntryId: fighter._id }),
    ).toBe(false),
  );
  expect(remote.select).not.toHaveBeenCalled();
  remote.select.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  await act(async () =>
    expect(
      await view.result.current.select({ catalogEntryId: local._id }),
    ).toBe(false),
  );
  expect(
    view.result.current.statusFor(view.result.current.selectionKey(local._id)),
  ).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('read only'),
  });
  expect(view.result.current.createdEntryId).toBeNull();
  remote.select.mockResolvedValueOnce('retried-selection');
  await act(async () =>
    expect(
      await view.result.current.select({ catalogEntryId: local._id }),
    ).toBe(true),
  );
  expect(view.result.current.createdEntryId).toBe('retried-selection');
});

test('repeated catalog selections wait for the pending choice to save once', async () => {
  let finish: ((id: string) => void) | undefined;
  remote.select.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const snapshot = buildSheet({
    adjustments: [{ id: 'local', name: 'Battle blessing', modifiers: [] }],
  });
  const definition = snapshot.catalogEntries.find(
    (row) => row.name === 'Battle blessing',
  );
  if (!definition) throw new Error('Missing definition');
  remote.definitions = [definition];
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  const input = { catalogEntryId: definition._id };
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = view.result.current.select(input);
  });
  expect(
    view.result.current.statusFor(
      view.result.current.selectionKey(definition._id),
    ),
  ).toEqual({ kind: 'saving' });
  await act(async () =>
    expect(await view.result.current.select(input)).toBe(false),
  );
  expect(remote.select).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish?.('selected-entry');
    expect(await pending).toBe(true);
  });
  expect(view.result.current.createdEntryId).toBe('selected-entry');
});

test.each([null, undefined])(
  'a missing snapshot (%s) keeps catalog controls unavailable',
  (snapshot) => {
    const view = renderHook(() =>
      useCharacterSheetCatalog({ characterId: 'character-1' }, snapshot),
    );
    expect(view.result.current.available).toBe(false);
    expect(view.result.current.definitions).toBeUndefined();
    expect(view.result.current.advisories).toBeUndefined();
    expect(
      view.result.current.capabilitiesFor(
        'unknown' as Parameters<typeof view.result.current.capabilitiesFor>[0],
      ),
    ).toEqual({
      canSelect: false,
      canEdit: false,
      canSaveToCatalog: false,
      canCustomizeForCampaign: false,
      canDetach: false,
    });
  },
);

test('global definitions stay read-only, and campaign actions require a campaign', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'custom', name: 'Battle blessing', modifiers: [] }],
  });
  const local = snapshot.catalogEntries.find(
    (entry) => entry.name === 'Battle blessing',
  );
  if (!local) throw new Error('Missing definition');
  const global = {
    ...local,
    _id: 'global-blessing' as typeof local._id,
    scope: 'global' as const,
  };
  remote.definitions = [global];
  const view = renderHook(
    ({ sheet }) =>
      useCharacterSheetCatalog({ characterId: snapshot.character._id }, sheet),
    { initialProps: { sheet: snapshot } },
  );
  expect(view.result.current.capabilitiesFor(global._id)).toEqual({
    canSelect: true,
    canEdit: false,
    canSaveToCatalog: false,
    canCustomizeForCampaign: true,
    canDetach: true,
  });
  expect(view.result.current.capabilitiesFor(local._id)).toEqual({
    canSelect: false,
    canEdit: false,
    canSaveToCatalog: true,
    canCustomizeForCampaign: false,
    canDetach: false,
  });
  await act(async () =>
    expect(
      await view.result.current.edit(global._id, { name: 'Attempted change' }),
    ).toBe(false),
  );
  expect(remote.edit).not.toHaveBeenCalled();
  expect(view.result.current.statusFor(global._id)).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('read-only'),
  });
  view.rerender({
    sheet: {
      ...snapshot,
      character: { ...snapshot.character, campaignId: undefined },
    },
  });
  expect(view.result.current.capabilitiesFor(local._id).canSaveToCatalog).toBe(
    false,
  );
  expect(
    view.result.current.capabilitiesFor(global._id).canCustomizeForCampaign,
  ).toBe(false);
  await act(async () =>
    expect(await view.result.current.saveToCatalog(local._id)).toBe(false),
  );
  expect(remote.save).not.toHaveBeenCalled();
  expect(view.result.current.statusFor(local._id)).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('campaign'),
  });
});

test('one-off creation acknowledges saving and returns the created sheet entry for focus', async () => {
  let finish: ((id: string) => void) | undefined;
  remote.create.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.create({
      definition: {
        name: 'Battle blessing',
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail: { kind: 'manual' },
      },
    });
  });
  expect(view.result.current.statusFor('create')).toEqual({ kind: 'saving' });
  expect(remote.create).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    definition: {
      name: 'Battle blessing',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    },
  });
  await act(async () => {
    finish?.('entry-created');
    expect(await save).toBe(true);
  });
  expect(view.result.current.statusFor('create')).toEqual({ kind: 'saved' });
  expect(view.result.current.createdEntryId).toBe('entry-created');
  act(() => view.result.current.acknowledgeCreate());
  expect(view.result.current.createdEntryId).toBeNull();
});

test.each([
  {
    error: new ConvexError('Character is read only'),
    message: "Battle blessing wasn't saved: Character is read only. Try again.",
  },
  {
    error: new Error('Connection lost'),
    message:
      'Battle blessing may not have been saved. Check it before trying again.',
  },
])(
  'failed catalog edits keep their row available for retry ($message)',
  async ({ error, message }) => {
    remote.edit.mockRejectedValueOnce(error);
    const snapshot = buildSheet({
      adjustments: [{ id: 'blessing', name: 'Battle blessing', modifiers: [] }],
    });
    const definition = snapshot.catalogEntries.find(
      (entry) => entry.name === 'Battle blessing',
    );
    if (!definition) throw new Error('Missing definition');
    remote.definitions = [definition];
    const view = renderHook(() =>
      useCharacterSheetCatalog(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    );
    await act(async () =>
      expect(
        await view.result.current.edit(definition._id, {
          name: 'Revised blessing',
        }),
      ).toBe(false),
    );
    expect(view.result.current.statusFor(definition._id)).toEqual({
      kind: 'error',
      message,
    });
    expect(view.result.current.capabilitiesFor(definition._id).canEdit).toBe(
      true,
    );
    await act(async () =>
      expect(
        await view.result.current.edit(definition._id, {
          name: 'Revised blessing',
        }),
      ).toBe(true),
    );
    expect(view.result.current.statusFor(definition._id)).toEqual({
      kind: 'saved',
    });
  },
);

test('Detach addresses an unstored Grant without changing the Grant Key', async () => {
  const initial = buildSheet({
    adjustments: [{ id: 'armor', name: 'Armor Training 1', modifiers: [] }],
  });
  const target = {
    kind: 'grant' as const,
    grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
  };
  const entry = initial.entries.find((row) => row.kind === 'manual');
  if (!entry) throw new Error('Missing entry');
  const snapshot = {
    ...initial,
    entries: initial.entries.filter((row) => row._id !== entry._id),
    catalogEntries: initial.catalogEntries.map((row) =>
      row._id === entry.catalogEntryId
        ? { ...row, scope: 'global' as const }
        : row,
    ),
    calculated: {
      ...initial.calculated,
      resolvedEntries: [
        {
          entry: {
            ...entry,
            grantKey: target.grantKey,
            origin: 'grant' as const,
          },
          origin: 'grant' as const,
          recorded: false,
          dormant: false,
          counting: true,
        },
      ],
    },
  };
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(await view.result.current.detach(target)).toBe(true),
  );
  expect(remote.detach).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target,
  });
  expect(
    view.result.current.statusFor(view.result.current.targetKey(target)),
  ).toEqual({ kind: 'saved' });
});

test('Class Level targets expose their shared definition for Customize and Detach', async () => {
  const initial = buildSheet({
    levels: [{ id: 'fighter-level', hp: 10, classId: 'fighter' }],
  });
  const level = initial.entries.find((row) => row.kind === 'classLevel');
  const fighter = initial.catalogEntries.find(
    (row) => row._id === level?.state.classEntryId,
  );
  if (!level || !fighter) throw new Error('Missing Class Level');
  const global = { ...fighter, scope: 'global' as const };
  const snapshot = {
    ...initial,
    catalogEntries: initial.catalogEntries.map((row) =>
      row._id === fighter._id ? global : row,
    ),
  };
  const target = { kind: 'entry' as const, entryId: level._id };
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  expect(view.result.current.getDefinitionForTarget(target)).toEqual(global);
  expect(view.result.current.capabilitiesFor(global._id)).toMatchObject({
    canCustomizeForCampaign: true,
    canDetach: true,
    canEdit: false,
  });
  await act(async () => {
    expect(await view.result.current.customizeForCampaign(global._id)).toBe(
      true,
    );
    expect(await view.result.current.detach(target)).toBe(true);
  });
  expect(remote.detach).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target,
  });
});

test('Save to catalog, Customize for campaign and Detach refuse inapplicable scopes', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'local', name: 'Battle blessing', modifiers: [] }],
  });
  const local = snapshot.catalogEntries.find(
    (row) => row.name === 'Battle blessing',
  );
  const entry = snapshot.entries.find((row) => row.kind === 'manual');
  if (!local || !entry) throw new Error('Missing entry');
  const campaign = {
    ...local,
    _id: 'campaign-definition' as typeof local._id,
    scope: 'campaign' as const,
  };
  remote.definitions = [campaign];
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(await view.result.current.saveToCatalog(campaign._id)).toBe(false);
    expect(await view.result.current.customizeForCampaign(local._id)).toBe(
      false,
    );
    expect(
      await view.result.current.detach({ kind: 'entry', entryId: entry._id }),
    ).toBe(false);
  });
  expect(remote.save).not.toHaveBeenCalled();
  expect(remote.customize).not.toHaveBeenCalled();
  expect(remote.detach).not.toHaveBeenCalled();
});

test('picker loading and access-safe change advisories follow the live query without exposing unavailable originals', () => {
  const snapshot = buildSheet();
  remote.definitions = undefined;
  remote.advisories = undefined;
  const view = renderHook(() =>
    useCharacterSheetCatalog({ characterId: snapshot.character._id }, snapshot),
  );
  expect(view.result.current.definitions).toBeUndefined();
  expect(view.result.current.advisories).toBeUndefined();
  remote.definitions = snapshot.catalogEntries;
  remote.advisories = [
    {
      catalogEntryId: 'copied-blessing',
      originalId: 'global-blessing',
      originalName: 'Battle blessing',
    },
  ];
  view.rerender();
  expect(view.result.current.definitions).toEqual(snapshot.catalogEntries);
  expect(view.result.current.advisories).toEqual(remote.advisories);
  remote.advisories = [];
  view.rerender();
  expect(view.result.current.advisories).toEqual([]);
});

test('own catalog saves are acknowledged while later remote definition changes are announced', async () => {
  const initial = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Battle blessing', modifiers: [] }],
  });
  const definition = initial.catalogEntries.find(
    (entry) => entry.name === 'Battle blessing',
  );
  if (!definition) throw new Error('Missing definition');
  remote.definitions = [definition];
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetCatalog(
        { characterId: initial.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  await act(async () => {
    await view.result.current.edit(definition._id, {
      name: 'Revised blessing',
    });
  });
  const local = {
    ...initial,
    lastOperationId: remote.edit.mock.calls[0]?.[0].operationId as string,
    catalogEntries: initial.catalogEntries.map((entry) =>
      entry._id === definition._id
        ? { ...entry, name: 'Revised blessing' }
        : entry,
    ),
  };
  view.rerender({ snapshot: local });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: {
      ...local,
      catalogEntries: local.catalogEntries.map((entry) =>
        entry._id === definition._id
          ? { ...entry, name: 'Another player’s blessing' }
          : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('definition forms block empty names and malformed modifiers, then retain a refused draft for retry', async () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'blessing', name: 'Battle blessing', modifiers: [] }],
  });
  const definition = snapshot.catalogEntries.find(
    (entry) => entry.name === 'Battle blessing',
  );
  if (!definition) throw new Error('Missing definition');
  remote.definitions = [definition];
  const view = renderHook(() => {
    const catalog = useCharacterSheetCatalog(
      { characterId: snapshot.character._id },
      snapshot,
    );
    return useCatalogDefinitionForm({
      definition,
      save: (input) => catalog.editForForm(definition._id, input),
    });
  });
  act(() => {
    view.result.current.form.setValue('name', '');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Adjustment name is required',
  );
  act(() => {
    view.result.current.form.setValue('name', 'Revised blessing');
    view.result.current.addModifier();
    view.result.current.form.setValue('modifiers.0.value', 'many');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(
    view.result.current.form.formState.errors.modifiers?.[0]?.value?.message,
  ).toBe('Modifier value must be a number');
  expect(remote.edit).not.toHaveBeenCalled();
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '2', {
      shouldDirty: true,
    }),
  );
  remote.edit.mockRejectedValueOnce(new ConvexError('Character is read only'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('Character is read only'),
  });
  expect(view.result.current.form.getValues('name')).toBe('Revised blessing');
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe('2');
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test.each(['grant', 'entry'] as const)(
  'Detach uses the effective shared Grant definition for a %s target',
  async (kind) => {
    const initial = buildSheet({
      adjustments: [
        { id: 'stale', name: 'Old private definition', modifiers: [] },
      ],
    });
    const entry = initial.entries.find((row) => row.kind === 'manual');
    const local = initial.catalogEntries.find(
      (row) => row.name === 'Old private definition',
    );
    if (!entry || !local) throw new Error('Missing stored Grant');
    const grantKey = { source: 'fighter', classLevel: 1, entry: 'armor' };
    const effective = {
      ...local,
      _id: 'effective-global' as typeof local._id,
      scope: 'global' as const,
    };
    const stored = { ...entry, grantKey };
    const snapshot = {
      ...initial,
      entries: initial.entries.map((row) =>
        row._id === entry._id ? stored : row,
      ),
      catalogEntries: [...initial.catalogEntries, effective],
      calculated: {
        ...initial.calculated,
        resolvedEntries: [
          {
            entry: { ...stored, catalogEntryId: effective._id },
            storedEntryId: entry._id,
            origin: 'grant' as const,
            recorded: true,
            dormant: false,
            counting: true,
          },
        ],
      },
    };
    const target =
      kind === 'grant' ? { kind, grantKey } : { kind, entryId: entry._id };
    const view = renderHook(() =>
      useCharacterSheetCatalog(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    );
    await act(async () =>
      expect(await view.result.current.detach(target)).toBe(true),
    );
    expect(remote.detach).toHaveBeenCalledWith({
      characterId: snapshot.character._id,
      operationId: expect.any(String),
      target,
    });
  },
);
