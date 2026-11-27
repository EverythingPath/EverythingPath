import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import {
  buildCompanionRelationshipView,
  type CompanionRelationship,
} from './character-companions-view-model';
import { useCharacterSheetFamiliar } from './use-character-sheet-familiar';

const server = vi.hoisted(() => ({ write: vi.fn(), readOnly: false }));
vi.mock('convex/react', () => ({
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

const relationship = {
  relationshipId: 'bond' as Id<'companionRelationship'>,
  role: 'associated',
  kind: 'familiar',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'master' as Id<'character'>, name: 'Ama' },
  sources: [],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;

beforeEach(() => {
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('a familiar base creature choice saves on its own sheet and acknowledges where chosen', async () => {
  let finish: (() => void) | undefined;
  server.write.mockImplementation(
    () =>
      new Promise<null>((resolve) => {
        finish = () => resolve(null);
      }),
  );
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const { result } = renderHook(() =>
    useCharacterSheetFamiliar(
      { characterId: snapshot.character._id },
      snapshot,
      [buildCompanionRelationshipView(relationship)],
    ),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = result.current.selectBaseCreature('cat');
  });
  expect(result.current.status).toEqual({ kind: 'saving' });
  expect(server.write).toHaveBeenCalledWith(
    'characterSheetFamiliars:selectBaseCreature',
    {
      characterId: snapshot.character._id,
      relationshipId: relationship.relationshipId,
      baseCreatureKey: 'cat',
      operationId: expect.any(String),
    },
  );
  await act(async () => {
    finish?.();
    expect(await save).toBe(true);
  });
  expect(result.current.status).toEqual({ kind: 'saved' });
});

test('the private familiar owner can edit the creature without revealing or needing its master', async () => {
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const hidden = buildCompanionRelationshipView({
    ...relationship,
    endpoint: null,
    status: undefined,
    sources: [],
  });
  const { result } = renderHook(() =>
    useCharacterSheetFamiliar(
      { characterId: snapshot.character._id },
      snapshot,
      [hidden],
    ),
  );
  expect(result.current.relationship?.href).toBe(null);
  expect(result.current.relationship?.name).toBe('Character unavailable');
  expect(result.current.isDisabled).toBe(false);
  await act(async () =>
    expect(await result.current.selectBaseCreature('raven')).toBe(true),
  );
  expect(server.write).toHaveBeenCalledWith(
    'characterSheetFamiliars:selectBaseCreature',
    expect.objectContaining({
      characterId: snapshot.character._id,
      relationshipId: relationship.relationshipId,
      baseCreatureKey: 'raven',
    }),
  );
});

test('maintenance, lost sheet access and captured handlers from another scope cannot save a choice', async () => {
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const rows = [buildCompanionRelationshipView(relationship)];
  const { result, rerender } = renderHook(
    ({ snapshot, rows }) =>
      useCharacterSheetFamiliar(
        { characterId: snapshot?.character._id ?? ('gone' as Id<'character'>) },
        snapshot,
        rows,
      ),
    { initialProps: { snapshot: snapshot as typeof snapshot | null, rows } },
  );
  const choose = result.current.selectBaseCreature;
  server.readOnly = true;
  rerender({ snapshot, rows });
  await act(async () => expect(await choose('cat')).toBe(false));
  server.readOnly = false;
  rerender({ snapshot: null, rows });
  await act(async () => expect(await choose('cat')).toBe(false));
  rerender({
    snapshot: {
      ...snapshot,
      character: { ...snapshot.character, _id: 'another' as Id<'character'> },
    },
    rows,
  });
  await act(async () => expect(await choose('cat')).toBe(false));
  expect(server.write).not.toHaveBeenCalled();
});

test('a rejected creature choice preserves the sheet and permits a local retry or clear', async () => {
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  server.write.mockRejectedValueOnce(new ConvexError('Character is read only'));
  const { result } = renderHook(() =>
    useCharacterSheetFamiliar(
      { characterId: snapshot.character._id },
      snapshot,
      [buildCompanionRelationshipView(relationship)],
    ),
  );
  await act(async () =>
    expect(await result.current.selectBaseCreature('toad')).toBe(false),
  );
  expect(result.current.status).toEqual({
    kind: 'error',
    message: "Base creature wasn't saved: Character is read only. Try again.",
  });
  await act(async () =>
    expect(await result.current.selectBaseCreature(null)).toBe(true),
  );
  expect(result.current.status).toEqual({ kind: 'saved' });
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheetFamiliars:selectBaseCreature',
    expect.objectContaining({ baseCreatureKey: null }),
  );
});

test('own creature choice echoes stay quiet and another player’s choice refreshes the familiar summary', async () => {
  const initial = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const rows = [buildCompanionRelationshipView(relationship)];
  const { result, rerender } = renderHook(
    ({ snapshot }) =>
      useCharacterSheetFamiliar(
        { characterId: initial.character._id },
        snapshot,
        rows,
      ),
    { initialProps: { snapshot: initial } },
  );
  await act(async () =>
    expect(await result.current.selectBaseCreature('cat')).toBe(true),
  );
  const operationId = server.write.mock.calls[0]?.[1].operationId;
  const own = {
    ...initial,
    character: {
      ...initial.character,
      familiarBaseCreatureKey: 'cat' as const,
    },
    lastOperationId: operationId,
  };
  rerender({ snapshot: own });
  expect(result.current.view?.baseCreatureLabel).toBe('Cat');
  expect(result.current.hasRemoteChange).toBe(false);
  rerender({
    snapshot: {
      ...own,
      character: { ...own.character, familiarBaseCreatureKey: 'raven' },
      lastOperationId: 'another-player',
    },
  });
  expect(result.current.view?.baseCreatureLabel).toBe('Raven');
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  expect(result.current.hasRemoteChange).toBe(false);
});

test('unsupported creature choices and the associated Character’s sheet cannot write a familiar choice', async () => {
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const { result, rerender } = renderHook(
    ({ role }) =>
      useCharacterSheetFamiliar(
        { characterId: snapshot.character._id },
        snapshot,
        [buildCompanionRelationshipView({ ...relationship, role })],
      ),
    {
      initialProps: {
        role: relationship.role as CompanionRelationship['role'],
      },
    },
  );
  await act(async () =>
    // @ts-expect-error Verify an invalid value supplied outside TypeScript cannot save.
    expect(await result.current.selectBaseCreature('unlisted')).toBe(false),
  );
  rerender({ role: 'companion' });
  expect(result.current.isAvailable).toBe(false);
  await act(async () =>
    expect(await result.current.selectBaseCreature('cat')).toBe(false),
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('creature edits use the server-selected relationship even when an older retained bond arrives first', async () => {
  const older = buildCompanionRelationshipView({
    ...relationship,
    relationshipId: 'older' as Id<'companionRelationship'>,
    status: 'interrupted',
  });
  const snapshot = {
    ...buildSheet(),
    familiarRelationshipId: relationship.relationshipId,
  };
  const { result } = renderHook(() =>
    useCharacterSheetFamiliar(
      { characterId: snapshot.character._id },
      snapshot,
      [older, buildCompanionRelationshipView(relationship)],
    ),
  );
  expect(result.current.relationship?.relationshipId).toBe(
    relationship.relationshipId,
  );
  await act(async () =>
    expect(await result.current.selectBaseCreature('cat')).toBe(true),
  );
  expect(server.write).toHaveBeenCalledWith(
    'characterSheetFamiliars:selectBaseCreature',
    expect.objectContaining({ relationshipId: relationship.relationshipId }),
  );
});
