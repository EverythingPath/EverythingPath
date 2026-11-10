import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';

const server = vi.hoisted(() => ({
  relationships: [] as unknown[],
  candidates: [] as unknown[],
  write: vi.fn(),
  readOnly: false,
}));
vi.mock('convex/react', () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(reference);
    if (name === 'companionRelationships:list') return server.relationships;
    // Not a Synthesist: no Combined Form (#421).
    if (name === 'characterSheetCombinedForm:read') return null;
    if (name === 'companionRelationships:listAllocationPools') return [];
    if (name === 'character:listCampaignCharacters') return server.candidates;
    if (name === 'character:listOwned')
      return [{ kind: 'noCampaign', characters: server.candidates }];
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

const relationship = {
  relationshipId: 'relationship' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'owl' as Id<'character'>, name: 'Whisper' },
  sources: [
    { key: 'bond', label: 'Arcane Bond', enabled: true, available: true },
  ],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;

beforeEach(() => {
  server.relationships = [];
  server.candidates = [];
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('both roles retain inactive history and inaccessible endpoints have no navigation', () => {
  const snapshot = buildSheet();
  server.relationships = [
    relationship,
    {
      ...relationship,
      relationshipId: 'previous',
      role: 'associated',
      status: 'interrupted',
      interruption: 'access',
      endpoint: null,
      sources: [],
    },
  ];
  const { result } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  expect(result.current.rows).toMatchObject([
    {
      name: 'Whisper',
      href: '/characters/owl',
      roleLabel: 'Companion',
      kindLabel: 'Familiar',
      statusLabel: 'Active',
      canManage: true,
    },
    {
      name: 'Character unavailable',
      href: null,
      roleLabel: 'Associated Character',
      statusLabel: 'Interrupted',
      canManage: false,
      sources: [],
    },
  ]);
});

test('two sessions see move interruption and restoration while keeping an unsaved companion edit', () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  const first = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  const second = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  act(() => {
    first.result.current.openCreate();
    first.result.current.form.setValue('name', 'Unsaved Companion');
  });
  server.relationships = [
    {
      ...relationship,
      status: 'interrupted',
      interruption: 'access',
      endpoint: null,
      sources: [],
      lastOperationId: 'group-departure',
    },
  ];
  first.rerender();
  second.rerender();
  for (const session of [first, second]) {
    expect(session.result.current.rows?.[0]).toMatchObject({
      statusLabel: 'Interrupted',
      name: 'Character unavailable',
      href: null,
      explanation: 'This Character is not available to you.',
    });
    expect(session.result.current.hasRemoteChange).toBe(true);
  }
  expect(first.result.current.form.getValues('name')).toBe('Unsaved Companion');
  act(() => {
    first.result.current.dismissRemoteChange();
    second.result.current.dismissRemoteChange();
  });
  server.relationships = [{ ...relationship, lastOperationId: 'group-return' }];
  first.rerender();
  second.rerender();
  for (const session of [first, second]) {
    expect(session.result.current.rows?.[0]).toMatchObject({
      statusLabel: 'Active',
      name: 'Whisper',
      href: '/characters/owl',
      explanation: null,
    });
    expect(session.result.current.hasRemoteChange).toBe(true);
  }
  expect(first.result.current.form.getValues('name')).toBe('Unsaved Companion');
  expect(server.write).not.toHaveBeenCalled();
});

test('replaced history cannot open another replacement editor', () => {
  const snapshot = buildSheet();
  server.relationships = [{ ...relationship, status: 'replaced' }];
  const { result } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  const row = result.current.rows![0]!;
  expect(row.canReplace).toBe(false);
  act(() => result.current.openReplace(row));
  expect(result.current.editor).toBe(null);
});

test('a replacement editor refuses a relationship replaced by another player', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  server.candidates = [
    { character: { ...snapshot.character, _id: 'wolf', name: 'Ash' } },
  ];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  act(() => result.current.openReplace(result.current.rows![0]!));
  act(() => result.current.form.setValue('companionCharacterId', 'wolf'));
  server.relationships = [{ ...relationship, status: 'replaced' }];
  rerender();
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(server.write).not.toHaveBeenCalled();
  expect(result.current.editor?.kind).toBe('replace');
});

test('creating a Companion validates the name and source before saving and retains refused input', async () => {
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  act(() => result.current.openCreate());
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.form.formState.errors.name?.message).toBe(
    'Enter a name.',
  );
  expect(result.current.form.formState.errors.sourceLabel?.message).toBe(
    'Enter a supporting source.',
  );
  expect(server.write).not.toHaveBeenCalled();
  act(() => {
    result.current.form.setValue('name', ' Whisper ');
    result.current.form.setValue('kind', 'familiar');
    result.current.form.setValue('sourceLabel', ' Arcane Bond ');
  });
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.editor?.kind).toBe('create');
  expect(result.current.form.getValues('name')).toBe(' Whisper ');
  expect(result.current.statusFor('create')).toEqual({
    kind: 'error',
    message: 'Companion may not have been saved. Check it before trying again.',
  });
  server.write.mockResolvedValueOnce({
    relationshipId: 'new',
    companionCharacterId: 'owl',
  });
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:create',
    {
      associatedCharacterId: snapshot.character._id,
      name: 'Whisper',
      kind: 'familiar',
      sources: [
        { key: expect.any(String), label: 'Arcane Bond', enabled: true },
      ],
      operationId: expect.any(String),
    },
  );
  expect(result.current.editor).toBe(null);
  expect(result.current.createdCompanion?.href).toBe('/characters/owl');
});

test('link and replacement choose an accessible existing Character and never use a typed or stale ID', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  server.candidates = [
    { character: snapshot.character },
    { character: { ...snapshot.character, _id: 'wolf', name: 'Ash' } },
  ];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  act(() => result.current.openLink());
  expect(result.current.candidates).toEqual([
    { characterId: 'wolf', name: 'Ash' },
  ]);
  act(() => {
    result.current.form.setValue('companionCharacterId', 'hidden');
    result.current.form.setValue('sourceLabel', 'Animal Companion');
  });
  await act(async () => expect(await result.current.submit()).toBe(false));
  expect(result.current.fieldErrors.companionCharacterId?.message).toBe(
    'Choose an available Character.',
  );
  expect(server.write).not.toHaveBeenCalled();
  act(() => result.current.form.setValue('companionCharacterId', 'wolf'));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenCalledWith(
    'companionRelationships:link',
    expect.objectContaining({
      associatedCharacterId: snapshot.character._id,
      companionCharacterId: 'wolf',
    }),
  );
  act(() => result.current.openReplace(result.current.rows![0]!));
  act(() => result.current.form.setValue('companionCharacterId', 'wolf'));
  server.candidates = [];
  rerender();
  await act(async () => expect(await result.current.submit()).toBe(false));
  server.candidates = [
    { character: { ...snapshot.character, _id: 'wolf', name: 'Ash' } },
  ];
  rerender();
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:replace',
    expect.objectContaining({
      relationshipId: relationship.relationshipId,
      companionCharacterId: 'wolf',
    }),
  );
});

test('source contribution controls and interrupt/restore save on their relationship and block inaccessible rows', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  const row = result.current.rows![0]!;
  await act(async () =>
    expect(await result.current.setSourceEnabled(row, 'bond', false)).toBe(
      true,
    ),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:setSourceEnabled',
    expect.objectContaining({
      relationshipId: 'relationship',
      sourceKey: 'bond',
      enabled: false,
    }),
  );
  await act(async () => expect(await result.current.interrupt(row)).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:interrupt',
    expect.objectContaining({ relationshipId: 'relationship' }),
  );
  act(() => result.current.openAddSource(row));
  act(() => result.current.form.setValue('sourceLabel', 'Witch Familiar'));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:addSource',
    expect.objectContaining({
      relationshipId: 'relationship',
      source: {
        key: expect.any(String),
        label: 'Witch Familiar',
        enabled: true,
      },
    }),
  );
  server.relationships = [
    { ...relationship, status: 'interrupted', interruption: 'manual' },
  ];
  rerender();
  await act(async () =>
    expect(await result.current.restore(result.current.rows![0]!)).toBe(true),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:restore',
    expect.objectContaining({ relationshipId: 'relationship' }),
  );
  server.relationships = [
    { ...relationship, role: 'associated', endpoint: null, sources: [] },
  ];
  rerender();
  const previousCalls = server.write.mock.calls.length;
  await act(async () => {
    expect(await result.current.interrupt(row)).toBe(false);
    expect(await result.current.setSourceEnabled(row, 'bond', true)).toBe(
      false,
    );
  });
  expect(server.write.mock.calls).toHaveLength(previousCalls);
});

test('a supporting source can bind a real Class Level or Grant rather than a typed label', async () => {
  const snapshot = buildSheet({
    levels: [
      { id: 'fighter-level', classId: 'fighter', hp: 10 },
      { id: 'fighter-two', classId: 'fighter', hp: 6 },
      { id: 'fighter-three', classId: 'fighter', hp: 6 },
    ],
  });
  snapshot.calculated.resolvedEntries.push({
    entry: {
      _id: 'armor-grant',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'armor',
      state: { kind: 'classFeature' },
      grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
    },
    origin: 'grant',
    recorded: false,
    dormant: false,
    counting: true,
  });
  server.relationships = [relationship];
  const { result } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  act(() => result.current.openAddSource(result.current.rows![0]!));
  const level = result.current.sourceOptions.find(
    (option) => option.source.sheetEntryId === 'fighter-level',
  );
  expect(level?.label).toBe('Fighter · Class Level 1');
  act(() => result.current.selectSource(level!.key));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:addSource',
    expect.objectContaining({
      source: {
        key: expect.any(String),
        label: 'Fighter · Class Level 1',
        enabled: true,
        sheetEntryId: 'fighter-level',
      },
    }),
  );
  act(() => result.current.openAddSource(result.current.rows![0]!));
  const grant = result.current.sourceOptions.find(
    (option) => 'grantKey' in option.source,
  );
  expect(grant).toBeDefined();
  act(() => result.current.selectSource(grant!.key));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:addSource',
    expect.objectContaining({
      source: expect.objectContaining({ grantKey: grant!.source.grantKey }),
    }),
  );
});

test('own acknowledgements stay quiet while other players and later source availability changes are announced', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(
      await result.current.setSourceEnabled(
        result.current.rows![0]!,
        'bond',
        false,
      ),
    ).toBe(true),
  );
  const operationId = server.write.mock.calls[0]![1].operationId;
  server.relationships = [
    {
      ...relationship,
      lastOperationId: operationId,
      sources: [{ ...relationship.sources[0], enabled: false }],
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
  server.relationships = [
    {
      ...relationship,
      lastOperationId: operationId,
      sources: [
        { ...relationship.sources[0], enabled: false, available: false },
      ],
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  expect(result.current.hasRemoteChange).toBe(false);
  server.relationships = [
    { ...relationship, lastOperationId: 'other-player', status: 'replaced' },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
});

test('own interruption side effects stay quiet across every affected relationship', async () => {
  const snapshot = buildSheet();
  const pending = {
    ...relationship,
    relationshipId: 'pending' as Id<'companionRelationship'>,
    status: 'interrupted' as const,
    interruption: 'conflict' as const,
  };
  server.relationships = [relationship, pending];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(await result.current.interrupt(result.current.rows![0]!)).toBe(true),
  );
  const operationId = server.write.mock.calls[0]![1].operationId;
  server.relationships = [
    {
      ...relationship,
      status: 'interrupted',
      interruption: 'manual',
      lastOperationId: operationId,
    },
    {
      ...pending,
      status: 'active',
      interruption: null,
      lastOperationId: operationId,
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
  // Equivalent live read objects do not themselves announce a change.
  server.relationships = result.current.rows!.map((row) => ({
    ...row,
    endpoint: row.endpoint ? { ...row.endpoint } : null,
    sources: row.sources.map((source) => ({ ...source })),
  }));
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
});

test('an own supporting-source availability change stays quiet with its operation acknowledgement', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(
      await result.current.setSourceEnabled(
        result.current.rows![0]!,
        'bond',
        true,
      ),
    ).toBe(true),
  );
  const operationId = server.write.mock.calls[0]![1].operationId;
  server.relationships = [
    {
      ...relationship,
      lastOperationId: operationId,
      sources: [{ ...relationship.sources[0], available: false }],
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
});

test('operation attribution alone stays quiet but a later source change with the same own operation is announced', async () => {
  const snapshot = buildSheet();
  server.relationships = [relationship];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () =>
    expect(
      await result.current.setSourceEnabled(
        result.current.rows![0]!,
        'bond',
        true,
      ),
    ).toBe(true),
  );
  const operationId = server.write.mock.calls[0]![1].operationId;
  server.relationships = [{ ...relationship, lastOperationId: operationId }];
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
  server.relationships = [
    {
      ...relationship,
      lastOperationId: operationId,
      sources: [{ ...relationship.sources[0], available: false }],
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
});

test('an old in-flight save cannot alter a newly opened Character and maintenance blocks writes', async () => {
  const first = buildSheet();
  const next = {
    ...first,
    character: { ...first.character, _id: 'second' as Id<'character'> },
  };
  server.relationships = [relationship];
  let finish: (() => void) | undefined;
  server.write.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = () => resolve(null);
    }),
  );
  const { result, rerender } = renderHook(
    ({ snapshot }) =>
      useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
    { initialProps: { snapshot: first } },
  );
  const staleInterrupt = result.current.interrupt;
  const oldRow = result.current.rows![0]!;
  let saving: Promise<boolean> | undefined;
  act(() => {
    saving = result.current.interrupt(result.current.rows![0]!);
  });
  expect(result.current.statusFor('relationship')).toEqual({ kind: 'saving' });
  await act(async () =>
    expect(await result.current.interrupt(result.current.rows![0]!)).toBe(
      false,
    ),
  );
  server.relationships = [];
  rerender({ snapshot: next });
  expect(result.current.statusFor('relationship')).toEqual({ kind: 'idle' });
  expect(result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    finish?.();
    await saving;
  });
  expect(result.current.statusFor('relationship')).toEqual({ kind: 'idle' });
  await act(async () => expect(await staleInterrupt(oldRow)).toBe(false));
  server.readOnly = true;
  rerender({ snapshot: next });
  act(() => result.current.openCreate());
  expect(result.current.editor).toBe(null);
  expect(result.current.isDisabled).toBe(true);
});

test('private choices stay with the same owner and an inaccessible former Companion can still be replaced', async () => {
  const sheet = buildSheet();
  const snapshot = {
    ...sheet,
    campaign: null,
    character: { ...sheet.character, campaignId: undefined },
  };
  server.candidates = [
    snapshot.character,
    { ...snapshot.character, _id: 'owned', name: 'Ash' },
    {
      ...snapshot.character,
      _id: 'other-owner',
      ownerId: 'someone-else',
      name: 'Private stranger',
    },
    {
      ...snapshot.character,
      _id: 'campaign-character',
      campaignId: 'campaign',
      name: 'Campaign stranger',
    },
  ];
  server.relationships = [{ ...relationship, endpoint: null }];
  const { result } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  const row = result.current.rows![0]!;
  expect(row).toMatchObject({
    name: 'Character unavailable',
    href: null,
    canManage: true,
    canReplace: true,
    canRestore: false,
  });
  act(() => result.current.openReplace(row));
  expect(result.current.candidates).toEqual([
    { characterId: 'owned', name: 'Ash' },
  ]);
  act(() => result.current.form.setValue('companionCharacterId', 'owned'));
  await act(async () => expect(await result.current.submit()).toBe(true));
  expect(server.write).toHaveBeenLastCalledWith(
    'companionRelationships:replace',
    expect.objectContaining({
      relationshipId: 'relationship',
      companionCharacterId: 'owned',
    }),
  );
});

test('another device’s allocation change on a supporting source is announced', () => {
  const snapshot = buildSheet();
  const source = {
    key: 'beast-master',
    label: 'Beast Master',
    enabled: true,
    available: true,
    ruleKind: 'beastMasterCompanion' as const,
  };
  server.relationships = [
    {
      ...relationship,
      kind: 'animalCompanion',
      sources: [{ ...source, allocatedLevels: 2 }],
    },
  ];
  const { result, rerender } = renderHook(() =>
    useCharacterCompanions({ characterId: snapshot.character._id }, snapshot),
  );
  expect(result.current.allocations.pools).toEqual([]);
  expect(result.current.hasRemoteChange).toBe(false);
  server.relationships = [
    {
      ...relationship,
      kind: 'animalCompanion',
      sources: [{ ...source, allocatedLevels: 3 }],
      lastOperationId: 'other-device',
    },
  ];
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  expect(result.current.rows?.[0]?.sources[0]).toMatchObject({
    allocatedLevels: 3,
  });
});
